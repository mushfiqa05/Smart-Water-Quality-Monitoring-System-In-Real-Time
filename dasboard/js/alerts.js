/**
 * Smart Water Monitoring Platform - Alerts Module (Firebase Connected)
 */

import { listenToAlerts } from './firebase.js';

let activeAlerts = [];
let currentFilterSev = 'all';

export function getActiveAlerts() {
  return activeAlerts;
}

export function initAlerts() {
  setupFilterButtons();
  
  // Listen to realtime Firebase alerts stream at WaterMonitoring/Tank1/Alerts
  listenToAlerts((alerts) => {
    activeAlerts = alerts || [];
    renderAlerts(currentFilterSev);
    if (window.refreshDashboardUI) {
      window.refreshDashboardUI();
    }
  });
}

export function renderAlerts(filterSev = 'all') {
  currentFilterSev = filterSev;
  const list = document.getElementById('alertsList');
  const pageList = document.getElementById('dedicatedAlertsList');
  const countBadge = document.getElementById('alertCountBadge');
  const sidebarCount = document.getElementById('sidebarAlertCount');
  const notifDot = document.getElementById('notifDot');

  const count = activeAlerts.length;
  if (countBadge) countBadge.textContent = `${count} Active`;
  if (sidebarCount) sidebarCount.textContent = count;
  if (notifDot) notifDot.style.display = count > 0 ? 'block' : 'none';

  let filtered = activeAlerts;
  if (filterSev !== 'all') {
    filtered = activeAlerts.filter(a => a.severity === filterSev);
  }

  const renderHTML = (items) => {
    if (items.length === 0) {
      return `
        <div class="empty-state">
          <svg class="icon" viewBox="0 0 24 24" style="width:32px;height:32px;margin:0 auto 8px;color:var(--success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>No active alerts in system. All water parameters normal.</div>
        </div>
      `;
    }

    return items.map(a => `
      <div class="alert-card sev-${a.severity || 'warning'}" data-id="${a.id}">
        <div class="alert-icon sev-${a.severity || 'warning'}">
          <svg class="icon" viewBox="0 0 24 24"><use href="#icon-${getAlertIcon(a.type || '')}"></use></svg>
        </div>
        <div class="alert-body">
          <div class="alert-title">
            ${a.type || 'Alert'} <span class="sev-tag sev-${a.severity || 'warning'}">${a.severity || 'warning'}</span>
          </div>
          <div class="alert-meta">${a.tank || 'Tank'} · ${a.time || 'Live'} · Value: ${a.value || '--'}</div>
        </div>
        <button class="alert-dismiss" onclick="window.__dismissAlert('${a.id}')" title="Dismiss Alert">
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');
  };

  if (list) list.innerHTML = renderHTML(filtered);
  if (pageList) pageList.innerHTML = renderHTML(filtered);

  renderNotifDropdown();
}

function getAlertIcon(type) {
  if (type.includes('Turbidity')) return 'eye';
  if (type.includes('Water Level') || type.includes('Level')) return 'waves';
  if (type.includes('TDS')) return 'droplet';
  if (type.includes('pH')) return 'flask';
  return 'alertTriangle';
}

function setupFilterButtons() {
  document.querySelectorAll('.alert-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.alert-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sev = btn.getAttribute('data-sev') || 'all';
      renderAlerts(sev);
    });
  });
}

export function dismissAlert(id) {
  const cards = document.querySelectorAll(`.alert-card[data-id="${id}"]`);
  cards.forEach(card => card.classList.add('removing'));

  setTimeout(() => {
    activeAlerts = activeAlerts.filter(a => String(a.id) !== String(id));
    renderAlerts(currentFilterSev);
    if (window.showToast) window.showToast('Alert dismissed', 'checkCircle');
  }, 280);
}

// Bind window global for inline onclick
window.__dismissAlert = dismissAlert;

function renderNotifDropdown() {
  const notifList = document.getElementById('notifList');
  if (!notifList) return;

  if (activeAlerts.length === 0) {
    notifList.innerHTML = `<div class="notif-item"><div class="nt">You're all caught up</div><div class="nd">No active notifications</div></div>`;
    return;
  }

  notifList.innerHTML = activeAlerts.slice(0, 4).map(a => `
    <div class="notif-item">
      <div class="nt">${a.type || 'Alert'} — ${a.tank || 'Tank'}</div>
      <div class="nd">${a.time || 'Live'} · ${(a.severity || 'warning').toUpperCase()}</div>
    </div>
  `).join('');
}
