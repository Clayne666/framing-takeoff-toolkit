# Framing Takeoff Toolkit

Wood framing takeoff toolkit for construction estimating. Upload PDF blueprints, measure on-plan with calibrated scale tools, calculate material and labor costs for walls, floors, and roofs, then generate a bid summary with markup.

Built by [LeanAmp Technologies](https://leanamp.com).

## Features

- **PDF Scanner & Extraction** — Upload multi-page construction plans; auto-extracts dimensional callouts, framing references, room labels, wall schedules, door/window schedules, and general notes. AI-assisted extraction available for floor plans and structural sheets.
- **Background Scanning** — PDF processing runs non-blocking. Switch to other tabs (Walls, Floors, Roof) while scanning continues. Progress bar shows real-time status in the tab nav.
- **On-Plan Measuring** — Calibrate scale with known-distance tool (with quick presets for common lengths), then measure linear distances, polyline wall traces, polygon areas, and item counts directly on the PDF.
- **Horizontal Toolbar** — Grouped tool palette (Navigate, Scale, Measure) with contextual instruction bar and dedicated Pan tool for easy navigation.
- **Takeoff Conditions** — Create named conditions (e.g., "Exterior Walls", "Interior Partitions") with colors, assign measurements, then bulk-send to takeoff tabs.
- **Wall Takeoff** — Stud counts with waste factor, top/bottom plate calculations, sheathing sheets, header sizing, material + labor costs.
- **Floor Takeoff** — Joist counts by spacing, subfloor sheets, rim board, hanger quantities, material + labor costs.
- **Roof Takeoff** — Rafter counts by pitch factor, sheathing, ridge board, hurricane ties, material + labor costs.
- **Bid Summary** — Aggregates all takeoff totals, add extras (blocking, hardware, misc), apply markup percentage, calculate $/SF.
- **Project Dashboard** — Create, rename, archive, and manage multiple projects with auto-save and thumbnail previews.
- **AI Agent System** — Self-learning agents that observe your workflow, suggest smart defaults, enhance extraction results, and improve over time.
- **Quick Reference** — Standalone calculators for studs, board feet, sheathing, headers, and joists.
- **Toast Notifications** — Non-intrusive status updates (scan complete, data populated) that auto-dismiss.

## Prerequisites

- **Node.js 18+** (tested on v24.12.0)
- **npm 9+** (tested on v11.6.2)

If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/). The LTS version is recommended. npm comes bundled with Node.js.

To check if you already have them:

```bash
node --version
npm --version
```

## Getting Started (Step by Step)

### 1. Open a terminal

- **Windows:** Open PowerShell or Command Prompt. Press `Win + R`, type `cmd`, press Enter.
- **Mac:** Open Terminal (Applications > Utilities > Terminal).

### 2. Navigate to the project folder

```bash
cd C:\Users\Public\Documents\Development\framing-takeoff-toolkit
```

### 3. Install dependencies (first time only)

```bash
npm install
```

This downloads React, Vite, and other packages into a `node_modules/` folder. Takes about 30 seconds. You only need to do this once, or again if you delete `node_modules/`.

### 4. Start the development server

```bash
npm run dev
```

You'll see output like:

