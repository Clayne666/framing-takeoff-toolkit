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

## Prerequisites

- **Node.js** >= 18.0.0 (includes npm)
- A modern browser (Chrome, Firefox, Edge, Safari)

### Install Node.js

**macOS** (using Homebrew):
```bash
brew install node
```

**Windows** (using installer):
Download from https://nodejs.org/ and run the installer (LTS version recommended).

**Linux** (Ubuntu/Debian):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify installation:
```bash
node --version   # should print v18.x.x or higher
npm --version    # should print 9.x.x or higher
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Clayne666/framing-takeoff-toolkit.git
cd framing-takeoff-toolkit
```

### 2. Install dependencies

```bash
npm install
```

This installs:
- `react` and `react-dom` (UI framework)
- `vite` and `@vitejs/plugin-react` (dev server and build tool)

### 3. Start the development server

```bash
npm run dev
```

Open http://localhost:5173 in your browser. Vite provides hot module replacement — edits appear instantly without a full page reload.

### 4. (Optional) Build for production

```bash
npm run build
```

This outputs optimized, minified files to the `dist/` directory.

### 5. (Optional) Preview the production build locally

```bash
npm run preview
```

This serves the contents of `dist/` at http://localhost:4173 so you can verify the production build before deploying.

## All Available Commands

| Command             | Description                                          |
|---------------------|------------------------------------------------------|
| `npm install`       | Install all project dependencies                     |
| `npm run dev`       | Start Vite dev server at http://localhost:5173        |
| `npm run build`     | Create production build in `dist/`                   |
| `npm run preview`   | Serve production build at http://localhost:4173       |

## Project Structure

```
framing-takeoff-toolkit/
├── index.html                          # Entry HTML (loads src/main.jsx)
├── package.json                        # Dependencies and npm scripts
├── vite.config.js                      # Vite + React plugin config
├── .gitignore                          # Ignores node_modules, dist, .env, logs
├── README.md                           # This file
├── framing_takeoff_toolkit.jsx         # Original single-file source (pre-refactor)
└── src/
    ├── main.jsx                        # React 18 entry point (createRoot)
    ├── App.jsx                         # App shell, tab nav, lifted state
    ├── theme.js                        # Colors, fonts, shared style objects
    ├── constants.js                    # Lumber prices, labor rates, pitch factors
    ├── utils/
    │   └── parsers.js                  # PDF text parsing (dimensions, framing refs, rooms)
    └── components/
        ├── ui.jsx                      # Reusable primitives: NumberInput, SelectInput, ResultCard, Section, Row, Button
        ├── PdfScanner.jsx              # PDF upload, text extraction, on-plan measuring tool
        ├── WallTakeoff.jsx             # Wall framing calculator
        ├── FloorTakeoff.jsx            # Floor framing calculator
        ├── RoofTakeoff.jsx             # Roof framing calculator
        ├── BidSummary.jsx              # Bid summary with markup and $/SF
        └── QuickReference.jsx          # Standalone quick-reference calculators (studs, board feet, sheathing, headers, joists)
```

## Tech Stack

- **React 18** — UI framework (hooks: useState, useMemo, useCallback, useRef, useEffect)
- **Vite 5** — Dev server with hot module replacement and production bundler
- **PDF.js 3.11.174** — PDF parsing and rendering (loaded from CDN at runtime, no npm dependency)
- **Google Fonts** — Inter (UI text) and JetBrains Mono (numeric/code values)

## Pricing Data

Lumber prices, labor rates, and pitch factors are defined in `src/constants.js`. Update these values to match your local market:

```js
// src/constants.js
export const LUMBER_PRICES = {
  "2x4Stud": 4.28,        // per stud
  "2x4_16ft": 10.98,      // per 16' length
  "2x6Stud": 6.78,
  // ... etc
};

export const LABOR_RATES = {
  wallPerLinearFoot: 8.50, // $/LF for wall framing
  floorPerSquareFoot: 3.25,// $/SF for floor framing
  roofPerSquareFoot: 4.50, // $/SF for roof framing
};
```

## Deployment

After running `npm run build`, deploy the `dist/` folder to any static hosting provider:

- **Netlify**: Drag and drop the `dist/` folder, or connect your repo and set build command to `npm run build` with publish directory `dist`
- **Vercel**: Import the repo, framework preset will auto-detect Vite
- **GitHub Pages**: Push `dist/` contents to `gh-pages` branch, or use a GitHub Action
- **Any static server**: Serve `dist/index.html` with fallback to `index.html` for client-side routing
