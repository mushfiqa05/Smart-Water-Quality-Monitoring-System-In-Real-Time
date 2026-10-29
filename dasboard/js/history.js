/**
 * Smart Water Monitoring Platform - History Module
 */

import { getHistoryData, listenToHistoryData } from './firebase.js';
import { checkThreshold, getStatusLabel, formatDateTime, formatDate, formatTime, exportToCSV, exportToPDF } from './utils.js';

let state = {
  data: [],
  filteredData: [],
  currentPage: 1,
  pageSize: 10,
  sortBy: 'timestamp',
  sortDesc: true,
  searchQuery: '',
  filters: {
    tankId: 'all',
    range: '7d', // 'today', 'yesterday', '7d', '30d', 'custom'
    startDate: '',
    endDate: '',
    month: '',
    week: ''
  }
};

// Initialize History page
export function initHistory() {
  setupFilterListeners();
  listenToHistoryData(() => {
    fetchAndRenderHistory();
  });
}

function setupFilterListeners() {
  // Tank selector
  const tankSelect = document.getElementById('histTankSelect');
  if (tankSelect) {
    tankSelect.addEventListener('change', (e) => {
      state.filters.tankId = e.target.value;
      state.currentPage = 1;
      fetchAndRenderHistory();
    });
  }

  // Quick filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const range = btn.getAttribute('data-range');
      state.filters.range = range;
      state.currentPage = 1;
      
      // Hide/Show custom pickers based on selection
      const customPicker = document.getElementById('customDateRangeWrap');
      if (customPicker) {
        customPicker.style.display = range === 'custom' ? 'flex' : 'none';
      }
      
      fetchAndRenderHistory();
    });
  });

  // Custom date range inputs
  const fromDate = document.getElementById('histFromDate');
  const toDate = document.getElementById('histToDate');
  if (fromDate && toDate) {
    const handleCustomChange = () => {
      state.filters.startDate = fromDate.value;
      state.filters.endDate = toDate.value;
      state.currentPage = 1;
      fetchAndRenderHistory();
    };
    fromDate.addEventListener('change', handleCustomChange);
    toDate.addEventListener('change', handleCustomChange);
  }

  // Month selector
  const monthSel = document.getElementById('histMonthSelect');
  if (monthSel) {
    monthSel.addEventListener('change', (e) => {
      state.filters.month = e.target.value;
      state.filters.range = e.target.value ? 'month' : '7d';
      state.currentPage = 1;
      fetchAndRenderHistory();
    });
  }

  // Week selector
  const weekSel = document.getElementById('histWeekSelect');
  if (weekSel) {
    weekSel.addEventListener('change', (e) => {
      state.filters.week = e.target.value;
      state.filters.range = e.target.value ? 'week' : '7d';
      state.currentPage = 1;
      fetchAndRenderHistory();
    });
  }

  // Search Input
  const searchInput = document.getElementById('histSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      state.currentPage = 1;
      filterAndSortData();
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById('histPrevPage');
  const nextBtn = document.getElementById('histNextPage');
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    });
    nextBtn.addEventListener('click', () => {
      const maxPages = Math.ceil(state.filteredData.length / state.pageSize);
      if (state.currentPage < maxPages) {
        state.currentPage++;
        renderTable();
      }
    });
  }

  // Export buttons
  const csvBtn = document.getElementById('exportCSVBtn');
  const pdfBtn = document.getElementById('exportPDFBtn');
  if (csvBtn) csvBtn.addEventListener('click', () => downloadReport('csv'));
  if (pdfBtn) pdfBtn.addEventListener('click', () => downloadReport('pdf'));
}

