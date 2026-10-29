/**
 * Smart Water Monitoring Platform - Modular Firebase Realtime Database Integration
 */

import { updateThresholdsFromSettings, parseTimestamp } from './utils.js';

// Centralized Tank Configuration (Do not hardcode Tank1 across the app)
export const CURRENT_TANK = "Tank1";

// Firebase credentials configuration
const firebaseConfig = {
  apiKey: "AIzaSyCnc_ho8WHyFG7T0PBV2xoocfBi6SRwtOo",
  authDomain: "smart-water-monitoring-3a117.firebaseapp.com",
  databaseURL: "https://smart-water-monitoring-3a117-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-water-monitoring-3a117",
  storageBucket: "smart-water-monitoring-3a117.firebasestorage.app",
  messagingSenderId: "685811485534",
  appId: "1:685811485534:web:c118bf9d8d7962cf6f1dcf",
  measurementId: "G-TC7EZCE626"
};

let db = null;
let isFirebaseInitialized = false;

// Cached in-memory states populated exclusively from Firebase Realtime Database
let cachedLiveState = null;
let cachedMetadataState = null;
let cachedHistoryList = [];
let cachedAlertsList = [];
let cachedSettingsState = null;

// Track active listeners to prevent duplication
const activeListeners = {};

// Initialize Firebase SDK exactly once
export function initFirebase() {
  if (isFirebaseInitialized) return db;

  try {
    if (window.firebase && firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("YOUR_DATABASE_URL")) {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      db = window.firebase.database();
      isFirebaseInitialized = true;
      console.log("[Firebase] Initialized successfully for target tank:", CURRENT_TANK);
    } else {
      console.warn("[Firebase] Credentials placeholder detected or Firebase SDK script unavailable. Awaiting user configuration.");
    }
  } catch (error) {
    console.error("[Firebase] Initialization error:", error);
  }

  return db;
}

// Auto-initialize on module load
initFirebase();

/**
 * Normalizes raw Firebase sensor payloads into a standard Tank Object.
 */
function normalizeTankData(tankId, liveData, metadata) {
  const data = liveData || {};
  const meta = metadata || {};

  const temp = data.Temperature ?? data.temperature ?? 0;
  const tds = data.TDS ?? data.tds ?? 0;
  const ec = data.EC ?? data.ec ?? 0;
  const ph = data.pH ?? data.ph ?? 0;
  const turbidity = data.Turbidity ?? data.turbidity ?? 0;
  const waterLevel = data.WaterLevel ?? data.waterLevel ?? 0;
  const score = data.WaterQualityScore ?? data.waterQualityScore ?? data.score ?? 0;
  const status = data.TankStatus || data.tankStatus || data.status || "Unknown";
  const lastUpdated = data.LastUpdated || data.Timestamp || "--";

  const isOnline = liveData !== null && liveData !== undefined && Object.keys(liveData).length > 0;

  return {
    id: tankId,
    tankId: tankId,
    name: meta.name || meta.tankName || `Tank ${tankId}`,
    status: isOnline ? 'online' : 'offline',
    tankStatus: status,
    isOnline: isOnline,
    level: Number(waterLevel),
    ph: Number(ph),
    tds: Number(tds),
    ec: Number(ec),
    temperature: Number(temp),
    turbidity: Number(turbidity),
    waterQualityScore: Number(score),
    lastUpdated: lastUpdated,
    location: meta.location || 'Main Storage Tank',
    capacity: meta.capacity || '5,000 L',
    installationDate: meta.installationDate || '--',
    lastMaintenance: meta.lastMaintenance || '--',
    sensorStatus: meta.sensorStatus || 'Active'
  };
}

/**
 * 1. Listen to Live Data at WaterMonitoring/Tank1/Live
 */
