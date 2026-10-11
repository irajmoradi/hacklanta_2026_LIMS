export function badgeLabel(kind: string, week: string) {
  const name = kind === 'star' ? 'Weekly completion star' : kind.replaceAll('_', ' ');
  const date = new Date(`${week}T12:00:00Z`);
  return `${name} · ${Number.isNaN(date.getTime()) ? week : date.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'})}`;
}