export function fetchAndRenderHistory() {
  const params = {};
  const now = new Date();
  
  if (state.filters.range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    params.startTimestamp = start.getTime();
  } else if (state.filters.range === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    params.startTimestamp = start.getTime();
    params.endTimestamp = end.getTime();
  } else if (state.filters.range === '7d') {
    params.startTimestamp = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  } else if (state.filters.range === '30d') {
    params.startTimestamp = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  } else if (state.filters.range === 'custom') {
    if (state.filters.startDate) {
      params.startTimestamp = new Date(state.filters.startDate).getTime();
    }
    if (state.filters.endDate) {
      params.endTimestamp = new Date(state.filters.endDate).getTime() + 24 * 60 * 60 * 1000;
    }
  } else if (state.filters.range === 'month') {
    const [year, month] = state.filters.month.split('-');
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    params.startTimestamp = start.getTime();
    params.endTimestamp = end.getTime();
  } else if (state.filters.range === 'week') {
    const [year, weekStr] = state.filters.week.split('-W');
    const week = parseInt(weekStr);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    params.startTimestamp = ISOweekStart.getTime();
    params.endTimestamp = ISOweekStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  }

  params.tankId = state.filters.tankId;
  state.data = getHistoryData(params);
  filterAndSortData();
}

function filterAndSortData() {
  let result = [...state.data];

  // Search filter
  if (state.searchQuery) {
    result = result.filter(item => 
      item.tankName.toLowerCase().includes(state.searchQuery) ||
      item.location.toLowerCase().includes(state.searchQuery) ||
      checkThreshold('ph', item.ph).toLowerCase().includes(state.searchQuery)
    );
  }

  // Sort
  result.sort((a, b) => {
    let valA = a[state.sortBy];
    let valB = b[state.sortBy];

    if (typeof valA === 'string') {
      return state.sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    }
    
    return state.sortDesc ? valB - valA : valA - valB;
  });

  state.filteredData = result;
  renderTable();
  renderSummaryStats();
}

function renderTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  const paginated = state.filteredData.slice(start, end);

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state" style="text-align:center;">No records match the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = paginated.map(row => {
    // Determine overall quality status badge
    let qualityStatus = 'good';
    ['ph', 'tds', 'ec', 'temperature', 'turbidity', 'level'].forEach(k => {
      const st = checkThreshold(k, row[k]);
      if (st === 'critical') qualityStatus = 'critical';
      else if (st === 'warning' && qualityStatus !== 'critical') qualityStatus = 'warning';
    });

    const isRowAdmin = window.isAdmin;

    return `
      <tr>
        <td style="padding: 12px 14px; font-size:13px; font-weight:600;">${formatDate(row.timestamp)}</td>
        <td style="padding: 12px 14px; font-size:13px;">${formatTime(row.timestamp)}</td>
        <td style="padding: 12px 14px; font-size:13px; font-weight:bold;">${row.tankName}</td>
        <td style="padding: 12px 14px; font-size:13px;">${!isRowAdmin && checkThreshold('ph', row.ph) !== 'good' ? 'Data Under Verification' : row.ph}</td>
        <td style="padding: 12px 14px; font-size:13px;">${!isRowAdmin && checkThreshold('tds', row.tds) !== 'good' ? 'Data Under Verification' : row.tds}</td>
        <td style="padding: 12px 14px; font-size:13px;">${row.ec}</td>
        <td style="padding: 12px 14px; font-size:13px;">${!isRowAdmin && checkThreshold('temperature', row.temperature) !== 'good' ? 'Data Under Verification' : row.temperature}</td>
        <td style="padding: 12px 14px; font-size:13px;">${!isRowAdmin && checkThreshold('turbidity', row.turbidity) !== 'good' ? 'Data Under Verification' : row.turbidity}</td>
        <td style="padding: 12px 14px; font-size:13px;">${row.level}%</td>
        <td style="padding: 12px 14px;"><span class="param-status status-${qualityStatus}">${getStatusLabel(qualityStatus)}</span></td>
      </tr>
    `;
  }).join('');

  // Update page indicators
  const pageInfo = document.getElementById('histPageInfo');
  if (pageInfo) {
    const totalRecords = state.filteredData.length;
    const fromIndex = totalRecords === 0 ? 0 : start + 1;
    const toIndex = Math.min(totalRecords, end);
    pageInfo.textContent = `Showing ${fromIndex} to ${toIndex} of ${totalRecords} entries`;
  }

  // Update button disabled state
  const prevBtn = document.getElementById('histPrevPage');
  const nextBtn = document.getElementById('histNextPage');
  if (prevBtn) prevBtn.disabled = state.currentPage === 1;
  if (nextBtn) {
    const maxPages = Math.ceil(state.filteredData.length / state.pageSize);
    nextBtn.disabled = state.currentPage >= maxPages || maxPages === 0;
  }
}

