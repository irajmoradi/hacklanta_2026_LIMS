# Village

**Tagline:** Give your friend group a reason to show up.

**Main track:** AI/ML. **Proposed side challenges (maximum three, owner confirmation pending per D-002):** Mercedes Best CV, Photon Agents in iMessage, MLH Best Use of ElevenLabs.

Demo: https://thefriendshipvillage.vodka

## Inspiration

Getting people together is the hardest part of having a friend group. Everyone cares. Everyone is busy. The group chat fills with links, but nobody knows who needs encouragement, who finished something hard, or when everyone will actually hang out.

Village uses AI and ML to automate that coordination. It gives close friends a shared town, daily reasons to check in, and friendly public competition around their goals. Solana supplies the financial-incentive experiment. Gemini supplies a creative Mayor. ElevenLabs and computer vision give the town familiar faces and voices. iMessage carries the invitation back into real life.

The goal is simple: make showing up for each other a habit.

## What it does

Village is a browser 3D community with live multiplayer features: shared progress, online presence and synchronized furniture editing. The Friends hub puts goals, today's check-ins and accomplishments together, with ways to cheer, message or visit someone. When friends walk their villagers, everyone sees them move around town in real time over an authenticated WebSocket.

**Solana economy.** Daily check-ins turn effort into visible progress. Spendable coins buy cosmetics and home upgrades; lifetime XP records achievement independently. Friends set challenges in the Colosseum, with winner-take-all, proportional or ranked payout terms locked at creation. Solana payments require wallet review, explicit sign/send and server-verified receipts. Shop's Treasury exchanges **devnet test SOL** for personal XP within a daily cap; it does not grant coins or village XP. The original pot program was deployed on devnet. The new payout ABI still needs a separately approved v2 deployment; we do not claim a completed live v2 settlement.

**Gemini Mayor.** Cinematic check-in and Mayor scenes turn routine updates into encounters. The Mayor uses recorded activity to offer nudges, challenges and village news. For disasters, the Mayor chooses 2–3 bounded tasks such as helping a neighbor or working out together, with a short public explanation. Tagged, verified photo updates advance each task; meeting all targets restores the town. The hidden Demo Lab lets judges rehearse that recovery in a browser-local sandbox. Offline or capped planning uses a labeled example. Older disasters keep their check-in rules. Repairs are a game mechanic, not proof of physical attendance. Gemini can review photo relevance to a goal; human auditors retain final weekly grading.

**ElevenLabs + computer vision avatars.** With permission, a photo becomes a recognizable walking villager and a talking portrait, with a permitted voice or stock alternative. The wardrobe gives that character a personal style. Friends can visit house interiors and furnish a Community Hall together. A photographed garment can become a pattern; an object can become a decoration. The shared reading list adds another everyday reason to return and compare takeaways.

**iMessage IRL loop.** Photon brings nudges to the phone people already check. Reply with progress, ask about a goal, or send photo evidence back. Villager-grams pair an AI-labeled message with a consenting friend's voice and avatar. Talking-video delivery has an audio-and-portrait fallback. The agent supports authorized live delivery and a no-send mode. Our prepared demo uses simulated transport; real handset video receipt still needs documented evidence.

## How we built it

React, Vite, TypeScript and React Three Fiber render the village. FastAPI owns application rules and provider calls. PostgreSQL/TimescaleDB stores progress and ledgers. Optional Auth0 Sign in provides JWT identity and single-use seat claims that preserve existing progress. Sign in is hidden by default in the production build; enabling it and issuing private codes remain operator steps. The shared demo exposes impersonable seats. Vultr hosts the application, database and HTTPS front in the recorded production layout.

**Economy:** server transactions keep coin purchases and XP awards consistent. The Solana Anchor program and Codama/Solana Kit client implement devnet pots with immutable payout terms. The API prepares wallet intents and verifies confirmed receipts against the signer, operation and competition before crediting payment. Treasury XP is labeled separately. A v1 deployment record does not establish that the new ABI is deployed.

**Mayor:** the Gemini adapter uses **Gemini 3.5 Flash-Lite via Vertex AI express** by default on its Gemini path. Provider selection is configurable; OpenRouter is the code default for general Mayor requests, and deterministic fallback outputs retain provenance. Structured responses constrain the model's proposals, and the server validates effects. Photo evidence calls Gemini directly. AI supplies ideas and relevance advice; application code controls rewards and permissions.

**Avatars:** SAM 3 segments people and clothing. LAM builds Gaussian talking heads. ElevenLabs speech feeds Audio2Expression facial motion. Gemini stylizes crops before Hunyuan3D builds textured heads for preset animated bodies. **Modal L4 GPUs** implement SAM 3, LAM, Audio2Expression and Hunyuan3D stages, alongside the local RTX 5090 route. Jobs publish versioned assets so the browser can retain a usable avatar during processing. House edits use transactional reducers, WebSockets and PostgreSQL LISTEN/NOTIFY, with a separate TigerData pool when configured.

