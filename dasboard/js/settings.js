/**
 * Smart Water Monitoring Platform - Settings Module (Firebase Connected)
 */

import { THRESHOLDS } from './utils.js';
import { listenToSettings, saveSettingsToFirebase } from './firebase.js';

export function initSettings() {
  populateSettingsForm();

  // Listen to realtime settings from Firebase
  listenToSettings((settings) => {
    populateSettingsForm();
    if (window.refreshDashboardUI) {
      window.refreshDashboardUI();
    }
  });

  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }

  const resetBtn = document.getElementById('resetSettingsBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetSettings);
  }
}

function populateSettingsForm() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('setPhMin', THRESHOLDS.ph.goodMin);
  setVal('setPhMax', THRESHOLDS.ph.goodMax);
  setVal('setTdsMax', THRESHOLDS.tds.goodMax);
  setVal('setEcMax', THRESHOLDS.ec.goodMax);
  setVal('setTempMax', THRESHOLDS.temperature.goodMax);
  setVal('setTurbidityMax', THRESHOLDS.turbidity.goodMax);
  setVal('setLevelMin', THRESHOLDS.level.goodMin);
}

async function saveSettings(e) {
  if (e) e.preventDefault();

  const getVal = (id, fallback) => {
    const el = document.getElementById(id);
    return el && el.value !== '' ? parseFloat(el.value) : fallback;
  };

  const newSettings = {
    phMin: getVal('setPhMin', 6.5),
    phMax: getVal('setPhMax', 8.0),
    tdsMax: getVal('setTdsMax', 300),
    ecMax: getVal('setEcMax', 800),
    temperatureMax: getVal('setTempMax', 30),
    turbidityMax: getVal('setTurbidityMax', 3),
    levelMin: getVal('setLevelMin', 40),
    lastUpdated: Date.now()
  };

  // Update local thresholds immediately
  THRESHOLDS.ph.goodMin = newSettings.phMin;
  THRESHOLDS.ph.goodMax = newSettings.phMax;
  THRESHOLDS.tds.goodMax = newSettings.tdsMax;
  THRESHOLDS.ec.goodMax = newSettings.ecMax;
  THRESHOLDS.temperature.goodMax = newSettings.temperatureMax;
  THRESHOLDS.turbidity.goodMax = newSettings.turbidityMax;
  THRESHOLDS.level.goodMin = newSettings.levelMin;

  // Persist to Firebase Realtime Database at WaterMonitoring/Settings
  try {
    await saveSettingsToFirebase(newSettings);
    if (window.showToast) {
      window.showToast('Sensor threshold configurations saved to Firebase!', 'checkCircle');
    }
  } catch (err) {
    if (window.showToast) {
      window.showToast('Local thresholds updated. Firebase save pending configuration.', 'alertTriangle');
    }
  }

  if (window.refreshDashboardUI) {
    window.refreshDashboardUI();
  }
}

async function resetSettings() {
  const defaultSettings = {
    phMin: 6.5,
    phMax: 8.0,
    tdsMax: 300,
    ecMax: 800,
    temperatureMax: 30,
    turbidityMax: 3,
    levelMin: 40,
    lastUpdated: Date.now()
  };

  THRESHOLDS.ph.goodMin = defaultSettings.phMin;
  THRESHOLDS.ph.goodMax = defaultSettings.phMax;
  THRESHOLDS.tds.goodMax = defaultSettings.tdsMax;
  THRESHOLDS.ec.goodMax = defaultSettings.ecMax;
  THRESHOLDS.temperature.goodMax = defaultSettings.temperatureMax;
  THRESHOLDS.turbidity.goodMax = defaultSettings.turbidityMax;
  THRESHOLDS.level.goodMin = defaultSettings.levelMin;

  populateSettingsForm();

  try {
    await saveSettingsToFirebase(defaultSettings);
    if (window.showToast) {
      window.showToast('Settings reset to default safe thresholds.', 'checkCircle');
    }
  } catch (err) {
    if (window.showToast) {
      window.showToast('Thresholds reset locally.', 'checkCircle');
    }
  }

  if (window.refreshDashboardUI) {
    window.refreshDashboardUI();
  }
}
