/**
 * Smart Water Monitoring System - Admin Dashboard Complaints Module
 */

import { listenToComplaints, listenToComplaintsSummary, updateComplaintStatusInFirebase, clearTankEscalationInFirebase, CURRENT_TANK } from './firebase.js';
import { formatDateTime } from './utils.js';

let complaintsList = [];
let complaintsSummary = null;
let activeStatusFilter = 'all';
let activePeriodFilter = 'all';
let searchQuery = '';

let categoryChartInstance = null;
let statusChartInstance = null;

export function initAdminComplaints() {
  listenToComplaints((list) => {
    complaintsList = list;
    updateAdminComplaintsUI();
  });

  listenToComplaintsSummary((summary) => {
    complaintsSummary = summary;
    updateAdminComplaintsUI();
  });

  setupComplaintFilterEvents();
}

function updateAdminComplaintsUI() {
  updateNotificationBadges();
  renderComplaintsSummaryCards();
  renderEscalationBanner();
  renderComplaintsTable();
  renderComplaintAnalyticsCharts();
}

function updateNotificationBadges() {
  const pendingCount = complaintsList.filter(c => c.status === 'Pending' || c.status === 'Escalated').length;
  
  // Sidebar count badge
  const sidebarBadge = document.getElementById('sidebarComplaintCount');
  if (sidebarBadge) {
    sidebarBadge.textContent = pendingCount;
    sidebarBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    if (complaintsSummary && complaintsSummary.Escalated) {
      sidebarBadge.style.background = 'var(--danger, #e33e4c)';
    }
  }

  // Header notifications dot & list
  const notifDot = document.getElementById('notifDot');
  if (notifDot) {
    notifDot.style.display = pendingCount > 0 ? 'block' : 'none';
  }

  const notifList = document.getElementById('notifList');
  if (notifList) {
    const pendingItems = complaintsList.filter(c => c.status === 'Pending' || c.status === 'Escalated').slice(0, 5);
    if (pendingItems.length === 0) {
      notifList.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--text-muted); text-align:center;">No pending complaints</div>`;
    } else {
      notifList.innerHTML = pendingItems.map(c => `
        <div class="notif-item" style="padding:10px; border-bottom:1px solid rgba(0,0,0,0.05); font-size:12px;">
          <div style="font-weight:700; color:${c.status === 'Escalated' ? 'var(--danger)' : 'var(--text-main)'}">
            ${c.status === 'Escalated' ? '🚨 [ESCALATED]' : '🚩'} ${c.category}
          </div>
          <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">
            ${c.tankId || CURRENT_TANK} · ${formatDateTime(c.timestamp || c.createdAt)}
          </div>
        </div>
      `).join('');
    }
  }
}

function renderComplaintsSummaryCards() {
  const container = document.getElementById('complaintsSummaryCards');
  if (!container) return;

  const totalThisWeek = complaintsSummary ? (complaintsSummary.WeeklyComplaintCount || 0) : 0;
  const pendingCount = complaintsList.filter(c => c.status === 'Pending').length;
  const escalatedCount = complaintsList.filter(c => c.status === 'Escalated').length;
  const resolvedCount = complaintsList.filter(c => c.status === 'Resolved').length;
  const rejectedCount = complaintsList.filter(c => c.status === 'Rejected').length;

  container.innerHTML = `
    <div class="glass stat-card">
      <div class="stat-top">
        <div class="stat-icon c-warning"><svg class="icon"><use href="#icon-alertTriangle"></use></svg></div>
        <span class="stat-trend neutral">Week ${complaintsSummary ? (complaintsSummary.CurrentWeek || '--') : '--'}</span>
      </div>
      <div class="stat-value">${totalThisWeek} / 7</div>
      <div class="stat-label">Complaints This Week</div>
    </div>

    <div class="glass stat-card">
      <div class="stat-top">
        <div class="stat-icon c-warning"><svg class="icon"><use href="#icon-clock"></use></svg></div>
      </div>
      <div class="stat-value">${pendingCount}</div>
      <div class="stat-label">Pending Action</div>
    </div>

    <div class="glass stat-card">
      <div class="stat-top">
        <div class="stat-icon ${escalatedCount > 0 ? 'c-danger' : ''}"><svg class="icon"><use href="#icon-alertTriangle"></use></svg></div>
      </div>
      <div class="stat-value" style="${escalatedCount > 0 ? 'color:var(--danger);' : ''}">${escalatedCount}</div>
      <div class="stat-label">Escalated Complaints</div>
    </div>

    <div class="glass stat-card">
      <div class="stat-top">
        <div class="stat-icon c-success"><svg class="icon"><use href="#icon-checkCircle"></use></svg></div>
      </div>
      <div class="stat-value">${resolvedCount}</div>
      <div class="stat-label">Resolved Complaints</div>
    </div>

    <div class="glass stat-card">
      <div class="stat-top">
        <div class="stat-icon"><svg class="icon"><use href="#icon-xCircle"></use></svg></div>
      </div>
      <div class="stat-value">${rejectedCount}</div>
      <div class="stat-label">Rejected Reports</div>
    </div>
  `;
}

