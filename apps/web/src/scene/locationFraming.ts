/** Frame one town lot, leaving screen space for the people card. Units are
 * rendered world units (the town itself is scaled to .55), not grid units. */
export function locationFraming(width: number, height: number) {
  const mobile = width < 600;
  const availableWidth = mobile ? width - 24 : width - 380;
  const availableHeight = mobile ? height * .52 : height - 140;
  const zoom = Math.max(1, Math.min(140, availableWidth / 7, availableHeight / 7));
  return {zoom, right: mobile ? 0 : 170 / zoom, up: mobile ? -height * .18 / zoom : 0};
}
