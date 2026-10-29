/**
 * Smart Water Monitoring Platform - Chart.js Configurations
 */

import { getHistoryData } from './firebase.js';

let charts = {};

// Helper: Get grid and text color based on active theme
function getThemeColors() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  return {
    text: isDark ? '#9db3d6' : '#5b7295',
    grid: isDark ? 'rgba(90, 130, 190, 0.15)' : 'rgba(15, 55, 105, 0.05)',
    brand: '#1e88e5',
    brandLight: 'rgba(30, 136, 229, 0.1)'
  };
}

export function initCharts(tankId = 'all') {
  const history = getHistoryData({ tankId });
  if (history.length === 0) return;

  // Take the last 15 readings for visualization trends (order chronologically)
  const trendData = [...history].slice(0, 15).reverse();
  const labels = trendData.map(h => {
    const d = new Date(h.timestamp);
    const mins = d.getMinutes() < 10 ? `0${d.getMinutes()}` : d.getMinutes();
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${mins}`;
  });

  const colors = getThemeColors();

  // Destroy previous charts if they exist
  Object.keys(charts).forEach(key => {
    if (charts[key]) charts[key].destroy();
  });

  // Helper to create basic line chart options
  const lineOptions = (title, min, max) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: colors.text, font: { family: 'Segoe UI', size: 13, weight: 'bold' } }
    },
    scales: {
      x: { grid: { color: colors.grid }, ticks: { color: colors.text, maxRotation: 45, minRotation: 45 } },
      y: { min, max, grid: { color: colors.grid }, ticks: { color: colors.text } }
    }
  });

  // 1. pH Trend Chart
  const phCtx = document.getElementById('phTrendChart');
  if (phCtx) {
    charts.ph = new Chart(phCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: trendData.map(h => h.ph),
          borderColor: '#00c2ff',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: lineOptions('pH Level Trend', 5, 9)
    });
  }

  // 2. TDS Trend Chart
  const tdsCtx = document.getElementById('tdsTrendChart');
  if (tdsCtx) {
    charts.tds = new Chart(tdsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: trendData.map(h => h.tds),
          borderColor: '#1e88e5',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: lineOptions('TDS Level (ppm) Trend', 100, 500)
    });
  }

  // 3. Temperature Trend Chart
  const tempCtx = document.getElementById('tempTrendChart');
  if (tempCtx) {
    charts.temp = new Chart(tempCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: trendData.map(h => h.temperature),
          borderColor: '#e0403f',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: lineOptions('Temperature (°C) Trend', 10, 40)
    });
  }

  // 4. Turbidity Trend Chart
  const turbidityCtx = document.getElementById('turbidityTrendChart');
  if (turbidityCtx) {
    charts.turbidity = new Chart(turbidityCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: trendData.map(h => h.turbidity),
          borderColor: '#e8a317',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: lineOptions('Turbidity (NTU) Trend', 0, 10)
    });
  }

  // 5. Water Level Trend Area Chart
  const levelCtx = document.getElementById('levelTrendChart');
  if (levelCtx) {
    charts.level = new Chart(levelCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: trendData.map(h => h.level),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.15)',
          fill: true,
          borderWidth: 2.5,
          tension: 0.2,
          pointRadius: 3
        }]
      },
      options: lineOptions('Water Level (%) Trend', 0, 100)
    });
  }

  // 6. Comparison Bar Chart (Daily, Weekly, Monthly Averages)
  const compareCtx = document.getElementById('comparisonAvgChart');
  if (compareCtx) {
    // Perform average calculations
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    const dailyData = history.filter(h => h.timestamp >= now - oneDay);
    const weeklyData = history.filter(h => h.timestamp >= now - 7 * oneDay);
    const monthlyData = history; // past 30 days is our total pool

    const getAvg = (arr, key) => arr.length ? arr.reduce((s, v) => s + v[key], 0) / arr.length : 0;

    const metrics = ['ph', 'tds', 'turbidity', 'temperature'];
    const metricLabels = ['pH', 'TDS (/10)', 'Turbidity (NTU)', 'Temp (°C)'];

    charts.compare = new Chart(compareCtx, {
      type: 'bar',
      data: {
        labels: metricLabels,
        datasets: [
          {
            label: 'Daily Avg',
            data: [
              getAvg(dailyData, 'ph'),
              getAvg(dailyData, 'tds') / 10,
              getAvg(dailyData, 'turbidity'),
              getAvg(dailyData, 'temperature')
            ],
            backgroundColor: '#1e88e5'
          },
          {
            label: 'Weekly Avg',
            data: [
              getAvg(weeklyData, 'ph'),
              getAvg(weeklyData, 'tds') / 10,
              getAvg(weeklyData, 'turbidity'),
              getAvg(weeklyData, 'temperature')
            ],
            backgroundColor: '#00c2ff'
          },
          {
            label: 'Monthly Avg',
            data: [
              getAvg(monthlyData, 'ph'),
              getAvg(monthlyData, 'tds') / 10,
              getAvg(monthlyData, 'turbidity'),
              getAvg(monthlyData, 'temperature')
            ],
            backgroundColor: '#16a34a'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text, font: { family: 'Segoe UI', size: 10 } } }
        },
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
          y: { grid: { color: colors.grid }, ticks: { color: colors.text } }
        }
      }
    });
  }

  // Listen to theme change events to re-render charts matching light/dark colors
  window.removeEventListener('theme-changed', reThemeCharts);
  window.addEventListener('theme-changed', reThemeCharts);
}

function reThemeCharts() {
  const colors = getThemeColors();
  Object.keys(charts).forEach(key => {
    const chart = charts[key];
    if (chart) {
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = colors.grid;
        chart.options.scales.x.ticks.color = colors.text;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.grid.color = colors.grid;
        chart.options.scales.y.ticks.color = colors.text;
      }
      if (chart.options.plugins.title) {
        chart.options.plugins.title.color = colors.text;
      }
      chart.update('none');
    }
  });
}
