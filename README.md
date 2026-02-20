# Framing Takeoff Toolkit

Wood framing takeoff toolkit for construction estimating. Upload PDF blueprints, measure on-plan, calculate material and labor costs for walls, floors, and roofs, then generate a bid summary.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [How to Use the Application](#how-to-use-the-application)
5. [Customizing Prices and Rates](#customizing-prices-and-rates)
6. [All Available Commands](#all-available-commands)
7. [Building for Production](#building-for-production)
8. [Deploying to a Web Server](#deploying-to-a-web-server)
9. [Project Structure](#project-structure)
10. [Tech Stack](#tech-stack)
11. [Troubleshooting](#troubleshooting)

---

## Features

- **PDF Scanner** — Upload construction plans (PDF) and auto-extract dimensional callouts, framing references, and room labels
- **On-Plan Measuring** — Calibrate scale on the PDF, then click-to-measure any distance directly on the plan
- **Wall Takeoff** — Stud counts (with waste), plate calculations, sheathing sheets, material + labor costs
- **Floor Takeoff** — Joist counts, subfloor sheets, hanger quantities, material + labor costs
- **Roof Takeoff** — Rafter counts by pitch factor, sheathing, hurricane ties, material + labor costs
- **Bid Summary** — Aggregates all takeoff totals, add extras (blocking, hardware, misc), apply markup, calculate $/SF
- **Quick Reference** — Standalone calculators for studs, board feet, sheathing, headers, and joists

---

## Prerequisites

You need two things installed on your computer before you can run this project:

1. **Git** — to clone (download) the repository
2. **Node.js** (version 18 or higher) — which includes **npm** (the package manager that installs dependencies)

### Check if you already have them

Open a terminal (Terminal on Mac, Command Prompt or PowerShell on Windows, or any terminal on Linux) and run:

```bash
git --version
```

You should see something like `git version 2.39.0`. If you get "command not found", install Git first (see below).

```bash
node --version
```

You should see `v18.x.x` or higher (e.g., `v20.11.0`). If you get "command not found" or a version below 18, install Node.js (see below).

```bash
npm --version
```

You should see `9.x.x` or higher (e.g., `10.2.4`). npm is bundled with Node.js, so if Node.js is installed correctly, npm will be available.

### Installing Git

**macOS:**
```bash
# Git is included with Xcode Command Line Tools. Install them by running:
xcode-select --install
# A popup will appear — click "Install" and wait for it to finish.
```

**Windows:**
1. Go to https://git-scm.com/download/win
2. Download the installer and run it
3. Use the default settings through the installer wizard
4. After installation, close and reopen your terminal, then run `git --version` to verify

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y git
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install git
```

### Installing Node.js

**macOS (using Homebrew):**
```bash
# Install Homebrew first if you don't have it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Node.js:
brew install node
```

**macOS (without Homebrew):**
1. Go to https://nodejs.org/
2. Download the **LTS** (Long Term Support) installer for macOS
3. Open the downloaded `.pkg` file and follow the installer prompts
4. Close and reopen your terminal, then run `node --version` to verify

**Windows:**
1. Go to https://nodejs.org/
2. Download the **LTS** (Long Term Support) installer for Windows
3. Run the `.msi` installer
4. Check the box that says **"Automatically install the necessary tools"** when prompted
5. Click through the rest with default settings
6. Close and reopen your terminal (Command Prompt or PowerShell), then run `node --version` to verify

**Linux (Ubuntu/Debian):**
```bash
# Download and install the NodeSource repository for Node.js 20.x:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js:
sudo apt-get install -y nodejs

# Verify:
node --version
npm --version
```

**Linux (Fedora/RHEL):**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

**Using nvm (any platform — advanced):**
```bash
# Install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Close and reopen your terminal, then:
nvm install 20
nvm use 20

# Verify:
node --version    # should print v20.x.x
npm --version     # should print 10.x.x
```

---

## Step-by-Step Setup

Follow these steps in order. Each step includes the exact command to run and what you should expect to see.

### Step 1: Open a terminal

- **macOS**: Open Spotlight (Cmd + Space), type `Terminal`, press Enter
- **Windows**: Press Win + R, type `cmd`, press Enter (or search for "PowerShell" in the Start menu)
- **Linux**: Press Ctrl + Alt + T (or open your terminal application)

### Step 2: Navigate to where you want to put the project

Choose a folder on your computer where you want the project to live. For example, your home directory or a `projects` folder:

```bash
# Go to your home directory (works on all platforms):
cd ~

# (Optional) Create a projects folder and go into it:
mkdir -p projects
cd projects
```

### Step 3: Clone the repository

This downloads all the source code from GitHub to your computer:

```bash
git clone https://github.com/Clayne666/framing-takeoff-toolkit.git
```

**Expected output:**
```
Cloning into 'framing-takeoff-toolkit'...
remote: Enumerating objects: ...
remote: Counting objects: ...
Receiving objects: 100% ...
Resolving deltas: 100% ...
```

### Step 4: Enter the project directory

```bash
cd framing-takeoff-toolkit
```

You are now inside the project folder. You can verify by running:

```bash
ls
```

**Expected output (you should see these files):**
```
README.md
framing_takeoff_toolkit.jsx
index.html
package-lock.json
package.json
src/
vite.config.js
```

### Step 5: Install dependencies

This reads `package.json` and downloads all required libraries (React, Vite, etc.) into a `node_modules/` folder:

```bash
npm install
```

**Expected output:**
```
added 62 packages, and audited 63 packages in 8s
...
```

This creates:
- `node_modules/` — folder containing all downloaded libraries (do NOT edit or commit this)
- Updates `package-lock.json` — exact versions of every dependency (already committed)

**If this step fails**, see the [Troubleshooting](#troubleshooting) section below.

### Step 6: Start the development server

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Step 7: Open the app in your browser

Open your web browser (Chrome, Firefox, Edge, or Safari) and go to:

```
http://localhost:5173
```

You should see the **Framing Takeoff Toolkit** application with a dark UI, a header that says "FRAMING TAKEOFF TOOLKIT", and tab buttons: PDF Scanner, Walls, Floors, Roof, Bid, Quick Ref.

### Step 8: Stop the server when you're done

Go back to the terminal where the server is running and press:

```
Ctrl + C
```

This stops the development server. You can restart it anytime by running `npm run dev` again from inside the project directory.

---

## How to Use the Application

### PDF Scanner Tab

1. Click the **"Choose PDF File"** button and select a PDF construction plan from your computer
2. The scanner will process each page, extracting:
   - **Dimensions** — measurements like `12'-6"`, `28'`, `10.5'`
   - **Framing References** — terms like `2x4`, `2x6`, `16" OC`, `joist`, `rafter`, `header`
   - **Rooms** — names like `bedroom`, `kitchen`, `garage`, `bathroom`
3. **Calibrate the Scale:**
   - Click the **"Set Scale"** button
   - Click two points on the plan that represent a known real-world distance (e.g., a dimension line labeled `10'`)
   - Type the real-world distance in the input box that appears (e.g., `10`) and click **"Confirm"**
4. **Measure on the Plan:**
   - After setting the scale, click the **"Measure"** button
   - Click any two points on the plan to get a real-world distance measurement
   - Measurements are labeled M1, M2, M3, etc. and can be removed individually
5. **Send Dimensions to Takeoff Tabs:**
   - Check the dimensions you want from the extraction table
   - Choose the destination (Walls, Floors, or Roof) from the dropdown
   - Click **"Send to Takeoff"** — this sends the selected dimensions and any manual measurements

### Walls Tab

1. **Settings** — Choose stud size (2x4 or 2x6), spacing (12"/16"/24" OC), and waste percentages
2. **Wall Schedule** — A table of walls. Each row has:
   - **Wall ID** — a name for the wall (e.g., "North Ext")
   - **Type** — Exterior, Interior, or Bearing (Exterior walls get 3 extra corner studs)
   - **Len** — wall length in feet
   - **Ht** — wall height in feet
   - **Opens** — number of door/window openings (each adds 6 studs for king/trimmer/cripple)
3. Calculated columns auto-fill: stud count, studs with waste, plates, sheathing sheets, material cost, labor cost, total cost
4. Click **"+ Add Wall"** to add more walls, or the **"x"** button to remove one
5. **Totals** section at the bottom shows aggregate numbers across all walls

### Floors Tab

1. **Settings** — Choose joist size (2x8/2x10/2x12), spacing, and waste percentage
2. **Floor Areas** — Each row has a name, span (ft), and width (ft)
3. Calculated columns: square footage, joist count, joists with waste, subfloor sheets, hanger count, costs
4. Click **"+ Add Area"** for more areas

### Roof Tab

1. **Settings** — Choose rafter size, spacing, roof pitch (3/12 through 12/12), and waste percentage
2. **Roof Sections** — Each row has a name, ridge length (ft), and span (ft)
3. Calculated columns: rafter length (adjusted by pitch factor), rafter count, sheathing, costs
4. Click **"+ Add Section"** for more sections

### Bid Tab

1. Shows a summary of costs from Walls, Floors, and Roof tabs (these update automatically as you change takeoff values)
2. **Extras** — Add costs for Blocking, Hardware, and Misc items
3. **Markup** — Set your markup percentage (default 15%)
4. **Total SF** — Enter the total project square footage for $/SF calculation
5. Shows: Subtotal, Markup amount, Bid Total, and $/SF

### Quick Ref Tab

Standalone calculators for quick lookups — no connection to the other tabs:

- **Studs** — Calculate stud count for a given wall length, spacing, and waste
- **Board Ft** — Calculate board feet from dimensions and quantity
- **Sheathing** — Calculate sheet count from wall length and height
- **Headers** — Get recommended header size based on opening width and load bearing status
- **Joists** — Get recommended joist size, count, subfloor sheets, and rim board for a given span

---

## Customizing Prices and Rates

All pricing data lives in one file: **`src/constants.js`**. Open it in any text editor to update values for your local market.

### Lumber Prices

Prices are per piece (studs) or per 16-foot length (dimensional lumber):

```js
export const LUMBER_PRICES = {
  "2x4Stud": 4.28,        // price per 2x4 precut stud
  "2x4_16ft": 10.98,      // price per 2x4 16' length (plates)
  "2x6Stud": 6.78,        // price per 2x6 precut stud
  "2x6_16ft": 17.48,      // price per 2x6 16' length (plates)
  "2x8_16ft": 21.98,      // price per 2x8 16' length (joists/rafters)
  "2x10_16ft": 28.48,     // price per 2x10 16' length (joists/rafters)
  "2x12_16ft": 35.98,     // price per 2x12 16' length (joists/rafters)
  osb4x8: 14.98,          // price per 4x8 OSB sheathing panel
  plywood3_4: 42.98,      // price per 3/4" plywood sheet (subfloor)
  hanger2x8: 2.45,        // price per 2x8 joist hanger
  hanger2x10: 2.85,       // price per 2x10 joist hanger
  hanger2x12: 3.15,       // price per 2x12 joist hanger
  hurricaneTie: 1.85,     // price per hurricane/rafter tie
};
```

### Labor Rates

```js
export const LABOR_RATES = {
  wallPerLinearFoot: 8.50, // dollars per linear foot of wall framing
  floorPerSquareFoot: 3.25,// dollars per square foot of floor framing
  roofPerSquareFoot: 4.50, // dollars per square foot of roof framing
};
```

### Roof Pitch Factors

Multipliers applied to horizontal span to calculate actual rafter length:

```js
export const PITCH_FACTORS = {
  "3/12": 1.031,
  "4/12": 1.054,
  "5/12": 1.083,
  "6/12": 1.118,
  "7/12": 1.158,
  "8/12": 1.202,
  "9/12": 1.25,
  "10/12": 1.302,
  "12/12": 1.414,
};
```

### Waste Defaults

```js
export const SHEATHING_WASTE_FACTOR = 1.08;  // 8% sheathing waste (subfloor)
export const SHEET_COVERAGE_SF = 32;          // each 4x8 sheet covers 32 SF
```

After editing `src/constants.js`, save the file. If the dev server is running, the browser will auto-reload with the new values.

---

## All Available Commands

Run these from inside the project directory (`framing-takeoff-toolkit/`):

| Command             | What it does                                                              |
|---------------------|---------------------------------------------------------------------------|
| `npm install`       | Downloads all dependencies into `node_modules/`. Run once after cloning.  |
| `npm run dev`       | Starts the Vite dev server. Open http://localhost:5173 in your browser.   |
| `npm run build`     | Creates an optimized production build in the `dist/` folder.              |
| `npm run preview`   | Serves the `dist/` folder locally at http://localhost:4173 for testing.   |

---

## Building for Production

When you're ready to deploy the app to a web server (rather than running it locally), build a production bundle:

### Step 1: Run the build command

```bash
npm run build
```

**Expected output:**
```
vite v5.x.x building for production...
✓ 41 modules transformed.
dist/index.html                  0.42 kB │ gzip:  0.29 kB
dist/assets/index-XXXXXXXX.js  187.24 kB │ gzip: 56.79 kB
✓ built in XXXms
```

This creates a `dist/` folder containing:
- `dist/index.html` — the single HTML page
- `dist/assets/index-XXXXXXXX.js` — all JavaScript bundled and minified into one file

### Step 2: (Optional) Test the production build locally

```bash
npm run preview
```

Open http://localhost:4173 in your browser to verify the production build works correctly.

### Step 3: Deploy the `dist/` folder

The `dist/` folder is a completely self-contained static site. Copy its contents to any web server.

---

## Deploying to a Web Server

The production build (`dist/` folder) is a static site — no server-side code, no database. It works on any static hosting provider.

### Netlify

1. Go to https://app.netlify.com
2. Drag and drop the `dist/` folder onto the page
3. Your site is live immediately

Or connect your GitHub repo:
- **Build command:** `npm run build`
- **Publish directory:** `dist`

### Vercel

1. Go to https://vercel.com and import your GitHub repository
2. Vercel auto-detects Vite and configures everything
3. Click "Deploy"

### GitHub Pages

```bash
# Install gh-pages helper:
npm install --save-dev gh-pages

# Add to package.json scripts:
#   "deploy": "gh-pages -d dist"

# Build and deploy:
npm run build
npx gh-pages -d dist
```

### Any Static Server (Nginx, Apache, S3, etc.)

Just copy the contents of `dist/` to your server's web root. For example with Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/framing-takeoff-toolkit/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Project Structure

```
framing-takeoff-toolkit/
├── index.html                          # Entry HTML file (loads src/main.jsx)
├── package.json                        # Project metadata, dependencies, npm scripts
├── package-lock.json                   # Exact dependency versions (auto-generated)
├── vite.config.js                      # Vite build configuration with React plugin
├── .gitignore                          # Files excluded from git (node_modules, dist, .env)
├── README.md                           # This file
├── framing_takeoff_toolkit.jsx         # Original single-file source (pre-refactor, kept for reference)
└── src/                                # All application source code
    ├── main.jsx                        # React 18 entry point — mounts <App /> into #root
    ├── App.jsx                         # App shell — header, tab navigation, state for imported dims and totals
    ├── theme.js                        # Color palette, font families, shared style objects
    ├── constants.js                    # Lumber prices, labor rates, pitch factors, waste constants
    ├── utils/
    │   └── parsers.js                  # PDF text parsing: parseDimensions(), parseFramingReferences(), parseRooms()
    └── components/
        ├── ui.jsx                      # Reusable UI: NumberInput, SelectInput, ResultCard, Section, Row, Button
        ├── PdfScanner.jsx              # PDF upload, page rendering, text extraction, scale calibration, measuring
        ├── WallTakeoff.jsx             # Wall schedule table, calculateWall() function, settings, totals
        ├── FloorTakeoff.jsx            # Floor areas table, calculateFloorArea() function, settings, totals
        ├── RoofTakeoff.jsx             # Roof sections table, calculateRoofSection() function, settings, totals
        ├── BidSummary.jsx              # Bid aggregation — receives live totals from wall/floor/roof tabs
        └── QuickReference.jsx          # 5 standalone calculators: studs, board feet, sheathing, headers, joists
```

---

## Tech Stack

| Technology          | Version    | Purpose                                                    |
|---------------------|------------|------------------------------------------------------------|
| React               | 18.2+      | UI framework — components, hooks (useState, useMemo, etc.) |
| Vite                | 5.0+       | Dev server with hot reload, production bundler              |
| @vitejs/plugin-react| 4.2+       | JSX transform and React fast refresh for Vite               |
| PDF.js              | 3.11.174   | PDF parsing and canvas rendering (loaded from CDN)          |
| Google Fonts        | —          | Inter (UI text) and JetBrains Mono (numeric values)         |

---

## Troubleshooting

### `npm install` fails with permission errors

**macOS/Linux:**
```bash
# Do NOT use sudo with npm install. Instead, fix npm permissions:
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then retry:
npm install
```

**Windows:** Run your terminal (Command Prompt or PowerShell) as Administrator.

### `npm run dev` says "port 5173 is already in use"

Another process is using that port. Either stop it or use a different port:
```bash
npm run dev -- --port 3000
```
Then open http://localhost:3000 instead.

### The browser shows a blank white page

1. Open your browser's developer tools (F12 or Cmd+Opt+I on Mac)
2. Click the "Console" tab and look for red error messages
3. Make sure you're going to `http://localhost:5173` (not `https://`)

### PDF upload doesn't work / "Error" message

- Make sure you're uploading an actual PDF file (not an image or scanned photo)
- The PDF must contain selectable text (not a scanned image). If your plans are scanned images, the text extraction won't find dimensions
- Very large PDFs (100+ pages) may take a while to process

### `node --version` shows a version below 18

Upgrade Node.js using the installation instructions in the [Prerequisites](#prerequisites) section. If you're using nvm:
```bash
nvm install 20
nvm use 20
```

### Changes to `src/constants.js` don't appear

If the dev server is running, changes should auto-reload. If not:
1. Save the file
2. Refresh the browser (Ctrl+R or Cmd+R)
3. If still stuck, stop the server (Ctrl+C) and restart it (`npm run dev`)
