import { parse } from '../../node_modules/csv-parse/dist/esm/sync.js';
import { createGrid, ModuleRegistry, AllCommunityModule } from '../../node_modules/ag-grid-community/dist/package/main.esm.mjs';

const { AgCharts } = agCharts;

// Initialize bird carousel with proximity-based scaling (Glide.js)
const glide = new Glide('#bird-carousel', {
  type: 'carousel',
  perView: 3,
  focusAt: 'center',
  gap: 10,
  autoplay: 3500,
  hoverpause: true,
  animationDuration: 600,
  breakpoints: {
    768: { perView: 2, focusAt: 'center' },
    480: { perView: 1, focusAt: 'center' },
  },
});

function updateSlideScales() {
  const track = document.querySelector('#bird-carousel .glide__track');
  const slides = document.querySelectorAll('#bird-carousel .glide__slide');
  if (!track || !slides.length) return;

  const trackRect = track.getBoundingClientRect();
  const trackCenter = trackRect.left + trackRect.width / 2;

  slides.forEach(slide => {
    const slideRect = slide.getBoundingClientRect();
    const slideCenter = slideRect.left + slideRect.width / 2;
    const dist = Math.abs(trackCenter - slideCenter);
    const maxDist = trackRect.width / 2;
    const t = Math.min(dist / maxDist, 1); // 0 = center, 1 = edge
    const scale = 1 - t * 0.15;   // center=1, edge=0.85
    const opacity = 1 - t * 0.3;  // center=1, edge=0.7
    slide.style.transform = `scale(${scale})`;
    slide.style.opacity = opacity;
  });
}

// Support animation for carousel
let rafId = null;
function startScaleLoop() {
  function loop() {
    updateSlideScales();
    rafId = requestAnimationFrame(loop);
  }
  loop();
}
function stopScaleLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

glide.on('run.before', startScaleLoop);
glide.on('run.after', () => {
  setTimeout(() => { stopScaleLoop(); updateSlideScales(); }, 50);
});

glide.mount();
updateSlideScales();
ModuleRegistry.registerModules([AllCommunityModule]);

// Load data (csv-parse)
async function loadWingspanData() {
  const response = await fetch('./public/data/wingspan.csv');
  const csvText = await response.text();

  const records = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
  }).filter(row => row.some(cell => cell.trim() !== ''));

  const cols = ['Birds', 'Bonus', 'EoR Goals', 'Eggs', 'Cached', 'Tucked', 'Nectar', 'Duet', 'Total'];
  const rows = [];

  for (let i = 0; i < records.length; i += 2) {
    const kristinRow = records[i];
    const opponentRow = records[i + 1];
    if (!kristinRow || !opponentRow) break;

    const gameNum = Math.floor(i / 2) + 1;
    const kristinTotal = Number(kristinRow[9]);
    const opponentTotal = Number(opponentRow[9]);
    const kristinWin = kristinTotal > opponentTotal;
    const tie = kristinTotal === opponentTotal;

    // Build a row object for each player
    const buildRow = (csvRow, isKristin) => {
      let playerResult;
      if (tie) {
        playerResult = 'Tie';
      } else if (isKristin) {
        playerResult = kristinWin ? 'Win' : 'Loss';
      } else {
        playerResult = kristinWin ? 'Loss' : 'Win';
      }
      const row = { game: gameNum, player: csvRow[0], result: playerResult };
      cols.forEach((col, idx) => {
        row[col] = Number(csvRow[idx + 1]);
      });
      row._kristinWin = kristinWin;
      row._tie = tie;
      row._isKristin = isKristin;
      return row;
    };

    rows.push(buildRow(kristinRow, true));
    rows.push(buildRow(opponentRow, false));
  }

  return rows;
}

// Define table columns (AG Grid)
const isMobile = window.innerWidth < 768;
function createColumnDefs() {
  const categories = ['Birds', 'Bonus', 'EoR Goals', 'Eggs', 'Cached', 'Tucked', 'Nectar', 'Duet', 'Total'];

  return [
    {
      headerName: 'Game',
      field: 'game',
      width: isMobile ? 75 : 110,
      sort: 'asc',
      pinned: 'left',
      valueFormatter: params => params.node.rowPinned ? '—' : params.value,
    },
    {
      headerName: 'Result',
      field: 'result',
      width: 110,
      pinned: isMobile ? null : 'left',
      valueFormatter: params => params.node.rowPinned ? '—' : params.value,
      cellStyle: params => {
        if (params.value === 'Win') return { color: '#16a34a', fontWeight: 700 };
        if (params.value === 'Loss') return { color: '#dc2626', fontWeight: 700 };
        return { color: '#ca8a04', fontWeight: 700 };
      },
    },
    {
      headerName: 'Player',
      field: 'player',
      width: 130,
    },
    ...categories.map(cat => ({
      headerName: cat,
      field: cat,
      flex: 1,
      minWidth: 110,
      type: 'numericColumn',
    })),
  ];
}

