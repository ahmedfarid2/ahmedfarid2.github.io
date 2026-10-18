// scripts/brand-mark.mjs
//
// The AF monogram, drawn once. Letters are stroked paths on a 64-unit grid, not
// text, so the mark is identical on every device instead of falling back to
// whatever monospace font the visitor happens to have.
//
// Two optical cuts, as icon sets are drawn:
//   LARGE — lighter strokes and more air, for 180px+ (the iPhone home screen).
//   SMALL — heavier strokes that fill the square, for 16–32px (tabs) and the
//           26px nav badge, where the large cut's hairlines turn to mud.
//
// build.mjs writes /favicon.svg and renders /apple-touch-icon.png from these,
// and swaps the nav badge's text "AF" for the same letterforms.

const INK = '#0B0D10';
const GOLD = '#D9B978';

const LARGE =
  '<g fill="none" stroke="COLOR" stroke-width="5" stroke-linejoin="bevel" stroke-miterlimit="1" transform="translate(1.6 0)">' +
  '<path d="M11 47 20.5 17 30 47"/><path d="M14.5 37.5h12"/><path d="M37 17v30M34.5 19.5h17.5M37 32h11.5"/></g>';

const SMALL =
  '<g fill="none" stroke="COLOR" stroke-width="6" stroke-linejoin="bevel" stroke-miterlimit="1" transform="translate(1.5 0)">' +
  '<path d="M9 49 19 15 29 49"/><path d="M12.2 38.5h13.6"/><path d="M38 15v34M35 18h20M38 32.5h13"/></g>';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

// Browser tab: rounded dark plate, small cut.
export const faviconSvg = () =>
  svg(`<rect width="64" height="64" rx="14" fill="${INK}"/>${SMALL.replace('COLOR', GOLD)}`);

// iPhone home screen: full-bleed square. iOS rounds the corners itself, so a
// pre-rounded icon would leave dark corner artifacts.
export const appleIconSvg = () =>
  svg(`<rect width="64" height="64" fill="${INK}"/>${LARGE.replace('COLOR', GOLD)}`);

// Nav badge: letters only, in currentColor, so the badge's own background and
// theme colours (gold on dark, ink on light) still apply.
export const badgeSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${SMALL.replace('COLOR', 'currentColor')}</svg>`;

export const ICON_LINKS =
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">';