function renderEscalationBanner() {
  const bannerContainer = document.getElementById('complaintEscalationBanner');
  if (!bannerContainer) return;

  const isEscalated = complaintsSummary && complaintsSummary.Escalated === true;
  const cooldown = complaintsSummary ? complaintsSummary.MaintenanceCooldown : null;
  const isCooldownActive = cooldown && cooldown.Active && new Date(cooldown.EndsAt).getTime() > Date.now();

  let html = '';

  if (isEscalated) {
    html += `
      <div class="glass" style="background: linear-gradient(135deg, rgba(227,62,76,0.15), rgba(255,107,107,0.1)); border:1.5px solid var(--danger); padding:16px 20px; border-radius:16px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:42px; height:42px; border-radius:12px; background:var(--danger); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px;">🚨</div>
          <div>
            <div style="font-weight:800; font-size:15px; color:var(--danger);">AUTOMATIC ESCALATION ACTIVE ON ${CURRENT_TANK}</div>
            <div style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">
              This tank reached 7 valid reports this calendar week. Public dashboard parameter readings are set to "Under Maintenance".
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="clearEscalationBtn" style="background:var(--danger); border:none;">
          Clear Escalation & Reset Status
        </button>
      </div>
    `;
  }

  if (isCooldownActive) {
    const endsStr = formatDateTime(cooldown.EndsAt);
    html += `
      <div class="glass" style="background: linear-gradient(135deg, rgba(31,168,100,0.12), rgba(47,143,239,0.1)); border:1.5px solid var(--success); padding:14px 18px; border-radius:16px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:20px;">🛠️</span>
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--success);">24-Hour Maintenance Cooldown Active</div>
            <div style="font-size:12px; color:var(--text-muted);">New community reports temporarily paused until ${endsStr}.</div>
          </div>
        </div>
      </div>
    `;
  }

  bannerContainer.innerHTML = html;

  const clearBtn = document.getElementById('clearEscalationBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try {
        await clearTankEscalationInFirebase();
        if (window.showToast) window.showToast("Escalation cleared for " + CURRENT_TANK, "checkCircle");
      } catch (e) {
        alert("Failed to clear escalation");
      }
    });
  }
}

function getFilteredComplaints() {
  let filtered = [...complaintsList];

  // Status Filter
  if (activeStatusFilter !== 'all') {
    filtered = filtered.filter(c => (c.status || 'Pending').toLowerCase() === activeStatusFilter.toLowerCase());
  }

  // Period Filter
  if (activePeriodFilter === 'current_week') {
    const currentWeek = getCalendarWeekNum();
    filtered = filtered.filter(c => getCalendarWeekNum(new Date(c.timestamp || c.createdAt)) === currentWeek);
  } else if (activePeriodFilter === 'previous_weeks') {
    const currentWeek = getCalendarWeekNum();
    filtered = filtered.filter(c => getCalendarWeekNum(new Date(c.timestamp || c.createdAt)) < currentWeek);
  }

  // Search Filter
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      String(c.complaintId || '').toLowerCase().includes(q) ||
      String(c.category || '').toLowerCase().includes(q) ||
      String(c.description || '').toLowerCase().includes(q) ||
      String(c.clientId || '').toLowerCase().includes(q)
    );
  }

  return filtered;
}

