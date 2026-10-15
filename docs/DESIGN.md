# DESIGN.md

Editorial invitation meets premium service. Calm, confident, generous whitespace. No glassmorphism, neon, emoji or clip-art icons. Light theme only.

## Tokens
A quiet hazel gradient page, deep plum components, dusty-rose accent. Defined in `src/app/globals.css`:

```css
:root {
  --hazel: #938563;        /* contrast floor: ink text must stay 4.5:1 on any page stop */
  --page-gradient: linear-gradient(170deg, #a89c80 0%, #9a8c6c 45%, #938563 100%);
  --plum: #5b2a59;         /* cards, header, auth hero, primary buttons */
  --plum-deep: #46203f;    /* gradient end for cards and header */
  --surface-gradient: linear-gradient(160deg, var(--plum) 0%, var(--plum-deep) 100%);
  --plum-light: #9e749d;   /* secondary, muted and accent surfaces; do not go darker (plum-ink text needs 4.5:1) */
  --pink: #b76e79;         /* accents; primary buttons on plum surfaces */
  --plum-ink: #140f14;     /* text on plum-light and pink */
  --ivory: #f4efe7;        /* text on plum; input, alert and badge fill */
  --stone: #ebe5db;
  --ink: #1c1b19;          /* text on hazel */
  --ink-muted: #1f1c19;    /* body-size text on hazel needs ink-level contrast */
  --label: #1c1b19;
  --brass: #b76e79;        /* the one highlight per screen: dusty rose (name kept) */
  --brick: #3a0f0a;        /* errors and declined, dark enough for text on hazel */
  --hairline: rgb(28 27 25 / 0.22);
  --radius: 1rem;
  --shadow-soft: 0 1px 2px rgb(20 15 20 / 0.25), 0 10px 24px -10px rgb(20 15 20 / 0.45);
  --shadow-lift: 0 2px 4px rgb(20 15 20 / 0.3), 0 16px 32px -10px rgb(20 15 20 / 0.55);
}
```
Map to shadcn variables: background = hazel, foreground = ink, card = plum, card-foreground = ivory, primary = plum, primary-foreground = ivory, secondary and muted and accent = plum-light (foreground plum-ink), muted-foreground = ink-muted, destructive = brick, border = hairline, input = ink at 45%, ring = ink.

Page: `background: var(--page-gradient)` with a `background-color: var(--hazel)` fallback, `background-attachment: fixed` and `min-height: 100vh`. On iOS Safari the gradient is painted on a fixed `body::before` layer instead. Gradient stops are never darker than `#938563`.

Plum cards use the `.surface-plum` class: the surface gradient, 1.125rem padding, a 1px pink border at 40%, `--radius`, `--shadow-soft`, a 1px inner top highlight (`inset 0 1px 0 rgb(244 239 231 / 0.08)`), and the theme re-map (ivory text, pink primary buttons with plum-ink text, an ivory focus ring, light hairlines, pink-tinted labels). Only compact vendor/event cards lift 2px and use `--shadow-lift` on pointer hover; headers, the auth hero and dialogs can drop the card chrome with utilities.
Brass (rose): max one highlight per screen.

## Typography
- Headlines: Fraunces, weight 300 to 400, letter-spacing -0.01em, line-height 1.05 to 1.15. Display `clamp(2.5rem, 5.5vw, 4.25rem)` at weight 300 and -0.02em, h1 `clamp(2rem, 4vw, 3rem)`, h2 1.5rem.
- Body and UI: Inter, 1rem/1.65, max 65ch.
- Label: 0.75rem, uppercase, letter-spacing 0.18em, weight 500, `--label` (ink on hazel, pink tint on plum).
- Load with `next/font`, with fallback stacks.

## Layout
- App shell (signed-in pages): fixed left sidebar, 16rem, from 1024px; stone surface, 1px hairline on its right. Top: "Allora" wordmark in serif. Middle: nav for the user's role. Bottom: user name, role label (small uppercase), Log out. No topbar on desktop. Login and sign-up have no sidebar.
- Nav (text labels with small lucide icons): customer: My events (/), New event (/events/new). Vendor: Bookings (/vendor), Calendar (/vendor/calendar), Profile (/vendor/profile). Add items only for pages that exist on main. Active item: forest text, 10% forest tint, 2px forest bar on the left; match by route prefix (/events/[id] highlights My events); aria-current="page".
- Below 1024px: the sidebar is a drawer (shadcn Sheet) opened from a slim top bar with a menu button and the wordmark; it closes on navigation and Escape; focus is trapped and returned to the button.
- The main area scrolls on its own, the sidebar stays put. Role comes from GET /api/me, with skeleton items while loading. A vendor never sees customer items and the reverse. Not collapsible (Assumption). Reduced motion: no drawer animation.
- Content max-width 72rem. Section spacing 4rem desktop, 2.5rem mobile. Gaps between cards 0.875rem.
- 1px hairline dividers instead of boxes. Cards are compact: `.surface-plum`, 1.125rem padding, 0.5rem between image, label, title and row. On hover (pointer devices only) a card lifts 2px and switches to `--shadow-lift`, 200ms. Touch targets stay at least 44px: compact means less padding and smaller media, never smaller tap areas.
- Header: plum gradient, 48px tall on mobile and 56px from 640px, "Allora" wordmark in serif, user name and log out on the right, hairline below.

