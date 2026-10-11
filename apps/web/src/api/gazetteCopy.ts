/** Repair prose only; keep links, contacts, decimal numbers and abbreviations intact. */
export function normalizeGazetteCopy(text: string, names: string[] = []): string {
  return text.split(/(https?:\/\/\S+|\b[\w.+-]+@[\w.-]+\b|\b[\w.-]+\.(?:com|org|net|io|dev|co|edu|gov)\b\S*)/gi)
    .map((part, index) => {
      if (index % 2) return part;
      for (const name of [...names].sort((a,b) => b.length-a.length)) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!escaped) continue;
        const display = name === name.toLowerCase() ? name.replace(/\b\p{L}/gu, c => c.toUpperCase()) : name;
        part = part.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu'), () => display);
      }
      return part
      .replace(/\b([A-Za-z]+)(['’])(S|T|Re|Ve|Ll|D|M)\b/g, (_, word: string, apostrophe: string, suffix: string) => word + apostrophe + suffix.toLowerCase())
      .replace(/([a-z]{3,})([.!?])(?=[A-Za-z]{2,}\b)/g, '$1$2 ')
      .replace(/([.!?]\s+[\"'\u201c\u2018(]*)([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
      .replace(index === 0 ? /^(\s*[\"'\u201c\u2018(]*)([a-z])/ : /$^/, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
    })
    .join('');
}
