# DESIGN.md

Editorial invitation meets premium service. Calm, confident, generous whitespace. No glassmorphism, neon, emoji or clip-art icons. Light theme only.

## Tokens
Hazel page, plum components, pink accents. Defined in `src/app/globals.css`:

```css
:root {
  --hazel: #938563;       /* page background */
  --plum: #6c3069;        /* cards, header, auth hero, primary buttons */
  --plum-light: #9e749d;  /* secondary, muted and accent surfaces */
  --pink: #b76e79;        /* accents; primary buttons on plum surfaces */
  --plum-ink: #140f14;    /* text on plum-light and pink */
  --ivory: #faf7f2;       /* text on plum; input, alert and badge fill */
  --stone: #f1ece4;
  --ink: #1c1b19;         /* text on hazel */
  --ink-muted: #1f1c19;   /* body-size text on hazel needs ink-level contrast */
  --label: #1c1b19;
  --brass: #6c3069;       /* the one hairline highlight per screen (name kept) */
  --brick: #3a0f0a;       /* errors and declined, dark enough for text on hazel */
  --hairline: rgb(28 27 25 / 0.25);
  --radius: 1.25rem;
  --shadow-soft: 0 2px 4px rgb(28 27 25 / 0.2), 0 18px 40px -12px rgb(28 27 25 / 0.5);
}
```
Map to shadcn variables: background = hazel, foreground = ink, card = plum, card-foreground = ivory, primary = plum, primary-foreground = ivory, secondary and muted and accent = plum-light (foreground plum-ink), muted-foreground = ink-muted, destructive = brick, border = hairline, input = ink at 45%, ring = ink.

Plum surfaces (cards, header, auth hero) use the `.surface-plum` class, which re-maps the theme on that surface: ivory text, pink primary buttons with plum-ink text, an ivory focus ring, light hairlines and pink-tinted labels.
Brass (plum): max one highlight per screen.

## Typography
- Headlines: Fraunces, weight 300 to 400, letter-spacing -0.01em, line-height 1.05 to 1.15. Display `clamp(2.75rem, 6vw, 4.5rem)`, h1 `clamp(2rem, 4vw, 3rem)`, h2 1.5rem.
- Body and UI: Inter, 1rem/1.65, max 65ch.
- Label: 0.75rem, uppercase, letter-spacing 0.18em, weight 500, `--label` (ink on hazel, pink tint on plum).
- Load with `next/font`, with fallback stacks.

## Layout
- Content max-width 72rem. Section spacing 6rem desktop, 3.5rem mobile.
- 1px hairline dividers instead of boxes. Cards: plum with a 50% pink border, `--radius`, `--shadow-soft`, 1.75rem padding.
- Header: plum, "Allora" wordmark in serif, user name and log out on the right, hairline below.

## Components (shared, build once)
- `PageHeader`: label, serif title, optional description, hairline below.
- `StatusBadge`: ivory fill with a 1px border and matching text. Pending = plum, confirmed = dark green `#1f3a32`, declined = brick. Always shows the text label.
- `ImagePlaceholder`: soft gradient (plum-light to pink) plus a plum-ink caption. Props: caption, aspect, optional src. Without src it renders the placeholder with a `data-placeholder` attribute and a `PLACEHOLDER: replace with photography` code comment. With src it renders the real image. Every placeholder uses this component only. Captions are warm, natural-light moments, e.g. "Table setting, natural light", "Long table, candlelight", "Venue interior, morning light".
- `Reveal`: fade-up wrapper.
- Buttons: primary = plum with ivory text (pink with plum-ink text on plum surfaces), pill, 44px height. Secondary = transparent with a 1px border at 40% of the text color. Inputs and selects: ivory, 1px input border, radius 0.75rem, 48px height, small uppercase label above. Alerts: ivory fill (plum-ink text, or brick text and border for errors). Skeletons: ink at 12% with a faint shimmer. Icons: lucide only, thin stroke, functional only (arrows, chevrons).

## Motion
- Fade-up: translateY 12px to 0 and opacity 0 to 1, 600ms, `cubic-bezier(0.22, 1, 0.36, 1)`, once, stagger max 80ms, via IntersectionObserver.
- Signature (Assumption, replace when section 4 arrives): the brass hairline under a `PageHeader` draws left to right (scaleX 0 to 1, 900ms), then content fades up.
- `prefers-reduced-motion`: no transforms or animations, content shows immediately.

## Hero and texture
Paper grain (inline SVG noise, about 5% opacity, via a `.paper-grain` class) on the login and sign-up hero panel only.

## Screens
- `/login`, `/signup`: two columns from 1024px. Left hero panel: plum, grain, serif display headline, one `ImagePlaceholder`. Right: the form on hazel. On mobile the hero shrinks to a compact strip with the wordmark and one line, no image. Short, warm copy, no exclamation marks.
- `/`: `PageHeader` ("Your events"), event cards in a 2-column grid. Each card has an `ImagePlaceholder` by event type, then type, date, budget and guests separated by hairlines.
- `/events/[id]`: `PageHeader` with the event type and date. A stats row (budget, guests) separated by hairlines. Bookings as hairline-separated rows: category label, vendor name in serif, price right-aligned, `StatusBadge`.
- `/events/[id]/vendors`: category tabs as plain text with a brass (plum) underline on the active one, not pills. Vendor cards with `ImagePlaceholder`, name, price and a Book button.
- All loading, empty, error and 404 states keep their behavior and get the same styling. Prices and budgets are plain numbers with no currency symbol.

## Out of scope
Dark theme, a landing page, dependencies, data or API changes, behavior changes.

## Accessibility
Body text at least 4.5:1. Visible focus ring (2px, 2px offset): ink on hazel, ivory on plum surfaces. Touch targets at least 44px. Works at 375px width.
