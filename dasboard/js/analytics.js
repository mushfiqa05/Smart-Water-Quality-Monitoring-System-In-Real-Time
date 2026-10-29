/**
 * Smart Water Monitoring Platform - Analytics Module
 */

import { getHistoryData } from './firebase.js';
import { checkThreshold, formatDateTime } from './utils.js';

export function renderAnalyticsSummary(selectedTankId = 'all') {
  // Fetch historical data for analytics calculations
  const allHistory = getHistoryData({ tankId: selectedTankId });
  const container = document.getElementById('analyticsSummaryCards');
  
  if (allHistory.length === 0) {
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-muted);">
          Awaiting telemetry history from Firebase node...
        </div>
      `;
    }
    return;
  }

  // Calculate statistics using JavaScript on historical data
  const latest = allHistory[0]; // sorted descending by default
  const totalReadings = allHistory.length;
  
  const phVals = allHistory.map(h => h.ph).filter(v => v !== undefined);
  const tdsVals = allHistory.map(h => h.tds).filter(v => v !== undefined);
  const tempVals = allHistory.map(h => h.temperature).filter(v => v !== undefined);
  const levelVals = allHistory.map(h => h.level).filter(v => v !== undefined);

  const avgPH = phVals.reduce((a, b) => a + b, 0) / (phVals.length || 1);
  const avgTDS = tdsVals.reduce((a, b) => a + b, 0) / (tdsVals.length || 1);
  const avgTemp = tempVals.reduce((a, b) => a + b, 0) / (tempVals.length || 1);

  // Today's readings count
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const todayReadings = allHistory.filter(h => h.timestamp >= startOfToday).length;

  // Water level change in last 24 hours
  const past24h = Date.now() - 24 * 60 * 60 * 1000;
  const history24h = allHistory.filter(h => h.timestamp >= past24h);
  let lvlChangeText = '--';
  if (history24h.length >= 2) {
    const latestLvl = history24h[0].level;
    const oldestLvl = history24h[history24h.length - 1].level;
    const diff = latestLvl - oldestLvl;
    lvlChangeText = `${diff >= 0 ? '+' : ''}${diff}%`;
  }

  // Define summary cards structure
  const cards = [
    { label: 'Current pH', value: latest.ph.toFixed(1), icon: 'flask', color: 'c-success' },
    { label: 'Average pH', value: avgPH.toFixed(1), icon: 'flask', color: 'c-success' },
    { label: 'Current TDS', value: `${latest.tds} ppm`, icon: 'droplet', color: 'c-success' },
    { label: 'Average TDS', value: `${Math.round(avgTDS)} ppm`, icon: 'droplet', color: 'c-success' },
    { label: 'Average Temp', value: `${avgTemp.toFixed(1)} °C`, icon: 'thermometer', color: 'c-success' },
    { label: 'Current Water Level', value: `${latest.level}%`, icon: 'waves', color: 'c-success', subtitle: `Change: ${lvlChangeText}` },
    { label: "Today's Readings", value: todayReadings, icon: 'layers', color: 'c-success' },
    { label: 'Last Updated', value: formatDateTime(latest.timestamp), icon: 'clock', color: 'c-success' }
  ];

  // Render cards
  if (container) {
    container.innerHTML = cards.map(c => `
      <div class="glass stat-card">
        <div class="stat-top">
          <div class="stat-icon ${c.color}">
            <svg class="icon" viewBox="0 0 24 24"><use href="#icon-${c.icon}"></use></svg>
          </div>
          ${c.subtitle ? `<span class="stat-trend up" style="font-size:10px;">${c.subtitle}</span>` : ''}
        </div>
        <div class="stat-value" style="font-size: 20px;">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    `).join('');
  }
}