function renderSummaryStats() {
  const grid = document.getElementById('historyStatsSummaryGrid');
  if (!grid) return;

  const data = state.filteredData;
  if (data.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:16px;">No data to calculate summary.</div>`;
    return;
  }

  const params = ['ph', 'tds', 'ec', 'temperature', 'turbidity', 'level'];
  const labels = ['pH Level', 'TDS (ppm)', 'EC (µS/cm)', 'Temperature (°C)', 'Turbidity (NTU)', 'Water Level (%)'];
  
  const statsHTML = params.map((p, idx) => {
    const values = data.map(d => d[p]).filter(v => v !== undefined);
    const avg = values.reduce((s, v) => s + v, 0) / (values.length || 1);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `
      <div class="glass param-card" style="padding:15px; display:flex; flex-direction:column; gap:4px;">
        <div style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">${labels[idx]}</div>
        <div style="font-size:20px; font-weight:800; color:var(--brand-1);">${avg.toFixed(p === 'ph' || p === 'turbidity' || p === 'temperature' ? 1 : 0)}</div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-faint);">
          <span>Min: ${min.toFixed(p === 'ph' || p === 'turbidity' || p === 'temperature' ? 1 : 0)}</span>
          <span>Max: ${max.toFixed(p === 'ph' || p === 'turbidity' || p === 'temperature' ? 1 : 0)}</span>
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = statsHTML;
}

// Compute statistics and download CSV/PDF report
function downloadReport(format) {
  const data = state.filteredData;
  if (data.length === 0) {
    alert("No records to export.");
    return;
  }

  const title = `Water telemetry report`;
  const tankText = state.filters.tankId === 'all' ? 'All Monitored Tanks' : `Tank ${state.filters.tankId}`;
  const dateText = `${state.filters.range.toUpperCase()}: ${state.filters.startDate || 'Default'} to ${state.filters.endDate || 'Now'}`;
  
  // Calculate average, min, max values
  const params = ['ph', 'tds', 'ec', 'temperature', 'turbidity', 'level'];
  const stats = {};
  params.forEach(p => {
    const values = data.map(d => d[p]).filter(v => v !== undefined);
    stats[p] = {
      avg: (values.reduce((s, v) => s + v, 0) / (values.length || 1)).toFixed(1),
      min: Math.min(...values).toFixed(1),
      max: Math.max(...values).toFixed(1)
    };
  });

  const headers = ['Date', 'Time', 'Tank', 'pH', 'TDS', 'EC', 'Temp', 'Turbidity', 'Level'];
  const rows = data.map(r => [
    formatDate(r.timestamp),
    formatTime(r.timestamp),
    r.tankName,
    r.ph,
    r.tds,
    r.ec,
    r.temperature,
    r.turbidity,
    `${r.level}%`
  ]);

  if (format === 'csv') {
    exportToCSV(`${title.toLowerCase().replace(/\s+/g, '_')}.csv`, headers, rows);
    window.showToast("CSV report downloaded successfully.", "checkCircle");
  } else {
    exportToPDF(title, tankText, dateText, headers, rows, stats);
    window.showToast("PDF report downloaded successfully.", "checkCircle");
  }
}
