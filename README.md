# Framing Takeoff Toolkit

Wood framing takeoff toolkit for construction estimating. Upload PDF blueprints, measure on-plan, calculate material and labor costs for walls, floors, and roofs, then generate a bid summary.

## Features

- **PDF Scanner** — Upload construction plans and auto-extract dimensional callouts, framing references, and room labels
- **On-Plan Measuring** — Calibrate scale on the PDF, then click-to-measure any distance directly on the plan
- **Wall Takeoff** — Stud counts (with waste), plate calculations, sheathing sheets, material + labor costs
- **Floor Takeoff** — Joist counts, subfloor sheets, hanger quantities, material + labor costs
- **Roof Takeoff** — Rafter counts by pitch factor, sheathing, hurricane ties, material + labor costs
- **Bid Summary** — Aggregates all takeoff totals, add extras (blocking, hardware, misc), apply markup, calculate $/SF
- **Quick Reference** — Standalone calculators for studs, board feet, sheathing, headers, and joists

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
  theme.js                    # Colors, fonts, shared style objects
  constants.js                # Lumber prices, labor rates, pitch factors
  main.jsx                    # React entry point
  App.jsx                     # Main app shell, tab navigation, state management
  utils/
    parsers.js                # PDF text parsing (dimensions, framing refs, rooms)
  components/
    ui.jsx                    # Reusable UI primitives (NumberInput, SelectInput, ResultCard, Section, Row, Button)
    PdfScanner.jsx            # PDF upload, text extraction, on-plan measuring tool
    WallTakeoff.jsx           # Wall framing calculator
    FloorTakeoff.jsx          # Floor framing calculator
    RoofTakeoff.jsx           # Roof framing calculator
    BidSummary.jsx            # Bid summary with markup and $/SF
    QuickReference.jsx        # Standalone quick-reference calculators
```

## Tech Stack

- React 18
- Vite
- PDF.js (loaded from CDN at runtime for PDF parsing and rendering)

## Pricing Data

Lumber prices and labor rates are defined in `src/constants.js`. Update these values to match your local market.