export function listenToLive(onUpdate) {
  if (!db) {
    console.warn("[Firebase] Realtime listener skipped: Database not connected.");
    onUpdate(null);
    return () => { };
  }

  const primaryPath = `WaterMonitoring/${CURRENT_TANK}/Live`;
  console.log(`[Firebase] Subscribing to live telemetry listener at path: ${primaryPath}`);

  const handleData = (snapshotVal) => {
    console.log("Firebase snapshot received:", snapshotVal);
    cachedLiveState = snapshotVal;
    if (snapshotVal) {
      autoRecordLiveTelemetry(CURRENT_TANK, snapshotVal, cachedMetadataState);
    }
    onUpdate(cachedLiveState);
  };

  const listener = db.ref(primaryPath).on('value', (snapshot) => {
    const val = snapshot.val();
    if (val && Object.keys(val).length > 0) {
      handleData(val);
    } else {
      console.log(`[Firebase] Primary path ${primaryPath} returned null. Checking fallback paths...`);
      const fallbacks = [
        `WaterMonitoring/${CURRENT_TANK}`,
        `WaterMonitoring/Live`,
        `tanks/${CURRENT_TANK}/LIVE`,
        `tanks/${CURRENT_TANK}/Live`,
        `${CURRENT_TANK}/Live`,
        `${CURRENT_TANK}`,
        'LIVE',
        'Live'
      ];
      let found = false;
      let checked = 0;
      fallbacks.forEach(altPath => {
        db.ref(altPath).once('value', (altSnap) => {
          checked++;
          if (altSnap.exists() && altSnap.val() && !found) {
            found = true;
            console.log(`[Firebase] Live telemetry fallback path matched: ${altPath}`);
            handleData(altSnap.val());
          } else if (checked === fallbacks.length && !found) {
            handleData(null);
          }
        });
      });
    }
  }, (err) => {
    console.error(`[Firebase] Error reading ${primaryPath}:`, err);
  });

  activeListeners[primaryPath] = listener;

  return () => {
    if (db) db.ref(primaryPath).off('value', listener);
  };
}

/**
 * 2. Listen to Metadata at WaterMonitoring/Tank1/Metadata
 */
export function listenToMetadata(onUpdate) {
  if (!db) {
    onUpdate(null);
    return () => { };
  }

  const path = `WaterMonitoring/${CURRENT_TANK}/Metadata`;
  console.log(`[Firebase] Subscribing to metadata listener at path: ${path}`);

  const listener = db.ref(path).on('value', (snapshot) => {
    cachedMetadataState = snapshot.val();
    onUpdate(cachedMetadataState);
  }, (err) => {
    console.error(`[Firebase] Error reading ${path}:`, err);
  });

  activeListeners[path] = listener;

  return () => {
    if (db) db.ref(path).off('value', listener);
  };
}

/**
 * Unified listener feeding Tanks array to Dashboard views
 */
export function listenToTanksData(onUpdate) {
  if (!db) {
    // Return empty list if Firebase is not connected yet
    onUpdate([]);
    return () => { };
  }

  const notify = () => {
    const tankObj = normalizeTankData(CURRENT_TANK, cachedLiveState, cachedMetadataState);
    onUpdate([tankObj]);
  };

  const unsubLive = listenToLive(() => notify());
  const unsubMeta = listenToMetadata(() => notify());

  return () => {
    unsubLive();
    unsubMeta();
  };
}

/**
 * Auto-archives incoming live telemetry frames into cached history list and Firebase History
 */
export function autoRecordLiveTelemetry(tankId, liveData, metadata) {
  if (!liveData) return null;
  const rawTs = liveData.LastUpdated || liveData.Timestamp || liveData.timestamp || Date.now();
  const ts = parseTimestamp(rawTs);

  const ph = Number(liveData.pH ?? liveData.ph ?? 7.0);
  const tds = Number(liveData.TDS ?? liveData.tds ?? 0);
  const ec = Number(liveData.EC ?? liveData.ec ?? 0);
  const temp = Number(liveData.Temperature ?? liveData.temperature ?? liveData.temp ?? 0);
  const level = Number(liveData.WaterLevel ?? liveData.waterLevel ?? liveData.level ?? 0);
  const turbidity = Number(liveData.Turbidity ?? liveData.turbidity ?? 0);
  const score = Number(liveData.WaterQualityScore ?? liveData.waterQualityScore ?? liveData.score ?? liveData.wqi ?? 80);

  const item = {
    id: `${tankId}_${ts}`,
    tankId: tankId,
    tankName: metadata?.name || metadata?.tankName || `Tank ${tankId}`,
    location: metadata?.location || (cachedMetadataState ? cachedMetadataState.location : 'Main Storage Tank'),
    timestamp: ts,
    ph: ph,
    tds: tds,
    ec: ec,
    temperature: temp,
    level: level,
    turbidity: turbidity,
    waterQualityScore: score
  };

  const exists = cachedHistoryList.some(h => Math.abs((h.timestamp || 0) - ts) < 2000);
  if (!exists) {
    cachedHistoryList.unshift(item);
    cachedHistoryList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (db) {
      try {
        db.ref(`WaterMonitoring/${tankId}/History`).push(item).catch(() => {});
      } catch (e) {}
    }
  }

  return item;
}

