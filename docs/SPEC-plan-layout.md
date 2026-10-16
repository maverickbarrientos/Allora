# SPEC-plan-layout.md

## Goal
The plan page (`/events/[id]`) is easier to read, and the planning assistant is easy to find: it floats at the corner of the screen instead of sitting at the very bottom of a long page.

## Supersedes
- SPEC-chatbot.md: where the assistant appears (a floating panel, not a section at the bottom of the plan). What it says and does is unchanged.

## Out of scope
Any change to the API, data, matching or what the assistant answers; saving the conversation (still not saved); showing the assistant on other pages; new dependencies; changes to the other sections of the plan (services, budgets, "What's missing").

## UI
- **Bookings:** each booking is its own block. Top row: category label and vendor name (a link to the vendor page, wraps when long) on the left, status badge and price on the right. Below a divider: the actions on the left (payment line or Pay deposit, Request cancellation, Message with its unread count) and Contract and Receipt on the right. On a phone the actions wrap onto separate lines and nothing scrolls sideways. Nothing about what each booking shows or does has changed.
- **Floating assistant:**
  - A button "Ask the assistant" is fixed at the bottom-right of the plan page and stays there while scrolling. The page has extra space at the bottom so it never hides content.
  - Opening it shows a panel at the bottom-right (full width with small margins on a phone): title and event name, a close button, the conversation, the quick questions and the message box. The cursor goes to the message box.
  - Closing (the close button or Escape) hides the panel and puts focus back on the button. The conversation is kept while the page stays open, even while the panel is closed. A reload clears it, as before.
  - If an answer arrives while the panel is closed, the button shows a small dot (and "new answer" for screen readers) until it is opened.
  - The panel is a dialog that doesn't block the page behind it. Neither the button nor the panel is printed.

## Acceptance criteria
1. Each booking shows category, vendor name, status, price, its actions and Contract and Receipt, with the same actions as before.
2. A very long vendor name wraps and never makes a block or the page scroll sideways, at 1280px and 375px.
3. The assistant button is visible at the bottom-right without scrolling, still visible after scrolling to the bottom, and the last content scrolls clear of it.
4. The button opens the panel with Enter; the message box gets focus; Escape closes it and focus returns to the button.
5. The conversation survives closing and reopening; a reply that arrives while closed shows the dot, and opening clears it.
6. On a phone the panel fits the screen, and the message box, Send and Close are reachable.
7. Nothing is printed for the button or the panel.
