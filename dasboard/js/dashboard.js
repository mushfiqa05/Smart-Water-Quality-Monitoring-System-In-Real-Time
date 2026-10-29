/**
 * Smart Water Monitoring Platform - Live Dashboard Module
 */

import { checkThreshold, getStatusLabel, getPercentOf, THRESHOLDS, formatDateTime, calculateWaterQualityScore } from './utils.js';

// Global session state
window.isAdmin = true; // Default admin

/**
 * Telemetry field parser: safely reads both PascalCase (ESP32) and lowercase database keys.
 */
export function parseTelemetryData(data = {}) {
  if (!data) data = {};
  return {
    temp: data.Temperature ?? data.temperature ?? 0,
    tds: data.TDS ?? data.tds ?? 0,
    ec: data.EC ?? data.ec ?? 0,
    ph: data.pH ?? data.ph ?? 0,
    turbidity: data.Turbidity ?? data.turbidity ?? 0,
    waterLevel: data.WaterLevel ?? data.waterLevel ?? 0,
    score: data.WaterQualityScore ?? data.waterQualityScore ?? data.score ?? 0,
    status: data.TankStatus || data.tankStatus || data.status || "Unknown",
    lastUpdated: data.LastUpdated || data.Timestamp || "--"
  };
}

export function setupAdminToggle() {
  const profileMeta = document.querySelector('.profile-meta');
  if (profileMeta) {
    // Add Admin Toggle Switch in profile area
    const toggleHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
        <span style="font-size:10px; font-weight:bold; color:var(--text-muted);">Admin Mode</span>
        <input type="checkbox" id="adminModeCheckbox" ${window.isAdmin ? 'checked' : ''} style="cursor:pointer;">
      </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = toggleHTML;
    profileMeta.appendChild(container);

    const checkbox = document.getElementById('adminModeCheckbox');
    checkbox.addEventListener('change', (e) => {
      window.isAdmin = e.target.checked;
      const roleText = document.querySelector('.prole');
      if (roleText) {
        roleText.textContent = window.isAdmin ? 'System Administrator' : 'Public Viewer';
      }
      
      // Update header details
      const pnameText = document.querySelector('.pname');
      if (pnameText) {
        pnameText.textContent = window.isAdmin ? 'Admin User' : 'Guest User';
      }

      // Re-trigger update of active views
      const activeTab = document.querySelector('.nav-item.active').getAttribute('data-target');
      window.refreshDashboardUI();
      window.dispatchEvent(new CustomEvent('admin-changed'));
      
      window.showToast(window.isAdmin ? 'Switched to Admin Dashboard' : 'Switched to Public Dashboard', 'checkCircle');
    });
  }
}