/**
 * 3. Listen to History at WaterMonitoring/Tank1/History
 */
export function listenToHistoryData(onUpdate) {
  if (!db) {
    if (cachedHistoryList.length === 0 && cachedLiveState) {
      autoRecordLiveTelemetry(CURRENT_TANK, cachedLiveState, cachedMetadataState);
    }
    onUpdate(cachedHistoryList);
    return () => { };
  }

  const path = `WaterMonitoring/${CURRENT_TANK}/History`;
  console.log(`[Firebase] Subscribing to history listener at path: ${path}`);

  const listener = db.ref(path).on('value', (snapshot) => {
    const val = snapshot.val();
    let fbHistory = [];
    if (val) {
      if (Array.isArray(val)) {
        fbHistory = val.map((item, idx) => {
          const rawTs = item.Timestamp || item.timestamp || item.LastUpdated || item.lastUpdated || Date.now();
          const ts = parseTimestamp(rawTs);
          return {
            id: item.id || `${CURRENT_TANK}_${ts}_${idx}`,
            tankId: item.tankId || CURRENT_TANK,
            tankName: item.tankName || `Tank ${CURRENT_TANK}`,
            location: item.location || (cachedMetadataState ? cachedMetadataState.location : 'Main Storage Tank'),
            timestamp: ts,
            ph: Number(item.pH ?? item.ph ?? 7.0),
            tds: Number(item.TDS ?? item.tds ?? 0),
            ec: Number(item.EC ?? item.ec ?? 0),
            temperature: Number(item.Temperature ?? item.temperature ?? item.temp ?? 0),
            level: Number(item.WaterLevel ?? item.waterLevel ?? item.level ?? 0),
            turbidity: Number(item.Turbidity ?? item.turbidity ?? 0),
            waterQualityScore: Number(item.WaterQualityScore ?? item.waterQualityScore ?? item.score ?? item.wqi ?? 80)
          };
        });
      } else if (typeof val === 'object') {
        fbHistory = Object.keys(val).map(key => {
          const item = val[key];
          const rawTs = item.Timestamp || item.timestamp || item.LastUpdated || item.lastUpdated || key;
          const ts = parseTimestamp(rawTs);
          return {
            id: item.id || key,
            tankId: item.tankId || CURRENT_TANK,
            tankName: item.tankName || `Tank ${CURRENT_TANK}`,
            location: item.location || (cachedMetadataState ? cachedMetadataState.location : 'Main Storage Tank'),
            timestamp: ts,
            ph: Number(item.pH ?? item.ph ?? 7.0),
            tds: Number(item.TDS ?? item.tds ?? 0),
            ec: Number(item.EC ?? item.ec ?? 0),
            temperature: Number(item.Temperature ?? item.temperature ?? item.temp ?? 0),
            level: Number(item.WaterLevel ?? item.waterLevel ?? item.level ?? 0),
            turbidity: Number(item.Turbidity ?? item.turbidity ?? 0),
            waterQualityScore: Number(item.WaterQualityScore ?? item.waterQualityScore ?? item.score ?? item.wqi ?? 80)
          };
        });
      }
    }

    fbHistory.forEach(item => {
      const exists = cachedHistoryList.some(c => c.id === item.id || Math.abs((c.timestamp || 0) - item.timestamp) < 2000);
      if (!exists) {
        cachedHistoryList.push(item);
      }
    });

    if (cachedHistoryList.length === 0 && cachedLiveState) {
      autoRecordLiveTelemetry(CURRENT_TANK, cachedLiveState, cachedMetadataState);
    }

    cachedHistoryList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    onUpdate(cachedHistoryList);
  }, (err) => {
    console.error(`[Firebase] Error reading ${path}:`, err);
    if (cachedHistoryList.length === 0 && cachedLiveState) {
      autoRecordLiveTelemetry(CURRENT_TANK, cachedLiveState, cachedMetadataState);
    }
    onUpdate(cachedHistoryList);
  });

  activeListeners[path] = listener;

  return () => {
    if (db) db.ref(path).off('value', listener);
  };
}

