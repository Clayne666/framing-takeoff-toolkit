# CLAUDE.md — Framing Takeoff Toolkit

## Project Overview

Construction estimating SPA for wood framing takeoffs. Users upload PDF blueprints, measure on-plan, calculate material/labor costs, and generate bids. Built for framers and estimators.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build to dist/ (~294KB, 58 modules)
npm run preview  # Preview production build
```

## Architecture

### Stack
- **React 18.2** with Vite 5 — zero CSS files, all **inline styles** via JavaScript objects
- **PDF.js 3.11** loaded from CDN at runtime (not bundled)
- **IndexedDB** for client-side persistence (projects, plan files, agent data)
- No router — single-page with `view` state (`"dashboard"` | `"workspace"`) and `activeTab` for tab switching

### Key Patterns

**Inline styles everywhere.** Never use CSS files, className, or CSS-in-JS libraries. All styling is done through `style={{ }}` props with values from `src/theme.js` color/font tokens.

**Theme tokens.** Always use `colors.*` and `fonts.*` from `src/theme.js` — never hardcode hex values except `#fff`/`#ffffff`. The theme has two layers:
- Dark chrome: `navBg`, `toolbarBg`, `sidebarBg` (for headers, nav, toolbars)
- Light content: `contentBg`, `contentAlt`, `inputBgLight` (for workspace areas)

**Component mounting.** PdfScanner uses `display: none` pattern (not conditional render) so it stays mounted during tab switches — scanning continues in background. Other takeoff tabs (Walls, Floors, Roof, Bid) also use `display: none` with `key` prop for workspace resets.

**State lives in App.jsx.** All cross-tab state (extraction results, import data, project data, scan progress, toasts) is owned by App.jsx and passed down as props. Individual tabs own their own internal UI state.

**Progressive rendering.** The PDF extraction pipeline (`runExtraction` in PdfScanner.jsx) uses `yieldToMain()` between pages to keep the UI responsive, and pushes page images incrementally via `setPageImages(prev => [...prev, imgData])`.

**Agent system.** Self-learning agents in `src/agents/` observe user behavior, suggest defaults, and enhance extraction. Access via `useAgent()` hook from `agentContext.jsx`.

### File Responsibilities

| File | Lines | Role |
|------|-------|------|
| `App.jsx` | ~520 | Shell, tabs, project state, toasts, scan progress |
| `PdfScanner.jsx` | ~1560 | PDF upload, 3-pass extraction, on-plan measuring tools, canvas overlay |
| `WallTakeoff.jsx` | ~600 | Wall framing calculator with material/labor breakdown |
| `FloorTakeoff.jsx` | ~500 | Floor framing calculator |
| `RoofTakeoff.jsx` | ~500 | Roof framing calculator |
| `BidSummary.jsx` | ~400 | Aggregated bid with markup |
| `ProjectDashboard.jsx` | ~350 | Project list CRUD |
| `theme.js` | ~80 | Color tokens, font stacks |
| `constants.js` | ~100 | Lumber prices, labor rates, pitch factors |

### PdfScanner Tool System

Tools are defined in `TOOLS` array and grouped in `TOOL_GROUPS` for the horizontal toolbar:
- **Navigate:** Select, Pan
- **Scale:** Scale, Verify
- **Measure:** Linear, Polyline, Area, Count

`TOOL_INSTRUCTIONS` maps each tool ID to a user-facing instruction string shown in the instruction bar.

Panning works via: pan tool left-click, middle-click, or shift+left-click. Zoom via scroll wheel with cursor-centered zoom math.

### Extraction Pipeline (PdfScanner.jsx)

1. **Pass 1** — Per-page: extract text → spatial analysis → classify page type → parse dims/refs/rooms → render page image (progressive)
2. **Pass 2** — Parse schedules (wall types, door/window) and general notes from classified pages
3. **Pass 3** (optional) — AI extraction for floor plans and structural sheets via `aiExtractor.js`

Results flow: `runExtraction` → `onExtractionComplete` prop → App.jsx state → `buildWallImportData`/`buildFloorImportData`/`buildRoofImportData` → prop down to takeoff tabs.

## Coding Conventions

- **No CSS files.** Inline styles only, using theme tokens.
- **No TypeScript.** Plain JSX with `.jsx` extensions.
- **No external UI libraries.** Custom `ui.jsx` primitives (Section, Row, Button, NumberInput, SelectInput, ResultCard).
- **useCallback for handlers.** All handlers passed as props or with dependencies use `useCallback`.
- **Functional state updates.** Use `setState(prev => ...)` for any state that accumulates (measurements, pages, toasts).
- **Compact JSX.** Dense inline styles on single lines are normal in this codebase. Don't reformat to multi-line unless necessary.
- **Color references:** Use `colors.primary` (blue), `colors.success`/`colors.green`, `colors.accent` (amber), `colors.rose` (error), `colors.muted`/`colors.dim` (secondary text). Never use old dark-theme tokens (`colors.card`, `colors.surface`, `colors.raised`) in UI — use `colors.contentBg`, `colors.contentAlt`, `colors.inputBgLight` instead.

## Common Tasks

### Adding a new measurement tool
1. Add entry to `TOOLS` array with `id`, `label`, `icon`, `tip`
2. Add to appropriate group in `TOOL_GROUPS`
3. Add instruction text to `TOOL_INSTRUCTIONS`
4. Handle click logic in `handleCanvasClick` switch
5. Handle double-click finish in `handleCanvasDoubleClick` if multi-point
6. Add rendering in `drawOverlay` for active points and completed measurements

### Adding a new takeoff tab
1. Create component in `src/components/`
2. Add tab entry to `TABS` array in App.jsx
3. Add state for import data and initial state in App.jsx
4. Add `display: none` wrapper in the workspace content area
5. Wire up `onStateChange` handler for auto-save

### Modifying the theme
Edit `src/theme.js`. The theme uses two-layer approach:
- **Dark chrome** (`navBg: "#1a1f2e"`) for navigation elements
- **Light content** (`contentBg: "#ffffff"`) for workspace/forms
- **Primary blue** (`primary: "#3b82f6"`) for accents, active states, CTAs

## Gotchas

- PdfScanner is ~1560 lines. Make targeted edits, don't rewrite. Use Grep to find specific sections.
- The canvas overlay (`drawOverlay`) is called on every state change via useEffect — it reads all measurements, active points, cursor pos, conditions, and redraws. Heavy function.
- `scalePixels` / `scaleFeet` are the calibration values. All `pxToFeet` conversions depend on these being set.
- The `pageImages` state holds full data URLs for each PDF page — can be large in memory for big plans.
- Toast IDs use `Date.now()` — don't create multiple toasts in the same millisecond.
- `workspaceKey` state forces takeoff components to remount when switching projects (prevents stale state bleed).
