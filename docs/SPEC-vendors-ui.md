## Goal
Redesign `/events/[id]/vendors` to be compact, simple and easy on the eye. Frontend only: no backend, API, schema, RLS, env or behavior changes. Use only data the page already receives.

## Rules
- Use the tokens and shared components in docs/DESIGN.md. Do not create new tokens or restyle shared components.
- New components are page-local: `VendorCard` and `CategoryTabs`.
- If SPEC-vendor-upgrades.md changes anything this page depends on, follow it.

## Layout (top to bottom)
1. `PageHeader`: label "Vendors", serif title, one-line description naming the event type, hairline below.
2. `CategoryTabs`: plain uppercase label-style text with a plum underline on the active tab (the one highlight on this screen). No pills. One row, horizontally scrollable on mobile with the scrollbar hidden. The active tab scrolls into view. Sticky below the header on mobile.
3. Vendor grid: 3 columns from 1024px, 2 from 640px, 1 below. Gap 1rem.

## Vendor card
- `.surface-plum` card exactly as DESIGN.md defines it. No overrides to padding, border, radius or shadow.
- `ImagePlaceholder`, aspect 16/10, with a caption by category (e.g. "Venue interior, morning light", "Long table, candlelight").
- Below the image, in this order:
  1. Category label (label style, pink tint)
  2. Vendor name (serif, one line, truncated with an ellipsis)
  3. Row: price left (plain number, no currency symbol) and the Book button right
- Book button: pink pill, plum-ink text, 44px height, min width 6rem.
- Nothing else on the card: no description, no extra badges.

## Interaction
- Hover (pointer devices only): card lifts 2px and the shadow deepens slightly, 200ms. No hover effects on touch.
- Switching tabs: the underline slides to the new tab (200ms). Grid content fades up once, with stagger of at most 80ms.
- Book keeps its existing behavior. While the request runs, the button is disabled and its text changes (no spinner).
- With `prefers-reduced-motion`: no transforms or animations, content shows immediately.

## States
- Loading: 6 skeleton cards in the same grid and card size.
- Empty category: one centered serif line and one secondary button back to the first category.
- Error: ivory alert with brick text and border, plus a retry button.
- 404: existing behavior, styled per DESIGN.md.

## Accessibility
- Tabs: `role="tablist"`, arrow keys move between tabs, selected state announced.
- Body text at least 4.5:1. Visible focus ring: ivory on plum, ink on hazel. Touch targets at least 44px.
- Works from 375px width with no horizontal page scroll (only the tab row scrolls).

## Out of scope
Search, sort, filters, vendor detail pages, new data fields, new dependencies, dark theme, backend changes.

## Done when
- The page uses DESIGN.md tokens and shared components, with no new tokens.
- Cards stay compact with a 60+ character vendor name, 0 vendors, 1 vendor and 20+ vendors.
- Switching categories and booking work as before.
- `git diff` shows no backend files and no changes to `globals.css` tokens or shared components.