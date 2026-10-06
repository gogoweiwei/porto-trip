# Porto · 18–21 October 2026

A small static site with our day-by-day plan. Published with GitHub Pages;
shared by link only (the page carries a `noindex` tag).

## How it is put together

| File | What it is |
|---|---|
| `trip.json` | **All the content** — days, stops, bookings, walking times, reel links. Edit this to change the plan. |
| `index.html` | Page shell (hero, tab bar, footer). |
| `app.js` | Renders `trip.json` into the page; tabs, "Now" marker, checklist. |
| `styles.css` | Styling. |
| `.nojekyll` | Tells GitHub Pages to publish the files as-is. |

## Editing the plan (phone-friendly)

1. Open `trip.json` on GitHub and tap the pencil (Edit) icon.
2. Change text, times or add a stop — keep the JSON valid (matching quotes
   and commas; no trailing comma after the last item in a list).
3. "Commit changes". The live page updates within about ten minutes.

If the page ever shows *"Couldn't load trip.json"*, the last edit broke the
JSON — open the file's history and revert the commit, or paste the file into a
JSON validator to find the typo.

### Stop fields

The `//` notes below are explanations only — real JSON cannot contain comments.

```json
{
  "time": "09:45",
  "name": "Torre dos Clérigos",
  "kind": "see",            // eat | see | move | rest | shop
  "what": "What we do here.",
  "why": "Why this day and hour.",
  "logistics": "Tickets, queues, directions (optional)",
  "book": "Booking note (optional)",
  "q": "Maps search text (optional)",
  "reel": 4,                // index into "reels" (optional)
  "travel": "7 min walk",   // shown between stops (optional)
  "optional": true          // marks the stop as skippable (optional)
}
```

## Changing the look

If you edit `app.js` or `styles.css`, bump the `?v=…` tokens on their two
`<link>`/`<script>` lines in `index.html` so browsers fetch the new files.
