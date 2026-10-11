"""Opt-in autonomous Mayor with transactional, cross-process limits."""

import asyncio
import logging

from fastapi import HTTPException

from app import bribes, events_table, mayor, newspaper, voice, world
from app.db import many, one
from app.domain import activity
from app.events_table import TemplateDecision

logger = logging.getLogger(__name__)


async def project_event_pack(conn, vid, state):
    """Derive a cosmetic override from the active event window, never overwrite weather.

    Supports both pre-ARCH-003 registries and its additive event_packs section.
    Expiry/completion immediately restores the ordinary weather/penalty projection.
    """
    from app.catalog import runtime_catalog

    registry = await runtime_catalog(conn)
    packs = registry.data.get("event_packs", [])
    packs = packs if isinstance(packs, dict) else {p["id"]: p for p in packs}
    events = await many(
        conn,
        "SELECT id,template_id,ends_at FROM mayor_events WHERE village_id=%s "
        "AND status='active' AND ends_at>now() AND repairs_event_id IS NULL "
        "ORDER BY created_at DESC,id DESC",
        (vid,),
    )
    result = {**state, "active_pack": None}
    for event in events:
        template = events_table.TEMPLATES.get(event["template_id"], {})
        pack = template.get("pack") or event["template_id"]
        definition = pack if isinstance(pack, dict) else packs.get(pack)
        # Explicit template packs also work before the registry section lands.
        if definition is None and template.get("pack"):
            definition = {"id": pack, "pieces": [], "weather": template.get("weather")}
        if not definition:
            continue
        result["active_pack"] = {
            **definition,
            "event_id": str(event["id"]),
            "ends_at": event["ends_at"],
        }
        if definition.get("weather"):
            result["weather"] = definition["weather"]
        break
    return result


async def log_decision(conn, vid, action, reason, model, target=None, agent="mayor"):
    await activity(
        conn,
        vid,
        target,
        "agent_decision",
        {
            "agent": agent,
            "action": action,
            "reason": reason,
            "model": model,
            "target_user_id": str(target) if target else None,
        },
    )


async def send_nudge(conn, settings, vid, target_id, *, idle_only=False):
    # User lock makes the daily cap global across villages and API processes.
    target = await one(conn, "SELECT * FROM users WHERE id=%s FOR UPDATE", (target_id,))
    if not target or not target["agent_msgs_ok"]:
        return None, "Agent messages are disabled"
    if not await one(
        conn, "SELECT 1 FROM village_members WHERE village_id=%s AND user_id=%s", (vid, target_id)
    ):
        return None, "Target is not a village member"
    if idle_only and await one(
        conn,
        """SELECT 1 FROM check_ins WHERE village_id=%s AND user_id=%s
        AND created_at>now()-interval '24 hours' LIMIT 1""",
        (vid, target_id),
    ):
        return None, "Target checked in within 24 hours"
    count = await one(
        conn,
        """SELECT count(*) AS n FROM activity_events
        WHERE type='mayor_message' AND payload->>'target_user_id'=%s
        AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'""",
        (str(target_id),),
    )
    if count["n"] >= 3:
        return None, "Daily limit of three agent messages reached"
    speaker = await one(
        conn,
        """SELECT u.* FROM users u JOIN village_members m ON m.user_id=u.id
        WHERE m.village_id=%s AND u.id<>%s ORDER BY
        (SELECT count(*) FROM check_ins c WHERE c.village_id=%s AND c.user_id=u.id
        AND c.created_at>=now()-interval '7 days') DESC,m.house_slot LIMIT 1""",
        (vid, target_id, vid),
    )
    if not speaker:
        return None, "A nudge needs another villager"
    from app.styles import equipped_style

    speaker["voice_style"] = await equipped_style(conn, vid, speaker["id"])
    adapter = mayor.Mayor(settings)
    text = await adapter.nudge(await mayor.context_for(conn, vid), speaker, target)
    line = {"audio_url": None, "expr_url": None, "job_id": None, "id": None}
    if settings.mayor_voice:
        try:
            line = await voice.create_line(
                conn, settings, speaker, text, expr_user=target, require_head=True
            )
        except HTTPException as exc:
            if exc.status_code not in {502, 503}:
                raise
    audio_url = line["audio_url"]
    await activity(
        conn,
        vid,
        target_id,
        "mayor_message",
        {
            "text": text,
            "target_user_id": str(target_id),
            "speaker_user_id": str(speaker["id"]),
            "audio_url": audio_url,
            "expr_url": line["expr_url"],
            "job_id": str(line["job_id"]) if line["job_id"] else None,
            "line_id": str(line["id"]) if line["id"] else None,
            "model": adapter.last_source,
        },
    )
    if target["phone_e164"]:
        from app.security import charge

        charge(settings, "photon_queue")
        await conn.execute(
            """INSERT INTO mayor_outbox
            (village_id,user_id,phone_e164,text,audio_key) VALUES (%s,%s,%s,%s,%s)""",
            (
                vid,
                target_id,
                target["phone_e164"],
                text,
                audio_url.removeprefix("/api/assets/") if audio_url else None,
            ),
        )
    return {
        "text": text,
        "audio_url": audio_url,
        "expr_url": line["expr_url"],
        "job_id": line["job_id"],
        "line_id": line["id"],
    }, adapter.last_source