// Load data and initialize
async function init() {
  const rowData = await loadWingspanData();
  const cols = ['Birds', 'Bonus', 'EoR Goals', 'Eggs', 'Cached', 'Tucked', 'Nectar', 'Duet', 'Total'];

  // Compute averages for Kristin and Opponent
  const kristinRows = rowData.filter(r => r._isKristin);
  const opponentRows = rowData.filter(r => !r._isKristin);

  const buildAvgRow = (rows, label) => {
    const avg = { game: '—', player: label, result: '—', _isKristin: label === 'Kristin' };
    cols.forEach(col => {
      const sum = rows.reduce((acc, r) => acc + (r[col] || 0), 0);
      avg[col] = Math.round((sum / rows.length) * 10) / 10;
    });
    return avg;
  };

  const pinnedTopRowData = [
    buildAvgRow(kristinRows, 'Kristin'),
    buildAvgRow(opponentRows, 'Opponent'),
  ];

  // Build 5-game rolling average chart (AG Charts)
  const kristinTotals = kristinRows.map(r => r.Total);
  const opponentTotals = opponentRows.map(r => r.Total);

  const rollingAvg = (arr, window) => {
    return arr.map((_, i) => {
      if (i < window - 1) return null;
      const slice = arr.slice(i - window + 1, i + 1);
      return Math.round((slice.reduce((a, b) => a + b, 0) / window) * 10) / 10;
    });
  };

  const kristinRolling = rollingAvg(kristinTotals, 5);
  const opponentRolling = rollingAvg(opponentTotals, 5);

  const chartData = kristinRolling
    .map((val, i) => ({
      game: i + 1,
      kristin: val,
      opponent: opponentRolling[i],
    }))
    .filter(d => d.kristin !== null);

  AgCharts.create({
    container: document.querySelector('#chart'),
    title: { text: '5-Game Rolling Average — Total Score' },
    series: [
      {
        type: 'line',
        xKey: 'game',
        yKey: 'kristin',
        yName: 'Kristin',
        stroke: '#f472b6',
        marker: { fill: '#f472b6', stroke: '#f472b6', size: 4 },
      },
      {
        type: 'line',
        xKey: 'game',
        yKey: 'opponent',
        yName: 'Opponent',
        stroke: '#7dd3fc',
        marker: { fill: '#7dd3fc', stroke: '#7dd3fc', size: 4 },
      },
    ],
    data: chartData,
    axes: {
      x: { type: 'number', title: { text: 'Game #' }, interval: { step: 5 } },
      y: { type: 'number', title: { text: 'Score' }, max: 150 },
    },
  });

  // Build net record chart (AG Charts)
  let netRecord = 0;
  const recordData = kristinRows.map((row, i) => {
    if (row.result === 'Win') netRecord++;
    else if (row.result === 'Loss') netRecord--;
    return { game: i + 1, net: netRecord };
  });

  AgCharts.create({
    container: document.querySelector('#record-chart'),
    title: { text: "Kristin's Net Record" },
    series: [
      {
        type: 'line',
        xKey: 'game',
        yKey: 'net',
        yName: 'Net Record',
        stroke: '#f472b6',
        marker: { fill: '#f472b6', stroke: '#f472b6', size: 4 },
      },
    ],
    data: recordData,
    axes: {
      x: { type: 'number', title: { text: 'Game #' }, interval: { step: 5 } },
      y: {
        type: 'number',
        title: { text: 'Games Above/Below .500' },
        crossLines: [{ type: 'line', value: 0, stroke: '#94a3b8', strokeWidth: 1, lineDash: [4, 4] }],
      },
    },
  });

  const gridOptions = {
    columnDefs: createColumnDefs(),
    rowData,
    pinnedTopRowData,
    defaultColDef: {
      sortable: true,
      filter: false,
      resizable: false,
      suppressMovable: true,
    },
    getRowStyle: (params) => {
      if (params.node.rowPinned) {
        return {
          background: params.data._isKristin ? '#fce4ec' : '#e8eaf6',
          fontWeight: 700,
        };
      }
      return { background: params.data._isKristin ? '#fef2f5' : '#fffdf7' };
    },
    pagination: true,
    paginationPageSize: 20,
    paginationPageSizeSelector: [20, 40, 80],
    domLayout: 'autoHeight',
    animateRows: true,
  };

  const gridDiv = document.querySelector('#grid');
  createGrid(gridDiv, gridOptions);
}

init();
