import type { Competition, CompetitionDetail } from '../api/types';

export function emptyCompetition(detail?: CompetitionDetail) {
  return !!detail && !detail.participants.length && !detail.entries.length;
}

/** Stable ties preserve the server's newest-first order, including legacy rows. */
export function orderCompetitions(items: Competition[], details: Record<string, CompetitionDetail>) {
  const score = (c: Competition) => [Number(!!details[c.id] && !emptyCompetition(details[c.id])), Number(c.title.trim().length >= 4)];
  return [...items].sort((a, b) => {
    const x = score(a), y = score(b);
    return y[0] - x[0] || y[1] - x[1] || (Date.parse(b.created_at ?? '') || 0) - (Date.parse(a.created_at ?? '') || 0);
  });
}