async def announce_event(conn, vid, event, model):
    members = await many(
        conn,
        """SELECT u.* FROM users u JOIN village_members m ON m.user_id=u.id
        WHERE m.village_id=%s ORDER BY u.id FOR UPDATE OF u""",
        (vid,),
    )
    for target in members:
        if not target["agent_msgs_ok"] or not target["phone_e164"]:
            continue
        count = await one(
            conn,
            """SELECT count(*) AS n FROM activity_events
            WHERE type='mayor_message' AND payload->>'target_user_id'=%s
            AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'""",
            (str(target["id"]),),
        )
        if count["n"] >= 3:
            continue
        text = f"[AI Mayor] {event.title}: {event.body.removeprefix('[AI Mayor] ')}"
        await conn.execute(
            """INSERT INTO mayor_outbox (village_id,user_id,phone_e164,text,kind)
            VALUES (%s,%s,%s,%s,'event')""",
            (vid, target["id"], target["phone_e164"], text),
        )
        await activity(
            conn,
            vid,
            target["id"],
            "mayor_message",
            {"text": text, "target_user_id": str(target["id"]), "model": model},
        )


async def tick(pool, settings):
    async with pool.connection() as conn:
        villages = await many(
            conn,
            """SELECT v.id FROM villages v WHERE v.name NOT LIKE 'QA-%%'
            AND (EXISTS (SELECT 1 FROM check_ins c WHERE c.village_id=v.id
                         AND c.created_at>now()-interval '48 hours')
                 OR EXISTS (SELECT 1 FROM activity_events a WHERE a.village_id=v.id
                     AND a.created_at>now()-interval '48 hours' AND a.user_id IS NOT NULL
                     AND a.type IN ('village_created','village_joined','goal_set','purchase',
                                    'evidence_uploaded','checkin','avatar_queued',
                                    'mayor_event','goal_status','event_completed',
                                    'weekly_graded','weekly_finalized','weekly_insufficient_vote',
                                    'competition_created','competition_joined',
                                    'competition_entry_submitted','competition_entry_decided',
                                    'competition_settled'))
                 OR EXISTS (SELECT 1 FROM mayor_bribes b WHERE b.village_id=v.id
                     AND b.status='pending' AND b.currency='xp'
                     AND b.created_at>now()-interval '48 hours'))
            ORDER BY v.id""",
        )
    for village in villages:
        vid = village["id"]
        try:
            # Commit the daily edition independently of later decision failures.
            async with pool.connection() as publication_conn:
                await newspaper.publish(publication_conn, settings, vid)
            async with pool.connection() as conn:
                # Skip villages being considered by another worker, never duplicate a tick.
                locked = await one(
                    conn,
                    "SELECT pg_try_advisory_xact_lock(hashtext(%s)) AS ok",
                    ("mayor:" + str(vid),),
                )
                if not locked["ok"]:
                    continue
                recent = await one(
                    conn,
                    """SELECT 1 FROM activity_events WHERE village_id=%s
                    AND type='agent_decision' AND payload->>'agent'='scheduler'
                    AND created_at>now()-(%s * interval '1 second') LIMIT 1""",
                    (vid, settings.mayor_tick_seconds),
                )
                if recent:
                    continue
                await world.state(conn, vid)
                adapter = mayor.Mayor(settings)
                context = await mayor.context_for(conn, vid)
                try:
                    decision = await adapter.generate(
                        TemplateDecision,
                        "Decide whether to nudge one idle villager (no check-in for 24h), "
                        "announce a challenge/random_event, set weather, or do nothing. "
                        "State a reason. Weather must be clear|rain|fog|festival_night "
                        "and changes at most once per 3 hours. "
                        "Use only member UUIDs. Prefer doing nothing when activity is healthy. "
                        "Nudges must respect agent_msgs_ok and roast_ok." + events_table.prompt(),
                        context,
                    )
                    # Revalidate even adapter/test doubles before accessing attributes.
                    # API-009 requires template events, not legacy MayorProposal objects.
                    decision = TemplateDecision.model_validate(decision.model_dump())
                except Exception:
                    decision = TemplateDecision(
                        action="none",
                        reason="Invalid decision or providers unavailable; no action.",
                    )
                action, reason = decision.action, decision.reason
                if action == "weather":
                    if not decision.weather or not await world.set_weather(
                        conn, vid, decision.weather, reason
                    ):
                        action, reason = (
                            "none",
                            reason + "; Weather unchanged or within 3-hour cooldown",
                        )
                elif action == "nudge":
                    if decision.target_user_id:
                        result, detail = await send_nudge(
                            conn, settings, vid, decision.target_user_id, idle_only=True
                        )
                    else:
                        result, detail = None, "Missing target"
                    if not result:
                        action, reason = "none", reason + "; " + detail
                elif action == "event":
                    # Same village lock also used by explicit event creation.
                    await conn.execute("SELECT id FROM villages WHERE id=%s FOR UPDATE", (vid,))
                    recent_event = await one(
                        conn,
                        """SELECT 1 FROM mayor_events WHERE village_id=%s
                        AND created_at>now()-interval '6 hours' LIMIT 1""",
                        (vid,),
                    )
                    if (
                        recent_event
                        or not decision.event
                        or decision.event.kind not in {"challenge", "random_event"}
                    ):
                        action, reason = (
                            "none",
                            reason + "; Event cooldown or invalid event proposal",
                        )
                    else:
                        try:
                            decision.event, used = events_table.with_bribes(
                                decision.event,
                                await bribes.pending_bribes(conn, vid),
                                len(context["villagers"]),
                            )
                            decision.event.body = "[AI Mayor] " + decision.event.body.removeprefix(
                                "[AI Mayor] "
                            )
                            event = await mayor.insert_event(
                                conn, vid, None, decision.event, adapter.last_source
                            )
                        except ValueError:
                            action, reason = "none", "Event failed template validation"
                        else:
                            for row in used:
                                await conn.execute(
                                    "UPDATE mayor_bribes SET status='consumed' "
                                    "WHERE id=%s AND village_id=%s AND status='pending'",
                                    (row["id"], vid),
                                )
                                await log_decision(
                                    conn,
                                    vid,
                                    "bribe_consumed",
                                    f"Consumed coin bribe {row['id']} ({row['xp']} coins): "
                                    f"weighted template {event['template_id']}; "
                                    f"reward bounded to {event['reward_xp']} XP; "
                                    f"event {event['id']} committed.",
                                    adapter.last_source,
                                    agent="mayor",
                                )
                            if used:
                                await newspaper.record_bribes(conn, vid, event, used)
                            await announce_event(conn, vid, decision.event, adapter.last_source)
                await log_decision(
                    conn,
                    vid,
                    action,
                    reason,
                    adapter.last_source,
                    decision.target_user_id if action == "nudge" else None,
                    agent="scheduler",
                )
        except Exception as exc:
            logger.warning("Mayor tick failed (%s)", type(exc).__name__)
            async with pool.connection() as conn:
                await log_decision(
                    conn,
                    vid,
                    "none",
                    "Tick failed; no action committed.",
                    "fallback",
                    agent="scheduler",
                )


async def run(pool, settings):
    while True:
        await asyncio.sleep(settings.mayor_tick_seconds)
        try:
            await tick(pool, settings)
        except Exception as exc:
            logger.warning("Mayor scheduler unavailable (%s)", type(exc).__name__)