/**
 * Filter cached Firebase history records
 */
export function getHistoryData(filters = {}) {
  if (cachedHistoryList.length === 0 && cachedLiveState) {
    autoRecordLiveTelemetry(CURRENT_TANK, cachedLiveState, cachedMetadataState);
  }

  let filtered = [...cachedHistoryList];

  if (filters.tankId && filters.tankId !== 'all') {
    filtered = filtered.filter(item => item.tankId === filters.tankId || filters.tankId === CURRENT_TANK);
  }

  if (filters.startTimestamp) {
    filtered = filtered.filter(item => item.timestamp >= filters.startTimestamp);
  }

  if (filters.endTimestamp) {
    filtered = filtered.filter(item => item.timestamp <= filters.endTimestamp);
  }

  return filtered;
}

/**
 * 4. Listen to Alerts at WaterMonitoring/Tank1/Alerts
 */
export function listenToAlerts(onUpdate) {
  if (!db) {
    onUpdate([]);
    return () => { };
  }

  const path = `WaterMonitoring/${CURRENT_TANK}/Alerts`;
  console.log(`[Firebase] Subscribing to alerts listener at path: ${path}`);

  const listener = db.ref(path).on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      if (Array.isArray(val)) {
        cachedAlertsList = val.map((a, idx) => ({ id: a.id || idx, ...a }));
      } else if (typeof val === 'object') {
        cachedAlertsList = Object.keys(val).map(key => ({
          id: val[key].id || key,
          type: val[key].type || val[key].parameter || 'Sensor Alert',
          tank: val[key].tank || `Tank ${CURRENT_TANK}`,
          severity: val[key].severity || 'warning',
          time: val[key].time || (val[key].timestamp ? new Date(val[key].timestamp).toLocaleTimeString() : 'Just now'),
          timestamp: val[key].timestamp || Date.now(),
          value: val[key].value || '--',
          param: val[key].parameter || val[key].param || 'general'
        }));
      }
    } else {
      cachedAlertsList = [];
    }

    onUpdate(cachedAlertsList);
  }, (err) => {
    console.error(`[Firebase] Error reading ${path}:`, err);
  });

  activeListeners[path] = listener;

  return () => {
    if (db) db.ref(path).off('value', listener);
  };
}

/**
 * 5. Listen to Settings at WaterMonitoring/Settings
 */
export function listenToSettings(onUpdate) {
  if (!db) {
    onUpdate(null);
    return () => { };
  }

  const path = `WaterMonitoring/Settings`;
  console.log(`[Firebase] Subscribing to settings listener at path: ${path}`);

  const listener = db.ref(path).on('value', (snapshot) => {
    cachedSettingsState = snapshot.val();
    if (cachedSettingsState) {
      updateThresholdsFromSettings(cachedSettingsState);
    }
    if (onUpdate) onUpdate(cachedSettingsState);
  }, (err) => {
    console.error(`[Firebase] Error reading ${path}:`, err);
  });

  activeListeners[path] = listener;

  return () => {
    if (db) db.ref(path).off('value', listener);
  };
}

/**
 * Save updated threshold settings directly to Firebase
 */
export async function saveSettingsToFirebase(settingsData) {
  if (!db) {
    console.warn("[Firebase] Save settings failed: Database not initialized.");
    return false;
  }

  try {
    await db.ref(`WaterMonitoring/Settings`).set(settingsData);
    console.log("[Firebase] Settings updated in database successfully.");
    return true;
  } catch (err) {
    console.error("[Firebase] Failed to write settings to database:", err);
    throw err;
  }
}

