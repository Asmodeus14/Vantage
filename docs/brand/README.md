# Brand

`logo-system.png` is the source sheet: the mark, wordmark, app icon, favicon
sizes and a scalability test.

The shipped assets were extracted from it rather than hand-traced — the mark is
two interlocking chevrons whose overlap produces specific negative shapes, and
approximating that by eye would produce something V-shaped but not *this* mark.

| Asset | Where |
|---|---|
| Browser tab icon (32) | `app/icon.png` |
| iOS home screen (180) | `app/apple-icon.png` |
| PWA manifest (192, 512) | `public/icon-192.png`, `public/icon-512.png` |
| Header, light / dark (256) | `public/mark.png`, `public/mark-light.png` |

`components/logo.tsx` swaps between the two header variants on theme rather than
using a CSS filter: `invert()` would also invert any future colour in the mark,
and is a lie the moment the brand stops being monochrome.

**If the vector source becomes available**, drop it in and the header logo can
become an inline SVG inheriting `currentColor` — one file instead of two, crisp
at any size.
