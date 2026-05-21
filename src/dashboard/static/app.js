// State
let currentDays = 30;
let trendChart = null;
let toolsChart = null;

// Format helpers
function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatCost(usd) {
  if (usd >= 1) return '$' + usd.toFixed(2);
  if (usd >= 0.01) return '$' + usd.toFixed(3);
  return '$' + usd.toFixed(4);
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + 'h ago';
  return d.toLocaleDateString();
}

// Chart colors
const COLORS = {
  blue: '#58a6ff',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  purple: '#bc8cff',
  cyan: '#39d2c0',
};

const CHART_COLORS = [COLORS.blue, COLORS.green, COLORS.yellow, COLORS.red, COLORS.purple, COLORS.cyan];

// API fetch
async function api(path) {
  const res = await fetch(path);
  return res.json();
}

// Update stats cards
async function updateOverview() {
  const data = await api('/api/overview');

  document.getElementById('today-tokens').textContent = formatTokens(data.today.input_tokens + data.today.output_tokens);
  document.getElementById('today-calls').textContent = data.today.calls.toLocaleString() + ' calls';

  document.getElementById('week-tokens').textContent = formatTokens(data.week.input_tokens + data.week.output_tokens);
  document.getElementById('week-calls').textContent = data.week.calls.toLocaleString() + ' calls';

  document.getElementById('month-tokens').textContent = formatTokens(data.month.input_tokens + data.month.output_tokens);
  document.getElementById('month-calls').textContent = data.month.calls.toLocaleString() + ' calls';

  document.getElementById('total-cost').textContent = formatCost(data.month.cost);
  document.getElementById('total-tokens').textContent = formatTokens(data.month.input_tokens + data.month.output_tokens) + ' total tokens';
}

// Update trend chart
async function updateTrendChart() {
  const data = await api('/api/daily?days=' + currentDays);

  const labels = data.map(d => d.date).reverse();
  const inputTokens = data.map(d => d.total_input_tokens).reverse();
  const outputTokens = data.map(d => d.total_output_tokens).reverse();

  const ctx = document.getElementById('trend-chart').getContext('2d');

  if (trendChart) {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = inputTokens;
    trendChart.data.datasets[1].data = outputTokens;
    trendChart.update();
    return;
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Input Tokens',
          data: inputTokens,
          borderColor: COLORS.blue,
          backgroundColor: COLORS.blue + '20',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Output Tokens',
          data: outputTokens,
          borderColor: COLORS.green,
          backgroundColor: COLORS.green + '20',
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#8b949e' },
        },
      },
      scales: {
        x: {
          grid: { color: '#30363d' },
          ticks: { color: '#8b949e' },
        },
        y: {
          grid: { color: '#30363d' },
          ticks: {
            color: '#8b949e',
            callback: (v) => formatTokens(v),
          },
        },
      },
    },
  });
}

// Update tools chart
async function updateToolsChart() {
  const data = await api('/api/tools?days=' + currentDays);

  const top5 = data.slice(0, 5);
  const labels = top5.map(d => d.tool_name);
  const values = top5.map(d => d.total_input_tokens + d.total_output_tokens);

  const ctx = document.getElementById('tools-chart').getContext('2d');

  if (toolsChart) {
    toolsChart.data.labels = labels;
    toolsChart.data.datasets[0].data = values;
    toolsChart.update();
    return;
  }

  toolsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS,
        borderColor: '#161b22',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b949e', padding: 12 },
        },
      },
    },
  });
}

// Update calls table
async function updateCallsTable() {
  const data = await api('/api/calls?limit=20');

  const tbody = document.getElementById('calls-table');

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-icon">📊</div>
          No tool calls recorded yet.<br>
          <small>Start using Claude Code to see data here.</small>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(call => `
    <tr>
      <td>${formatTime(call.timestamp)}</td>
      <td><strong>${escapeHtml(call.tool_name)}</strong></td>
      <td class="token-value">${formatTokens(call.input_tokens)}</td>
      <td class="token-value">${formatTokens(call.output_tokens)}</td>
      <td class="token-value">${formatCost(call.estimated_cost)}</td>
      <td>${call.is_error ? '<span class="badge badge-error">Error</span>' : '<span class="badge badge-success">OK</span>'}</td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Refresh all
async function refresh() {
  await Promise.all([
    updateOverview(),
    updateTrendChart(),
    updateToolsChart(),
    updateCallsTable(),
  ]);
}

// Period selector
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDays = parseInt(btn.dataset.days);
    refresh();
  });
});

// Initial load
refresh();

// Auto-refresh every 5 seconds
setInterval(refresh, 5000);