```
  VITE v5.4.21  ready in 300 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 5. Open in your browser

Go to **http://localhost:5173** in Chrome, Edge, or Firefox.

The app is now running. Any changes you make to source files will hot-reload instantly in the browser.

### 6. Stop the server

Press `Ctrl + C` in the terminal to stop the dev server.

## Building for Production

To create an optimized production build:

```bash
npm run build
```

This outputs minified files to the `dist/` folder (~294 KB). To preview the production build locally:

```bash
npm run preview
```

Then open **http://localhost:4173** in your browser.

### Deploying the production build

The `dist/` folder is a static site. You can deploy it to any static hosting:

- **Drop it on a web server** — Copy the `dist/` folder contents to your web server's public directory
- **Netlify / Vercel / Cloudflare Pages** — Point the build command to `npm run build` and the output directory to `dist`
- **Open locally** — Double-clicking `dist/index.html` won't work (the app needs to be served over HTTP). Use `npm run preview` instead.

## How to Use the App

### Creating a project

1. On the **Dashboard**, click **+ New Project**
2. Give it a name (e.g., "Smith Residence" or "Job #2451")
3. Click the project card to open it

### Uploading plans

1. Inside a project, you start on the **Plans** tab
2. Click **Upload PDF** and select your construction plan PDF
3. Pages are extracted and displayed progressively — you can switch to other tabs while scanning runs in the background
4. The progress bar in the tab navigation shows scanning status

### Setting scale

1. In the Plan Viewer, click the **Scale** tool in the toolbar
2. Click two endpoints of a known dimension on the plan (e.g., a wall you know is 12 feet)
3. Enter the real-world distance — or click a **Quick preset** button (1', 2', 4', 8', 10', 12', 16', 20')
4. Click **Confirm**
5. Optionally use the **Verify** tool to check accuracy against other known dimensions

### Taking measurements

1. Select a measurement tool from the toolbar:
   - **Linear** — Click two points to measure a straight line
   - **Polyline** — Click multiple points to trace a wall path, double-click to finish
   - **Area** — Click polygon corners, double-click to close and calculate square footage
   - **Count** — Click items to count them (e.g., windows, posts)
2. Use the **Pan** tool (hand icon) or hold **Shift + click-drag** to pan around the plan
3. Scroll to zoom in/out
4. Press **Esc** to deactivate any tool

### Conditions (grouping measurements)

1. Click **+ Add Condition** below the plan viewer
2. Name it (e.g., "Exterior Walls", "Interior Non-Bearing")
3. Select the condition, then take measurements — they're automatically grouped
4. Click **Send to Takeoff** to push condition measurements to the Walls/Floors/Roof tabs

### Running takeoffs

1. Switch to the **Walls**, **Floors**, or **Roof** tab
2. Measurements from the plan viewer auto-populate if you used **Auto-Populate**
3. Adjust stud spacing, plate count, sheathing, waste factors, prices
4. Costs calculate automatically

### Generating a bid

1. Go to the **Estimate** tab
2. Review aggregated costs from all takeoff tabs
3. Add extras (blocking, hardware, delivery, misc)
4. Set markup percentage
5. See total bid and $/SF

## Project Structure

```
src/
  theme.js                          # STACK-inspired theme — dark chrome, light content, blue primary
  constants.js                      # Lumber prices, labor rates, pitch factors
  main.jsx                          # React entry point
  App.jsx                           # Main app shell, tab nav, project state, toast system, scan progress
  components/
    ui.jsx                          # Reusable primitives (NumberInput, SelectInput, ResultCard, Section, Row, Button)
    PdfScanner.jsx                  # PDF upload, extraction pipeline, on-plan measuring, horizontal toolbar
    WallTakeoff.jsx                 # Wall framing calculator
    FloorTakeoff.jsx                # Floor framing calculator
    RoofTakeoff.jsx                 # Roof framing calculator
    BidSummary.jsx                  # Bid summary with markup and $/SF
    ProjectDashboard.jsx            # Project list, create/open/archive projects
    QuickReference.jsx              # Standalone quick-reference calculators
  utils/
    parsers.js                      # PDF text parsing (dimensions, framing refs, rooms)
    spatialText.js                  # Spatial text extraction from PDF.js text content
    pageClassifier.js               # Classifies PDF pages by type (floor plan, schedule, notes, etc.)
    extractionResult.js             # Creates and merges structured extraction results
    scheduleParser.js               # Parses wall type and door/window schedule tables
    notesParser.js                  # Parses general notes sheets
    aiExtractor.js                  # AI-assisted extraction via API (floor plans, structural sheets)
    takeoffMapper.js                # Maps extraction results to wall/floor/roof import data
    conditionMapper.js              # Maps takeoff conditions to measurement groups
    projectStore.js                 # IndexedDB-backed project storage, auto-save, plan file storage
  agents/
    agentContext.jsx                # React context provider for agent system
    AgentInsights.jsx               # AI insights dashboard component
    agentStore.js                   # Persistent agent data storage
    behaviorTracker.js              # Tracks user workflow patterns
    extractionEnhancer.js           # Agent that enhances raw extraction results
    learningEngine.js               # Self-learning engine that improves from observations
    smartDefaultsAgent.js           # Suggests smart defaults for takeoff settings
    templateAgent.js                # Project template agent
```

## Tech Stack

- **React 18.2** — UI framework (all inline styles, no CSS files)
- **Vite 5** — Build tool and dev server
- **PDF.js 3.11** — Loaded from CDN at runtime for PDF parsing and rendering
- **IndexedDB** — Client-side project and plan file storage (via projectStore.js)

## Pricing Data

Lumber prices and labor rates are defined in `src/constants.js`. Update these values to match your local market.

## UI Theme

The app uses a STACK Construction Technologies-inspired theme defined in `src/theme.js`:
- Dark chrome (nav bar, sidebar, toolbar backgrounds)
- Light content areas for readability
- Blue primary accent (`#3b82f6`)
- Inter font family for UI, JetBrains Mono for numbers

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Make sure Node.js 18+ is installed. Run `node --version` to check. |
| `npm run dev` says "port 5173 in use" | Another process is using that port. Either stop it, or run `npx vite --port 3000` to use a different port. |
| Page is blank after opening | Open browser dev tools (F12) and check the Console tab for errors. Make sure you're at `http://localhost:5173`, not a file:// URL. |
| PDF won't upload | The app accepts `.pdf` files only. Very large PDFs (50+ pages) may take a moment — watch the progress bar. |
| Scale seems wrong | Use the **Verify** tool to check against a second known dimension. If accuracy is below 95%, re-calibrate with the Scale tool. |
| Changes not showing | Vite hot-reloads automatically. If stuck, hard-refresh with `Ctrl + Shift + R`. |
| `node_modules` missing | Run `npm install` from the project folder. |
| Build fails | Run `npm run build` and check the error output. Most common issue is a syntax error in a `.jsx` file. |

## Keyboard Shortcuts (Plan Viewer)

| Key | Action |
|-----|--------|
| `1`-`8` | Activate tool by position (Select, Pan, Scale, Verify, Linear, Polyline, Area, Count) |
| `Esc` | Deactivate current tool, cancel in-progress measurement |
| `Ctrl+Z` | Undo last measurement or condition |
| `Delete` | Remove selected measurement |
| `Enter` | Finish polyline/area measurement |
| `Scroll` | Zoom in/out (centered on cursor) |
| `Shift + Drag` | Pan the view |
| `Middle-click Drag` | Pan the view (alternate) |