function getCalendarWeekNum(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function renderComplaintsTable() {
  const tbody = document.getElementById('complaintsTableBody');
  if (!tbody) return;

  const list = getFilteredComplaints();

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
          No complaint records match the selected filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const status = c.status || 'Pending';
    const statusClass = status === 'Resolved' ? 'c-success' : status === 'Escalated' ? 'c-danger' : status === 'In Review' ? 'c-warning' : status === 'Rejected' ? 'c-muted' : 'c-warning';
    
    // Anonymize client ID for privacy preview
    const rawClient = String(c.clientId || 'anonymous');
    const anonymizedClient = rawClient.length > 12 ? `${rawClient.substring(0, 8)}…` : rawClient;

    return `
      <tr>
        <td style="font-weight:700;">${c.complaintId || c.id}</td>
        <td><span class="status-pill online">${c.tankId || CURRENT_TANK}</span></td>
        <td>${formatDateTime(c.timestamp || c.createdAt)}</td>
        <td style="font-weight:600;">${c.category || 'General'}</td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.description || ''}">
          ${c.description ? c.description : '<span style="color:var(--text-muted); font-style:italic;">No description provided</span>'}
        </td>
        <td style="font-family:monospace; font-size:11.5px; color:var(--text-muted);">${anonymizedClient}</td>
        <td>
          <span class="status-pill ${statusClass}" style="text-transform:capitalize;">
            ${status === 'Escalated' ? '🚨 Escalated' : status}
          </span>
        </td>
        <td>
          <button class="btn btn-ghost" style="padding:4px 10px; font-size:12px;" onclick="window.__manageComplaint('${c.id}')">
            Manage
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Global handler for managing a specific complaint modal
window.__manageComplaint = function(id) {
  const complaint = complaintsList.find(c => String(c.id) === String(id) || String(c.complaintId) === String(id));
  if (!complaint) return;

  const currentStatus = complaint.status || 'Pending';
  const currentNote = complaint.resolutionNote || '';

  const html = `
    <div class="modal-head">
      <h3>Manage Complaint #${complaint.complaintId || complaint.id}</h3>
      <button class="modal-close" onclick="window.closeModal()">
        <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    
    <div style="margin-bottom:14px; font-size:13px; line-height:1.6;">
      <div class="modal-row"><span class="k">Tank</span><span class="v">${complaint.tankId || CURRENT_TANK}</span></div>
      <div class="modal-row"><span class="k">Date &amp; Time</span><span class="v">${formatDateTime(complaint.timestamp || complaint.createdAt)}</span></div>
      <div class="modal-row"><span class="k">Category</span><span class="v" style="font-weight:700;">${complaint.category}</span></div>
      <div class="modal-row"><span class="k">Client Identifier</span><span class="v" style="font-family:monospace;">${complaint.clientId || 'N/A'}</span></div>
      <div class="modal-row"><span class="k">Description</span><span class="v">${complaint.description || 'None provided'}</span></div>
    </div>

    <div style="border-top:1px solid rgba(0,0,0,0.08); pt-3; margin-top:10px; padding-top:12px;">
      <div class="form-group" style="margin-bottom:12px;">
        <label for="modalComplaintStatus" style="font-weight:700; font-size:12.5px;">Update Status</label>
        <select class="select-control" id="modalComplaintStatus" style="width:100%;">
          <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="In Review" ${currentStatus === 'In Review' ? 'selected' : ''}>In Review</option>
          <option value="Resolved" ${currentStatus === 'Resolved' ? 'selected' : ''}>Resolved (Starts 24h Cooldown)</option>
          <option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
          <option value="Escalated" ${currentStatus === 'Escalated' ? 'selected' : ''}>Escalated</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label for="modalResolutionNote" style="font-weight:700; font-size:12.5px;">Resolution / Admin Note</label>
        <textarea class="input-control" id="modalResolutionNote" rows="3" placeholder="Add resolution note or action summary…" style="width:100%; box-sizing:border-box;">${currentNote}</textarea>
      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="saveComplaintStatusBtn">Save Changes</button>
      </div>
    </div>
  `;

  if (window.openModal) window.openModal(html);

  setTimeout(() => {
    const saveBtn = document.getElementById('saveComplaintStatusBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const newStatus = document.getElementById('modalComplaintStatus').value;
        const note = document.getElementById('modalResolutionNote').value.trim();

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
          await updateComplaintStatusInFirebase(complaint.id || complaint.complaintId, newStatus, note);
          if (window.closeModal) window.closeModal();
          if (window.showToast) window.showToast(`Complaint updated to ${newStatus}`, 'checkCircle');
        } catch (e) {
          alert('Failed to update complaint status.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
        }
      });
    }
  }, 0);
};

function setupComplaintFilterEvents() {
  // Status filter buttons
  document.querySelectorAll('.complaint-status-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.complaint-status-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatusFilter = btn.getAttribute('data-status') || 'all';
      renderComplaintsTable();
    });
  });

  // Time period select
  const periodSelect = document.getElementById('complaintPeriodSelect');
  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      activePeriodFilter = e.target.value;
      renderComplaintsTable();
    });
  }

  // Search input
  const searchInput = document.getElementById('complaintSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderComplaintsTable();
    });
  }
}

function renderComplaintAnalyticsCharts() {
  const categoryCanvas = document.getElementById('complaintCategoryChart');
  const statusCanvas = document.getElementById('complaintStatusChart');

  if (!categoryCanvas || !statusCanvas || typeof Chart === 'undefined') return;

  // 1. Category Breakdown Data
  const categoriesMap = {};
  complaintsList.forEach(c => {
    const cat = c.category || 'Other';
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
  });

  const catLabels = Object.keys(categoriesMap);
  const catCounts = catLabels.map(l => categoriesMap[l]);

  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(categoryCanvas, {
    type: 'bar',
    data: {
      labels: catLabels.length > 0 ? catLabels : ['Dirty Water', 'Smell', 'Taste', 'Leakage', 'No Water'],
      datasets: [{
        label: 'Number of Complaints',
        data: catCounts.length > 0 ? catCounts : [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(47, 143, 239, 0.75)',
        borderColor: '#2f8fef',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });

  // 2. Status Breakdown Data
  const statusMap = { 'Pending': 0, 'In Review': 0, 'Resolved': 0, 'Rejected': 0, 'Escalated': 0 };
  complaintsList.forEach(c => {
    const st = c.status || 'Pending';
    if (statusMap[st] !== undefined) statusMap[st]++;
    else statusMap[st] = 1;
  });

  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(statusCanvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusMap),
      datasets: [{
        data: Object.values(statusMap),
        backgroundColor: [
          '#f2c94c', // Pending
          '#2f8fef', // In Review
          '#1fa864', // Resolved
          '#95a5a6', // Rejected
          '#e33e4c'  // Escalated
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}
