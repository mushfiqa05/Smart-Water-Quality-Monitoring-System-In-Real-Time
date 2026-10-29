/**
 * Smart Water Monitoring Platform - Main Application Orchestrator
 */

import { setupAdminToggle, updateStatsSummary, renderLiveParameters, renderTankStatus, renderSensorStatusList } from './dashboard.js';
import { renderAnalyticsSummary } from './analytics.js';
import { initHistory } from './history.js';
import { initCharts } from './charts.js';
import { initAlerts, getActiveAlerts } from './alerts.js';
import { initReports } from './reports.js';
import { initSettings } from './settings.js';
import { initAdminComplaints } from './adminComplaints.js';
import { listenToTanksData } from './firebase.js';

let latestTanksData = [];

// Global Toast System
window.showToast = function(msg, iconName = 'checkCircle') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24"><use href="#icon-${iconName}"></use></svg>
    <span>${msg}</span>
  `;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
  }, 3200);
};

// Global Modal System
window.openModal = function(html) {
  const modalEl = document.getElementById('modal');
  const overlay = document.getElementById('modalOverlay');
  if (modalEl && overlay) {
    modalEl.innerHTML = html;
    overlay.classList.add('open');
  }
};

window.closeModal = function() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
};

window.__closeModal = window.closeModal;

// View Tank Details Modal Handler
window.__viewTankDetails = function(tankId) {
  const tank = latestTanksData.find(t => t.id === tankId);
  if (!tank) return;

  const html = `
    <div class="modal-head">
      <h3>${tank.name} Telemetry & Status</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-row"><span class="k">System ID</span><span class="v">${tank.id}</span></div>
    <div class="modal-row"><span class="k">Status</span><span class="v" style="color:var(--${tank.status === 'online' ? 'success' : 'danger'})">${tank.status.toUpperCase()}</span></div>
    <div class="modal-row"><span class="k">Location</span><span class="v">${tank.location}</span></div>
    <div class="modal-row"><span class="k">Water Level</span><span class="v">${tank.level}%</span></div>
    <div class="modal-row"><span class="k">pH Level</span><span class="v">${tank.ph}</span></div>
    <div class="modal-row"><span class="k">TDS</span><span class="v">${tank.tds} ppm</span></div>
    <div class="modal-row"><span class="k">Electrical Conductivity (EC)</span><span class="v">${tank.ec} µS/cm</span></div>
    <div class="modal-row"><span class="k">Temperature</span><span class="v">${tank.temperature} °C</span></div>
    <div class="modal-row"><span class="k">Turbidity</span><span class="v">${tank.turbidity} NTU</span></div>
    <div class="modal-row"><span class="k">Capacity</span><span class="v">${tank.capacity}</span></div>
    <div style="margin-top:18px;">
      <button class="btn btn-ghost" style="width:100%;" onclick="window.closeModal()">Close</button>
    </div>
  `;
  window.openModal(html);
};
window.__viewTank = window.__viewTankDetails;

// Re-render UI across active views
window.refreshDashboardUI = function() {
  if (latestTanksData.length > 0) {
    const activeAlerts = getActiveAlerts();
    updateStatsSummary(latestTanksData, activeAlerts.length);
    renderLiveParameters(latestTanksData);
    renderTankStatus(latestTanksData);
    renderSensorStatusList(latestTanksData);
    renderAnalyticsSummary('all');
  }
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupHeaderClock();
  setupThemeToggle();
  setupMobileSidebar();
  setupDropdowns();
  setupNavigation();
  setupLogout();

  setupAdminToggle();
  initAlerts();
  initHistory();
  initReports();
  initSettings();
  initAdminComplaints();

  // Listen to realtime telemetry data stream
  listenToTanksData((tanks) => {
    latestTanksData = tanks;
    window.refreshDashboardUI();
    initCharts('all');
  });

  // Hide preloader
  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) preloader.classList.add('hide');
  }, 800);
});

// Live Header Clock
function setupHeaderClock() {
  const dateEl = document.getElementById('headerDate');
  const timeEl = document.getElementById('headerTime');

  function tick() {
    const now = new Date();
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
  }
  tick();
  setInterval(tick, 1000);
}

// Theme Toggle System
function setupThemeToggle() {
  const body = document.body;
  const toggle = document.getElementById('themeToggle');
  const iconEl = document.getElementById('themeIcon');

  function applyTheme(theme) {
    body.setAttribute('data-theme', theme);
    if (iconEl) {
      iconEl.innerHTML = theme === 'dark'
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        : '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    }
    try { localStorage.setItem('wqm-theme', theme); } catch (e) {}
    window.dispatchEvent(new Event('theme-changed'));
  }

  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('wqm-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (e) {}
  applyTheme(savedTheme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      const nextTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      window.showToast(nextTheme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled', 'checkCircle');
    });
  }
}

// Mobile Sidebar Toggle
function setupMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuBtn = document.getElementById('menuBtn');

  if (!sidebar || !menuBtn || !overlay) return;

  const toggleSidebar = () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  };

  menuBtn.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);
}

// Dropdowns (Notifs & Profile)
function setupDropdowns() {
  const bindDropdown = (btnId, dropId) => {
    const btn = document.getElementById(btnId);
    const dd = document.getElementById(dropId);
    if (!btn || !dd) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dd.classList.contains('open');
      document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
      if (!isOpen) dd.classList.add('open');
    });
  };

  bindDropdown('notifBtn', 'notifDropdown');
  bindDropdown('profileBtn', 'profileDropdown');

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  });

  const clearNotifs = document.getElementById('clearNotifs');
  if (clearNotifs) {
    clearNotifs.addEventListener('click', () => {
      const dot = document.getElementById('notifDot');
      if (dot) dot.style.display = 'none';
      window.showToast('Notifications marked as read', 'checkCircle');
    });
  }

  // Handle data-toast clicks
  document.querySelectorAll('[data-toast]').forEach(el => {
    if (el.classList.contains('nav-item')) return;
    el.addEventListener('click', () => {
      window.showToast(el.getAttribute('data-toast'), 'checkCircle');
    });
  });
}

// Sidebar Navigation Page View Switching
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pageViews = document.querySelectorAll('.page-view');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetViewId = item.getAttribute('data-target');
      const toastMsg = item.getAttribute('data-toast');

      if (toastMsg) {
        window.showToast(toastMsg, 'checkCircle');
      }

      if (targetViewId) {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // Check if matching page-view exists
        const targetView = document.getElementById(targetViewId);
        if (targetView && targetView.classList.contains('page-view')) {
          pageViews.forEach(v => v.classList.remove('active'));
          targetView.classList.add('active');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (targetView) {
          // If it's a section on main dashboard, switch to dashboard page view and scroll to section
          const dashPage = document.getElementById('dashboardPage');
          if (dashPage) {
            pageViews.forEach(v => v.classList.remove('active'));
            dashPage.classList.add('active');
          }
          targetView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      if (window.innerWidth <= 1024 && sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
      }
    });
  });
}

// Logout Action
function setupLogout() {
  const confirmLogout = () => {
    window.openModal(`
      <div class="modal-head">
        <h3>Confirm Logout</h3>
        <button class="modal-close" onclick="window.closeModal()">
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p style="font-size:13.5px;color:var(--text-muted);margin-bottom:20px;">Are you sure you want to log out of your session?</p>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirmLogoutActionBtn">Logout</button>
      </div>
    `);

    setTimeout(() => {
      const btn = document.getElementById('confirmLogoutActionBtn');
      if (btn) {
        btn.addEventListener('click', () => {
          window.closeModal();
          window.showToast('Logged out successfully', 'checkCircle');
        });
      }
    }, 0);
  };

  const logoutBtn = document.getElementById('logoutBtn');
  const sidebarLogout = document.getElementById('sidebarLogout');

  if (logoutBtn) logoutBtn.addEventListener('click', confirmLogout);
  if (sidebarLogout) sidebarLogout.addEventListener('click', (e) => { e.preventDefault(); confirmLogout(); });
}