// Compute aggregate metrics
export function updateStatsSummary(tanks, alertsCount) {
  const online = tanks.filter(t => t.status === 'online' || t.isOnline).length;
  const offline = tanks.length - online;
  
  // Calculate Water Quality Score using incoming score from Firebase or quality check algorithm
  let qualityScore = 100;
  if (tanks.length > 0 && tanks[0].waterQualityScore !== undefined && tanks[0].waterQualityScore !== null && !isNaN(tanks[0].waterQualityScore)) {
    qualityScore = tanks[0].waterQualityScore;
  } else {
    qualityScore = calculateWaterQualityScore(tanks);
  }

  const mainTankStatus = tanks.length > 0 ? (tanks[0].tankStatus || 'Safe') : 'Safe';
  const qualityText = mainTankStatus !== 'Unknown' ? mainTankStatus : (qualityScore >= 85 ? 'Excellent' : qualityScore >= 70 ? 'Good' : 'Needs Review');
  const qualityCls = (mainTankStatus.toLowerCase() === 'safe' || qualityScore >= 70) ? 'c-success' : (mainTankStatus.toLowerCase() === 'moderate' ? 'c-warning' : 'c-danger');

  const stats = [
    { label: 'Total Tanks', value: tanks.length, icon: 'layers', cls: '', trend: null },
    { label: 'Online Tanks', value: online, icon: 'wifi', cls: 'c-success', trend: { dir: 'up', val: `+${online}` } },
    { label: 'Offline Tanks', value: offline, icon: 'wifiOff', cls: offline > 0 ? 'c-danger' : '', trend: offline > 0 ? { dir: 'down', val: 'Attention' } : null },
    { label: 'Water Quality Status', value: qualityText, icon: 'checkCircle', cls: qualityCls, trend: null },
    { label: 'Total Alerts Today', value: alertsCount, icon: 'alertTriangle', cls: alertsCount > 0 ? 'c-warning' : 'c-success', trend: { dir: 'down', val: 'Live' } },
    { label: 'Water Quality Score', value: `${qualityScore}/100`, icon: 'gauge', cls: qualityScore >= 70 ? 'c-success' : 'c-danger', trend: { dir: qualityScore >= 70 ? 'up' : 'down', val: `${qualityScore >= 80 ? '+' : ''}${(qualityScore - 80).toFixed(1)}%` } }
  ];

  const grid = document.getElementById('statsGrid');
  if (grid) {
    grid.innerHTML = stats.map((s) => `
      <div class="glass stat-card">
        <div class="stat-top">
          <div class="stat-icon ${s.cls}">
            <svg class="icon" viewBox="0 0 24 24">
              <use href="#icon-${s.icon}"></use>
            </svg>
          </div>
          ${s.trend ? `<span class="stat-trend ${s.trend.dir}">${s.trend.val}</span>` : ''}
        </div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    `).join('');
  }
}

