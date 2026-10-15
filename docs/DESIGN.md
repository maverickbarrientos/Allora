# DESIGN.md

Editorial invitation meets premium service. Calm, confident, generous whitespace. No purple gradients, glassmorphism, neon, emoji or clip-art icons. Light theme only.

## Tokens
Ivory and white page, stone surfaces, deep forest accent, brass for fine details. Defined in `src/app/globals.css`:

```css
:root {
  --ivory: #FAF7F2;        /* page background; text on forest */
  --stone: #F1ECE4;        /* cards, surfaces, secondary and muted fills */
  --ink: #1C1B19;          /* text */
  --ink-muted: #6B665E;    /* secondary text (at least 4.5:1 on ivory and stone) */
  --forest: #1F3A32;       /* buttons and key elements */
  --brass: #B08D57;        /* hairlines and details only, never small text */
  --brass-ink: #7A5F33;    /* small brass labels */
  --brick: #8A3B2E;        /* errors and declined */
  --hairline: rgb(28 27 25 / 0.12);
  --input-border: rgb(28 27 25 / 0.48);  /* form controls need 3:1 against ivory (0.48 is the lowest that passes) */
  --radius: 1.25rem;
  --shadow-soft: 0 1px 2px rgb(28 27 25 / 0.04), 0 12px 32px -16px rgb(28 27 25 / 0.14);
}
```
Map to shadcn variables: background = ivory, foreground = ink, card and secondary and muted and accent = stone (foreground ink), muted-foreground = ink-muted, primary = forest, primary-foreground = ivory, destructive = brick, border = hairline, input = input-border, ring = forest.
Brass: max one highlight per screen.
Hazel, plum, pink and the `.surface-plum` class are removed. There are no color overrides on individual surfaces.

## Typography
- Headlines: Fraunces, weight 300 to 400, letter-spacing -0.01em, line-height 1.05 to 1.15. Display `clamp(2.75rem, 6vw, 4.5rem)`, h1 `clamp(2rem, 4vw, 3rem)`, h2 1.5rem.
- Body and UI: Inter, 1rem/1.65, max 65ch.
- Label: 0.75rem, uppercase, letter-spacing 0.18em, weight 500, `--brass-ink`.
- Load with `next/font`, with fallback stacks.

## Layout
- Content max-width 72rem. Section spacing 6rem desktop, 3.5rem mobile.
- 1px hairline dividers instead of boxes. Cards: stone, `--radius`, `--shadow-soft`, no heavy borders, 1.75rem padding.
- Header: ivory, "Allora" wordmark in serif, user name and log out on the right, hairline below.

## Components (shared, build once)
- `PageHeader`: label, serif title, optional description, hairline below.
- `StatusBadge`: pending = brass-ink text with a 1px brass border; confirmed = forest text on a 10% forest tint; declined = brick text on an 8% brick tint. Always shows the text label.
- `ImagePlaceholder`: soft gradient (stone to 18% brass) plus a caption in ink-muted. Props: caption, aspect, optional src. Without src it renders the placeholder with a `data-placeholder` attribute and a `PLACEHOLDER: replace with photography` code comment. With src it renders the real image. Every placeholder uses this component only. Captions are warm, natural-light moments, e.g. "Table setting, natural light", "Long table, candlelight", "Venue interior, morning light".
- `Reveal`: fade-up wrapper.
- Buttons: primary = forest with ivory text, pill, 44px height. Secondary = transparent with a 1px hairline. Inputs and selects: ivory, 1px `--input-border`, radius 0.75rem, 48px height, small uppercase label above. Alerts: ivory fill with a hairline (brick text and border for errors). Skeletons: stone with a faint shimmer. Icons: lucide only, thin stroke, functional only (arrows, chevrons).

## Motion
- Fade-up: translateY 12px to 0 and opacity 0 to 1, 600ms, `cubic-bezier(0.22, 1, 0.36, 1)`, once, stagger max 80ms, via IntersectionObserver.
- Signature (Assumption, replace when section 4 arrives): the brass hairline under a `PageHeader` draws left to right (scaleX 0 to 1, 900ms), then content fades up.
- `prefers-reduced-motion`: no transforms or animations, content shows immediately.

## Hero and texture
Paper grain (inline SVG noise, about 5% opacity, via a `.paper-grain` class) on the login and sign-up hero panel only.

## Screens
- `/login`, `/signup`: two columns from 1024px. Left hero panel: stone, grain, serif display headline, one `ImagePlaceholder`. Right: the form on ivory. On mobile the hero shrinks to a compact strip with the wordmark and one line, no image. Short, warm copy, no exclamation marks.
- `/`: `PageHeader` ("Your events"), event cards in a 2-column grid. Each card has an `ImagePlaceholder` by event type, then type, date, budget and guests separated by hairlines.
- `/events/[id]`: `PageHeader` with the event type and date. A stats row (budget, guests) separated by hairlines. Bookings as hairline-separated rows: category label, vendor name in serif, price right-aligned, `StatusBadge`.
- `/events/[id]/vendors`: category tabs as plain text with a brass underline on the active one, not pills. Vendor cards with `ImagePlaceholder`, name, price and a Book button.
- All loading, empty, error and 404 states keep their behavior and get the same styling. Prices and budgets are plain numbers with no currency symbol.

## Out of scope
Dark theme, a landing page, dependencies, data or API changes, behavior changes.

## Accessibility
Body text at least 4.5:1 on ivory and on stone. Form control borders at least 3:1. Visible focus ring (2px forest, 2px offset; ivory on dark surfaces). Touch targets at least 44px. Works at 375px width.