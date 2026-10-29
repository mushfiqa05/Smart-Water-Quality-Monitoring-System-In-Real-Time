/**
 * Smart Water Monitoring Platform - Utilities
 */

// Define safe parameter thresholds
export const THRESHOLDS = {
  temperature: { min: 15, max: 40, goodMax: 30, warnMax: 34 },
  tds: { min: 0, max: 600, goodMax: 300, warnMax: 450 },
  ec: { min: 0, max: 1200, goodMax: 800, warnMax: 1000 },
  ph: { min: 0, max: 14, goodMin: 6.5, goodMax: 8.0, warnMin: 6.0, warnMax: 8.5 },
  turbidity: { min: 0, max: 10, goodMax: 3, warnMax: 5 },
  level: { min: 0, max: 100, goodMin: 40, warnMin: 20 }
};

// Update THRESHOLDS dynamically when Settings change from Firebase
export function updateThresholdsFromSettings(settings) {
  if (!settings) return;
  if (settings.ph) {
    if (settings.ph.goodMin !== undefined) THRESHOLDS.ph.goodMin = Number(settings.ph.goodMin);
    if (settings.ph.goodMax !== undefined) THRESHOLDS.ph.goodMax = Number(settings.ph.goodMax);
  } else {
    if (settings.phMin !== undefined) THRESHOLDS.ph.goodMin = Number(settings.phMin);
    if (settings.phMax !== undefined) THRESHOLDS.ph.goodMax = Number(settings.phMax);
  }

  if (settings.tdsMax !== undefined) THRESHOLDS.tds.goodMax = Number(settings.tdsMax);
  if (settings.ecMax !== undefined) THRESHOLDS.ec.goodMax = Number(settings.ecMax);
  if (settings.temperatureMax !== undefined || settings.tempMax !== undefined) {
    THRESHOLDS.temperature.goodMax = Number(settings.temperatureMax || settings.tempMax);
  }
  if (settings.turbidityMax !== undefined) THRESHOLDS.turbidity.goodMax = Number(settings.turbidityMax);
  if (settings.levelMin !== undefined) THRESHOLDS.level.goodMin = Number(settings.levelMin);
}

// Calculate overall Water Quality Score (0-100) reusing existing parameter checking algorithm
export function calculateWaterQualityScore(tanks) {
  if (!tanks || tanks.length === 0) return 80;
  let goodParams = 0;
  let totalParams = 0;
  tanks.forEach(t => {
    if (t.status === 'online') {
      ['ph', 'tds', 'ec', 'temperature', 'turbidity', 'level'].forEach(k => {
        const val = t[k] ?? t[k.toUpperCase()] ?? t[k === 'temperature' ? 'Temperature' : k === 'level' ? 'WaterLevel' : k === 'ph' ? 'pH' : k];
        if (val !== undefined && val !== null && !isNaN(val)) {
          totalParams++;
          if (checkThreshold(k, Number(val)) === 'good') goodParams++;
        }
      });
    }
  });
  return totalParams > 0 ? Math.round((goodParams / totalParams) * 100) : 80;
}

// Check threshold and return status: 'good' | 'warning' | 'critical'
export function checkThreshold(key, val) {
  const limits = THRESHOLDS[key];
  if (!limits || val === undefined || isNaN(val)) return 'good';

  if (key === 'ph') {
    if (val >= limits.goodMin && val <= limits.goodMax) return 'good';
    if (val >= limits.warnMin && val <= limits.warnMax) return 'warning';
    return 'critical';
  }
  if (key === 'level') {
    if (val >= limits.goodMin) return 'good';
    if (val >= limits.warnMin) return 'warning';
    return 'critical';
  }
  if (val <= limits.goodMax) return 'good';
  if (val <= limits.warnMax) return 'warning';
  return 'critical';
}

// Convert status to display label
export function getStatusLabel(status) {
  if (status === 'good') return 'Good';
  if (status === 'warning') return 'Warning';
  return 'Critical';
}

// Format percentage of value relative to range
export function getPercentOf(key, val) {
  const limits = THRESHOLDS[key];
  if (!limits || val === undefined || isNaN(val)) return 50;
  return Math.max(3, Math.min(100, ((val - limits.min) / (limits.max - limits.min)) * 100));
}

/**
 * Safely converts any timestamp format (Unix seconds, Unix ms, ISO string, Date string) into milliseconds.
 */
export function parseTimestamp(ts) {
  if (!ts) return Date.now();
  if (typeof ts === 'number') {
    if (ts < 10000000000) return ts * 1000; // convert unix seconds to ms
    return ts;
  }
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) {
      if (num < 10000000000) return num * 1000;
      return num;
    }
    const parsed = new Date(trimmed).getTime();
    if (!isNaN(parsed) && parsed > 1000000000) return parsed;
  }
  return Date.now();
}

// Date and Time Formatting Helpers (safely handles uploaded ESP32 timestamps)
export function formatDate(timestamp) {
  if (!timestamp) return '--';
  const ms = parseTimestamp(timestamp);
  const date = new Date(ms);
  if (isNaN(date.getTime()) || ms <= 1000000000) return '--';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(timestamp) {
  if (!timestamp) return '--';
  const ms = parseTimestamp(timestamp);
  const date = new Date(ms);
  if (isNaN(date.getTime()) || ms <= 1000000000) return '--';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '--';
  const ms = parseTimestamp(timestamp);
  const date = new Date(ms);
  if (isNaN(date.getTime()) || ms <= 1000000000) return '--';
  return `${formatDate(ms)} ${formatTime(ms)}`;
}

// Exporter: Generate CSV
export function exportToCSV(filename, headers, rows) {
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exporter: Generate PDF Report
export function exportToPDF(title, tankDetails, dateRange, headers, rows, stats) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("jsPDF library not loaded. Unable to generate PDF.");
    return;
  }

  const doc = new jsPDF();
  
  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(11, 99, 206);
  doc.text("Water Monitoring Report", 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(91, 114, 149);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 28);
  
  // Metadata
  doc.setFontSize(10);
  doc.text(`Tank Details: ${tankDetails}`, 14, 38);
  doc.text(`Date Range: ${dateRange}`, 14, 44);
  doc.text(`Generated: ${formatDateTime(new Date())}`, 14, 50);

  // Stats table
  doc.setFont("helvetica", "bold");
  doc.text("Summary Statistics:", 14, 62);
  let y = 68;
  doc.setFont("helvetica", "normal");
  Object.keys(stats).forEach(param => {
    const s = stats[param];
    doc.text(`${param.toUpperCase()}: Avg ${s.avg} | Min ${s.min} | Max ${s.max}`, 14, y);
    y += 6;
  });

  // Table header
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFillColor(234, 243, 255);
  doc.rect(14, y - 4, 182, 7, "F");
  
  const colWidths = [30, 20, 20, 20, 20, 20, 25, 27];
  let currentX = 14;
  headers.forEach((h, i) => {
    doc.text(h, currentX, y);
    currentX += colWidths[i] || 20;
  });

  y += 8;
  doc.setFont("helvetica", "normal");
  
  // Rows
  rows.forEach(row => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    currentX = 14;
    row.forEach((cell, i) => {
      doc.text(String(cell), currentX, y);
      currentX += colWidths[i] || 20;
    });
    y += 7;
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_report.pdf`);
}