// Render Parameter Cards
export function renderLiveParameters(tanks) {
  const grid = document.getElementById('paramsGrid');
  if (!grid) return;

  if (!tanks || tanks.length === 0) {
    grid.innerHTML = `
      <div class="glass" style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted);">
        Waiting for live sensor data from Firebase...
      </div>`;
    return;
  }

  // Aggregate averages for online tanks
  const onlineTanks = tanks.filter(t => t.status === 'online' || t.isOnline);
  const targetTanks = onlineTanks.length > 0 ? onlineTanks : tanks;

  const params = [
    { key: 'temperature', label: 'Temperature', unit: '°C', icon: 'thermometer', decimals: 1 },
    { key: 'tds', label: 'TDS', unit: 'ppm', icon: 'droplet', decimals: 0 },
    { key: 'ec', label: 'EC', unit: 'µS/cm', icon: 'activity', decimals: 2 },
    { key: 'ph', label: 'pH Level', unit: 'pH', icon: 'flask', decimals: 2 },
    { key: 'turbidity', label: 'Turbidity', unit: 'NTU', icon: 'eye', decimals: 1 },
    { key: 'level', label: 'Water Level', unit: '%', icon: 'waves', decimals: 0 }
  ];

  grid.innerHTML = params.map(p => {
    let sum = 0;
    let count = 0;
    targetTanks.forEach(t => {
      const parsed = parseTelemetryData(t);
      const val = t[p.key] ?? (p.key === 'temperature' ? (t.temperature ?? parsed.temp) : p.key === 'level' ? (t.level ?? parsed.waterLevel) : parsed[p.key]);
      if (val !== undefined && val !== null && !isNaN(val)) {
        sum += Number(val);
        count++;
      }
    });

    const avgVal = count > 0 ? sum / count : 0;
    const status = checkThreshold(p.key, avgVal);
    const limits = THRESHOLDS[p.key];

    // Threshold Check verification logic:
    // If threshold status is warning or critical, and NOT admin: display "Data Under Verification"
    const formattedVal = avgVal.toFixed(p.decimals);
    const displayValue = (!window.isAdmin && status !== 'good') 
      ? "Data Under Verification" 
      : formattedVal;

    return `
      <div class="glass param-card" data-key="${p.key}">
        <div class="param-top">
          <div class="param-icon status-${status}">
            <svg class="icon" viewBox="0 0 24 24"><use href="#icon-${p.icon}"></use></svg>
          </div>
          <span class="param-status status-${status}">${getStatusLabel(status)}</span>
        </div>
        <div class="param-name">${p.label}</div>
        <div class="param-value-row">
          <span class="param-value" style="font-size: ${displayValue.length > 8 ? '18px' : '30px'}">${displayValue}</span>
          ${displayValue !== "Data Under Verification" ? `<span class="param-unit">${p.unit}</span>` : ''}
        </div>
        <div class="progress-track">
          <div class="progress-fill status-${status}" style="width: ${displayValue !== "Data Under Verification" ? getPercentOf(p.key, avgVal) : 0}%"></div>
        </div>
        <div class="param-range">
          <span>${limits.goodMin !== undefined ? limits.goodMin : limits.min}${p.unit}</span>
          <span>${limits.goodMax !== undefined ? limits.goodMax : limits.goodMax || limits.warnMax || limits.max}${p.unit}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render individual tank status list
export function renderTankStatus(tanks) {
  const grid = document.getElementById('tanksGrid');
  if (!grid) return;

  if (!tanks || tanks.length === 0) {
    grid.innerHTML = `
      <div class="glass" style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted);">
        Waiting for live sensor data from Firebase...
      </div>`;
    return;
  }

  grid.innerHTML = tanks.map((t) => {
    // Determine overall water quality status for this tank
    let qualityStatus = 'good';
    if (t.status === 'online') {
      ['ph', 'tds', 'ec', 'temperature', 'turbidity', 'level'].forEach(k => {
        const st = checkThreshold(k, t[k]);
        if (st === 'critical') qualityStatus = 'critical';
        else if (st === 'warning' && qualityStatus !== 'critical') qualityStatus = 'warning';
      });
    } else {
      qualityStatus = 'critical';
    }

    const qualityLabel = qualityStatus === 'good' ? 'Good' : qualityStatus === 'warning' ? 'Warning' : t.status === 'offline' ? 'Unknown' : 'Critical';

    return `
      <div class="glass tank-card">
        <div class="tank-top">
          <div class="tank-name-wrap">
            <div class="tank-avatar">${t.id}</div>
            <div>
              <div class="tank-name">${t.name}</div>
              <div class="tank-loc">
                <svg class="icon"><use href="#icon-mapPin"></use></svg>
                <span>${t.location}</span>
              </div>
            </div>
          </div>
          <span class="status-pill ${t.status}">
            <span class="status-dot ${t.status === 'online' ? 'blink' : ''}"></span>${t.status}
          </span>
        </div>
        <div class="tank-mid">
          <div>
            <div class="tank-metric-label">Water Level</div>
            <div class="tank-metric-value">${t.status === 'offline' ? '--' : t.level + '%'}</div>
          </div>
          <div>
            <div class="tank-metric-label">Water Quality</div>
            <div class="tank-metric-value" style="color:var(--${qualityStatus === 'good' ? 'success' : qualityStatus === 'warning' ? 'warning' : 'danger'})">${qualityLabel}</div>
          </div>
          <div class="tank-level-bar">
            <div class="progress-track">
              <div class="progress-fill status-${qualityStatus}" style="width: ${t.status === 'offline' ? 0 : t.level}%"></div>
            </div>
          </div>
        </div>
        <div class="tank-updated">
          <svg class="icon"><use href="#icon-clock"></use></svg>
          <span>Last updated: ${formatDateTime(t.lastUpdated)}</span>
        </div>
        <div class="tank-actions">
          <button class="btn btn-primary" onclick="window.__viewTankDetails('${t.id}')">
            <svg class="icon"><use href="#icon-eye"></use></svg> View Details
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Render sensor nodelist
export function renderSensorStatusList(tanks) {
  const list = document.getElementById('sensorStatusList');
  if (!list) return;

  list.innerHTML = tanks.map(t => `
    <div class="sensor-row">
      <div class="sensor-row-left">
        <span class="sensor-pulse ${t.status === 'offline' ? 'off' : ''}"></span>
        <div>
          <div class="sensor-name">${t.name} Node</div>
          <div class="sensor-meta">${t.location}</div>
        </div>
      </div>
      <span class="sensor-signal ${t.status === 'offline' ? 'off' : 'on'}">${t.status === 'offline' ? 'Disconnected' : 'Connected'}</span>
    </div>
  `).join('');
}
