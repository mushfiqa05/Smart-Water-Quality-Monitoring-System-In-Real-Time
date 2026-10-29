/**
 * Smart Water Monitoring Platform - Reports Module
 */

import { getHistoryData } from './firebase.js';
import { exportToCSV, exportToPDF, formatDate, formatTime } from './utils.js';

export function initReports() {
  const generateBtn = document.getElementById('generateReportBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', generateReport);
  }
}

export function generateReport() {
  const reportType = document.getElementById('reportTypeSelect')?.value || 'daily';
  const tankId = document.getElementById('reportTankSelect')?.value || 'all';
  const format = document.getElementById('reportFormatSelect')?.value || 'pdf';

  const now = Date.now();
  let startTimestamp = now - 24 * 60 * 60 * 1000;
  if (reportType === 'weekly') startTimestamp = now - 7 * 24 * 60 * 60 * 1000;
  if (reportType === 'monthly') startTimestamp = now - 30 * 24 * 60 * 60 * 1000;

  const data = getHistoryData({ tankId, startTimestamp });

  if (data.length === 0) {
    if (window.showToast) window.showToast('No records found for specified report criteria.', 'alertTriangle');
    return;
  }

  const title = `Water Telemetry ${reportType.toUpperCase()} Report`;
  const tankText = tankId === 'all' ? 'All Monitored Tanks' : `Tank ${tankId}`;
  const dateText = `Generated on ${new Date().toLocaleDateString()}`;

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
    exportToCSV(`${reportType}_water_report.csv`, headers, rows);
    if (window.showToast) window.showToast(`${reportType.toUpperCase()} CSV Report downloaded`, 'checkCircle');
  } else {
    exportToPDF(title, tankText, dateText, headers, rows, stats);
    if (window.showToast) window.showToast(`${reportType.toUpperCase()} PDF Report generated`, 'checkCircle');
  }
}