## Components (shared, build once)
- `PageHeader`: label, serif title, optional description, then a short gradient rule (`linear-gradient(90deg, var(--pink), transparent)`, 1px, full content width) that draws left to right. This is the one highlight per screen.
- `StatusBadge`: ivory fill with a 1px border and matching text. Pending = plum, confirmed = dark green `#1f3a32`, declined = brick. Always shows the text label.
- `ImagePlaceholder`: soft gradient (plum-light to pink) plus a plum-ink caption. Default aspect 16/9, rounded to `calc(var(--radius) - 0.25rem)`. Props: caption, aspect, optional src. Without src it renders the placeholder with a `data-placeholder` attribute and a `PLACEHOLDER: replace with photography` code comment. With src it renders the real image. Every placeholder uses this component only. Captions are warm, natural-light moments, e.g. "Table setting, natural light", "Long table, candlelight", "Venue interior, morning light".
- `Reveal`: fade-up wrapper.
- Buttons: primary = plum with ivory text (pink with plum-ink text on plum surfaces), pill, 44px height. Secondary = transparent with a 1px border at 40% of the text color. Inputs and selects: ivory, 1px border at 45% ink, radius 0.75rem, 48px height, small uppercase label above. Alerts: ivory fill (plum-ink text, or brick text and border for errors). Skeletons: same shape as the compact cards, ink at 12% with a faint shimmer. Icons: lucide only, thin stroke, functional only (arrows, chevrons).

## Motion
- Fade-up: translateY 12px to 0 and opacity 0 to 1, 600ms, `cubic-bezier(0.22, 1, 0.36, 1)`, once, stagger max 80ms, via IntersectionObserver.
- Signature (Assumption, replace when section 4 arrives): the brass hairline under a `PageHeader` draws left to right (scaleX 0 to 1, 900ms), then content fades up.
- `prefers-reduced-motion`: no transforms or animations, content shows immediately.

## Hero and texture
Paper grain (inline SVG noise, about 5% opacity, via a `.paper-grain` class) on the login and sign-up hero panel only, with a soft radial wash of pink at 12% opacity in one corner.

## Screens
- `/login`, `/signup`: two columns from 1024px. Left hero panel: plum gradient, grain, pink wash, serif display headline in ivory, one `ImagePlaceholder`. Right: the form on the page gradient. On mobile the hero shrinks to a compact strip with the wordmark and one line, no image. Short, warm copy, no exclamation marks.
- `/`: `PageHeader` ("Your events"), event cards in a grid (2 columns from 640px, 3 from 1280px). Each compact card has an `ImagePlaceholder` by event type, then the type, and date, budget and guests in a single row separated by hairlines.
- `/events/[id]`: `PageHeader` with the event type and date. A stats row (budget, guests) separated by hairlines. Bookings as compact hairline-separated rows (0.75rem vertical padding): category label, vendor name in serif, price right-aligned, `StatusBadge`; one line on desktop.
- `/events/[id]/vendors`: category tabs as plain text with a rose underline on the active one, not pills. Compact vendor cards (16/9 `ImagePlaceholder`, name, price, Book button of at least 5.5rem), see SPEC-vendors-ui.md.
- `/vendor`: compact two-line booking rows (event type and status, then category, date and guests, with the action buttons on the right), stacked below 640px.
- All loading, empty, error and 404 states keep their behavior and get the same styling. Prices and budgets are plain numbers with no currency symbol.

## Out of scope
Dark theme, a landing page, dependencies, data or API changes, behavior changes.

## Accessibility
Body text at least 4.5:1. Visible focus ring (2px, 2px offset): ink on hazel, ivory on plum surfaces. Contrast checked for: ink on the lightest and darkest page gradient stops, ivory on plum and plum-deep, plum-ink on pink and on plum-light. Touch targets at least 44px. Works at 375px width.