let cachedComplaintsList = [];
let cachedComplaintsSummary = null;

/**
 * 6. Listen to Complaints at WaterMonitoring/Tank1/Complaints
 */
export function listenToComplaints(onUpdate) {
  if (!db) {
    onUpdate([]);
    return () => { };
  }

  const path = `WaterMonitoring/${CURRENT_TANK}/Complaints`;
  console.log(`[Firebase] Subscribing to complaints listener at path: ${path}`);

  const listener = db.ref(path).on('value', (snapshot) => {
    const val = snapshot.val();
    if (val) {
      if (Array.isArray(val)) {
        cachedComplaintsList = val.filter(Boolean).map((c, idx) => ({ id: c.complaintId || idx, ...c }));
      } else if (typeof val === 'object') {
        cachedComplaintsList = Object.keys(val).map(key => ({
          id: key,
          complaintId: val[key].complaintId || key,
          ...val[key]
        }));
      }
      // Sort complaints descending by timestamp (newest first)
      cachedComplaintsList.sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
    } else {
      cachedComplaintsList = [];
    }

    onUpdate(cachedComplaintsList);
  }, (err) => {
    console.error(`[Firebase] Error reading ${path}:`, err);
  });

  activeListeners[path] = listener;

  return () => {
    if (db) db.ref(path).off('value', listener);
  };
}

/**
 * 7. Listen to Complaints Summary at WaterMonitoring/Tank1/ComplaintsSummary
 */
export function listenToComplaintsSummary(onUpdate) {
  if (!db) {
    onUpdate(null);
    return () => { };
  }

  const path = `WaterMonitoring/${CURRENT_TANK}/ComplaintsSummary`;
  console.log(`[Firebase] Subscribing to complaints summary listener at path: ${path}`);

  const listener = db.ref(path).on('value', (snapshot) => {
    cachedComplaintsSummary = snapshot.val();
    if (onUpdate) onUpdate(cachedComplaintsSummary);
  }, (err) => {
    console.error(`[Firebase] Error reading ${path}:`, err);
  });

  activeListeners[path] = listener;

  return () => {
    if (db) db.ref(path).off('value', listener);
  };
}

/**
 * Update complaint status (Pending, In Review, Resolved, Rejected, Escalated)
 * and trigger 24-hour maintenance cooldown if Resolved.
 */
export async function updateComplaintStatusInFirebase(complaintId, newStatus, resolutionNote = "") {
  if (!db) return false;

  try {
    const updates = {};
    updates[`WaterMonitoring/${CURRENT_TANK}/Complaints/${complaintId}/status`] = newStatus;
    if (resolutionNote) {
      updates[`WaterMonitoring/${CURRENT_TANK}/Complaints/${complaintId}/resolutionNote`] = resolutionNote;
    }
    updates[`WaterMonitoring/${CURRENT_TANK}/Complaints/${complaintId}/updatedAt`] = Date.now();

    // If status is marked as Resolved, start 24-hour Maintenance Cooldown
    if (newStatus === "Resolved") {
      const cooldownEndsAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
      updates[`WaterMonitoring/${CURRENT_TANK}/ComplaintsSummary/MaintenanceCooldown`] = {
        Active: true,
        EndsAt: cooldownEndsAt,
        ResolvedAt: new Date().toISOString()
      };
    }

    await db.ref().update(updates);
    console.log(`[Firebase] Complaint ${complaintId} status updated to ${newStatus}`);
    return true;
  } catch (err) {
    console.error(`[Firebase] Failed to update complaint status:`, err);
    throw err;
  }
}

/**
 * Clear active escalation flag for the tank
 */
export async function clearTankEscalationInFirebase() {
  if (!db) return false;
  try {
    const summaryRef = db.ref(`WaterMonitoring/${CURRENT_TANK}/ComplaintsSummary`);
    await summaryRef.update({
      Escalated: false,
      EscalationClearedAt: new Date().toISOString()
    });
    console.log(`[Firebase] Escalation cleared for ${CURRENT_TANK}`);
    return true;
  } catch (err) {
    console.error(`[Firebase] Failed to clear escalation:`, err);
    throw err;
  }
}

