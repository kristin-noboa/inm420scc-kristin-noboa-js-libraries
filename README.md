# Kristin's Wingspan Tracker

A web-based dashboard for tracking 1v1 Wingspan board game scores. The page displays a bird card carousel, rolling average line charts, a net win/loss record chart, and a paginated data table — all built with vanilla JavaScript and four third-party libraries.

## Libraries Used

### 1. Glide.js (`@glidejs/glide`)

A lightweight, dependency-free carousel/slider library. It powers the bird card carousel at the top of the page, cycling through bird artwork. Shows three cards on desktop, or one card on mobile.

### 2. csv-parse (`csv-parse`)

A CSV parsing library that converts raw CSV text into structured JavaScript arrays. It is used to fetch and parse the `wingspan.csv` data file containing per-game score breakdowns (Birds, Bonus, Eggs, etc.) for both players.

### 3. AG Charts (`ag-charts-community`)

A charting library used to render the two line charts on the page.

- **5-Game Rolling Average** — plots Kristin's and her opponent's smoothed total scores over time.
- **Net Record** — plots Kristin's cumulative net record across all games.

### 4. AG Grid (`ag-grid-community`)

A feature-rich data grid library used to display the full game-by-game score table with sortable columns, pinned rows/columns, and pagination.

> **Note:** AG Charts and AG Grid are two separate, independently developed libraries under the AG Grid Ltd. umbrella. They share a similar naming convention and visual style, but they are distinct packages (`ag-charts-community` and `ag-grid-community`) with different APIs, installed and imported separately. AG Charts is purpose-built for data visualization (line, bar, pie charts, etc.), while AG Grid is a tabular data grid focused on rows, columns, sorting, filtering, and pagination.