**Messaging:** a Bun/TypeScript **Photon Spectrum** agent talks to FastAPI over HTTP. Sender mapping connects inbound evidence to membership and goals. A durable outbox handles outbound work, retries and consent checks. STOP opts out. Transport is at-least-once, so we do not promise duplicate-free delivery after a crash.

## Challenges

A generated face is only useful if it survives the rest of the product. Different models needed isolated environments. Cold starts could outlast a message's video deadline. Heads changed the fit of hats and glasses. We used preset body rigs, measured fitting, cached assets and explicit fallbacks to keep the social interaction moving.

Shared state introduced a different problem: making a room edit, reward or retry behave consistently. Server validation and transactional ledgers handle the rules; snapshots recover house connections. Fixture mode keeps the town demonstrable without providers, but it is labeled simulation rather than shared durable state.

## Accomplishments

We connected daily progress, public competition, personal avatars and phone-based replies in one application. The town remains usable with preset avatars and the GPU offline.

Historical measurements back specific engineering improvements. Village GET p95 fell from **635.16 to 114.48 ms** in a five-villager isolated ASGI benchmark, excluding network latency. Outfit QA covered **1,520 combinations and 3,040 views**, reducing measured geometric failures from **606 to zero**; that is pairwise coverage, not every possible animation. Modal reports a short talking clip at **170 seconds cold / 12.3 seconds warm**, showing why delivery needs a fallback. Sources and boundaries are in the [evidence ledger](EVIDENCE.md).

## What we learned

AI works best here when it makes an existing relationship easier to act on. A relevant nudge needs recorded context. A familiar voice needs permission. A challenge needs rules people understand. None of those can be replaced by a more elaborate prompt.

We also learned to separate impressive output from reliable delivery. A rendered video is not a received message. A devnet program is not a settled economy. Those distinctions made the product easier to test and the demo easier to trust.

## What's next

Prove consented handset video delivery, deploy and exercise the new devnet payout ABI with owner approval, and measure two-browser house synchronization through the deployed TigerData path. Improve crowded-town rendering and test overworld reconnects under load. Rehearse real Auth0 login and seat claims after the owner enables Sign in. Then test whether these daily interactions lead friends to meet more often. Review publication rights and model terms before broader release.

## Built with

React, TypeScript, Vite, Three.js, React Three Fiber, Bun, Python, FastAPI, PostgreSQL, TimescaleDB, TigerData, Auth0, Gemini 3.5 Flash-Lite, Vertex AI express, OpenRouter, ElevenLabs, Photon Spectrum, SAM 3, LAM, Audio2Expression, Hunyuan3D, Modal L4, CUDA, Solana, Anchor, Codama, Solana Kit, Vultr, Caddy.

## Side-challenge and sponsor notes

**AI/ML main track.** Our application combines creative planning, visual evidence review, segmentation, reconstruction and speech animation around one problem: helping friends show up. We integrate pretrained models; we did not train them.

**Mercedes Best Computer Vision.** The photo-to-villager pipeline turns segmentation and reconstruction into a character people can visit, dress and hear. Photo-derived patterns and objects extend that identity into the town. Preset assets keep CV failure from blocking participation.

**Photon Agents in iMessage.** Spectrum closes the loop between a village prompt and a real-world reply: goals, check-ins and photo evidence enter through iMessage. Consent checks and media fallback are implemented; simulated video transport is distinct from proven handset receipt.

**MLH Best Use of ElevenLabs.** Consent-gated Instant Voice Cloning and TTS make avatars sound familiar, while Audio2Expression supplies facial motion. Stock voices provide an alternative, and generated sound effects add town ambience. Public face/voice permissions and current model licensing still need review; see [disclosures and evidence](EVIDENCE.md).

## Try it

Open [the village](https://thefriendshipvillage.vodka), choose an available demo seat and explore Friends, the wardrobe, home interiors, Compete and Shop → Treasury. Demo seats are shared and impersonable. SOL is **devnet test SOL**, with no claim of real-money returns; do not send funds or trigger world-changing debug actions just to inspect the demo.

Visit the hidden [Demo Lab](https://thefriendshipvillage.vodka/lab). Big town, Disasters & repair, Village futures and Your first day are local demonstrations; reload restores them. Avatar studio explains the CV stages using permitted cached media where available and labeled placeholders otherwise. This route does not prove live GPU inference. Disasters & repair includes Ask the Mayor, public selection status and per-task simulation. That explicit click can request a capped LLM plan; the sandbox changes no village state. WEB-058 also improves mobile controls, sign hit targets, competition ordering, feed destinations and Gazette copy.

For a private trial with zero accounts or keys, follow [local mock setup](../SETUP.md#local-in-five-minutes-mock-mode), then open `/lab`. The [150-second demo script](DEMO_SCRIPT.md), [trailer handoff](video/TRAILER.md) and [evidence ledger](EVIDENCE.md) distinguish prepared footage, simulations and measured results. The **2:48 long cut is the Devpost video**; there are also a **1:30 short cut**, **39-second square** and original **94-second v4 master**. MP4s/private media are delivered separately from Git. The team uploads the selected film to the submission video host; no published video URL is recorded in this checkout.
