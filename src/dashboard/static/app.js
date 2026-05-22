// State
let currentDays = 30;
let trendChart = null;
let toolsChart = null;
let costChart = null;
let hourlyChart = null;

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
  if (!ts) return '-';
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

function formatDuration(start, end) {
  if (!start || !end) return '-';
  const diffMs = new Date(end) - new Date(start);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return diffMins + 'm';
  const diffHours = Math.floor(diffMins / 60);
  const remainMins = diffMins % 60;
  if (diffHours < 24) return diffHours + 'h ' + remainMins + 'm';
  const diffDays = Math.floor(diffHours / 24);
  return diffDays + 'd ' + (diffHours % 24) + 'h';
}

function shortenSessionId(id) {
  if (!id) return '-';
  if (id.length <= 12) return id;
  return id.slice(0, 8) + '...';
}

function formatSessionLabel(stat) {
  const project = stat.project || '';
  const time = stat.first_call ? new Date(stat.first_call).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';
  if (project && time) return project + ' — ' + time;
  if (project) return project;
  if (time) return time;
  return shortenSessionId(stat.session_id);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatChange(pct) {
  if (pct === 0 || isNaN(pct) || !isFinite(pct)) return '';
  const sign = pct > 0 ? '+' : '';
  return sign + Math.round(pct) + '%';
}

// Chart colors
const COLORS = {
  blue: '#58a6ff',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  purple: '#bc8cff',
  cyan: '#39d2c0',
  orange: '#f0883e',
  pink: '#f778ba',
};
const CHART_COLORS = [COLORS.blue, COLORS.green, COLORS.yellow, COLORS.red, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink];

// API fetch
async function api(path) {
  const res = await fetch(path);
  return res.json();
}

// Draw sparkline on a canvas
function drawSparkline(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!data || data.length < 2) return;

  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = h - (data[i] / max) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill area
  ctx.lineTo((data.length - 1) * step, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = color.replace(')', ',0.08)').replace('rgb', 'rgba');
  ctx.fill();
}

// Update stats cards
async function updateOverview() {
  const [overview, daily] = await Promise.all([
    api('/api/overview'),
    api('/api/daily?days=8'),
  ]);

  const data = overview;

  // Today
  document.getElementById('today-tokens').textContent = formatTokens(data.today.input_tokens + data.today.output_tokens);
  document.getElementById('today-calls').textContent = data.today.calls.toLocaleString() + ' calls';
  document.getElementById('today-input').textContent = '↓ ' + formatTokens(data.today.input_tokens);
  document.getElementById('today-output').textContent = '↑ ' + formatTokens(data.today.output_tokens);

  // Today change vs yesterday
  if (daily.length >= 2) {
    const todayTotal = data.today.input_tokens + data.today.output_tokens;
    const yesterday = daily.find(d => {
      const dDate = new Date(d.date).toDateString();
      const yesterdayDate = new Date(Date.now() - 86400000).toDateString();
      return dDate === yesterdayDate;
    });
    if (yesterday) {
      const yTotal = yesterday.total_input_tokens + yesterday.total_output_tokens;
      if (yTotal > 0) {
        const pct = ((todayTotal - yTotal) / yTotal) * 100;
        const el = document.getElementById('today-change');
        el.textContent = formatChange(pct);
        el.className = 'stat-change ' + (pct >= 0 ? 'up' : 'down');
      }
    }
  }

  // Week
  document.getElementById('week-tokens').textContent = formatTokens(data.week.input_tokens + data.week.output_tokens);
  document.getElementById('week-calls').textContent = data.week.calls.toLocaleString() + ' calls';
  document.getElementById('week-input').textContent = '↓ ' + formatTokens(data.week.input_tokens);
  document.getElementById('week-output').textContent = '↑ ' + formatTokens(data.week.output_tokens);

  // Month
  document.getElementById('month-tokens').textContent = formatTokens(data.month.input_tokens + data.month.output_tokens);
  document.getElementById('month-calls').textContent = data.month.calls.toLocaleString() + ' calls';
  document.getElementById('month-input').textContent = '↓ ' + formatTokens(data.month.input_tokens);
  document.getElementById('month-output').textContent = '↑ ' + formatTokens(data.month.output_tokens);

  // Cost
  document.getElementById('total-cost').textContent = formatCost(data.month.cost);
  document.getElementById('cost-month').textContent = formatCost(data.all_time.cost) + ' all time';
  document.getElementById('total-tokens').textContent = formatTokens(data.month.input_tokens + data.month.output_tokens) + ' total tokens';

  // Cache hit rate (month)
  const monthCacheRead = data.month.cache_read_tokens || 0;
  const monthInput = data.month.input_tokens || 0;
  const cacheHitRate = monthInput > 0 ? Math.round((monthCacheRead / monthInput) * 100) : 0;
  document.getElementById('cache-rate').textContent = cacheHitRate + '%';
  document.getElementById('cache-read').textContent = '↓ ' + formatTokens(monthCacheRead) + ' read';
  document.getElementById('cache-write').textContent = '↑ ' + formatTokens(data.month.cache_creation_tokens || 0) + ' write';
  document.getElementById('cache-tokens').textContent = formatTokens(monthCacheRead + (data.month.cache_creation_tokens || 0)) + ' cached';

  // Sparklines from daily data (last 7 days)
  const recent = daily.slice(0, 7).reverse();
  const inputTrend = recent.map(d => d.total_input_tokens);
  const outputTrend = recent.map(d => d.total_output_tokens);
  const totalTrend = recent.map(d => d.total_input_tokens + d.total_output_tokens);
  const costTrend = recent.map(d => d.total_cost);
  const cacheTrend = recent.map(d => d.total_cache_read_tokens || 0);

  drawSparkline('spark-today', totalTrend, COLORS.blue);
  drawSparkline('spark-week', totalTrend, COLORS.green);
  drawSparkline('spark-month', totalTrend, COLORS.yellow);
  drawSparkline('spark-cost', costTrend, COLORS.purple);
  drawSparkline('spark-cache', cacheTrend, COLORS.cyan);
}

// Update trend chart
async function updateTrendChart() {
  const data = await api('/api/daily?days=' + currentDays);
  const labels = data.map(d => d.date).reverse();
  const inputTokens = data.map(d => d.total_input_tokens).reverse();
  const outputTokens = data.map(d => d.total_output_tokens).reverse();
  const cacheReadTokens = data.map(d => d.total_cache_read_tokens || 0).reverse();

  const ctx = document.getElementById('trend-chart').getContext('2d');

  if (trendChart) {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = inputTokens;
    trendChart.data.datasets[1].data = outputTokens;
    trendChart.data.datasets[2].data = cacheReadTokens;
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
          backgroundColor: COLORS.blue + '18',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Output Tokens',
          data: outputTokens,
          borderColor: COLORS.green,
          backgroundColor: COLORS.green + '18',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Cache Read',
          data: cacheReadTokens,
          borderColor: COLORS.cyan,
          backgroundColor: COLORS.cyan + '18',
          fill: false,
          tension: 0.4,
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: '#8b949e', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#21262d',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: { grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { color: '#8b949e', font: { size: 10 }, maxRotation: 0 } },
        y: { grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { color: '#8b949e', font: { size: 10 }, callback: (v) => formatTokens(v) } },
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
        hoverBorderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', padding: 10, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1, titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10, cornerRadius: 8 },
      },
    },
  });
}

// Update cost by model chart
async function updateCostChart() {
  const data = await api('/api/models?days=' + currentDays);
  const filtered = data.filter(d => d.total_cost > 0);
  const labels = filtered.map(d => d.model);
  const values = filtered.map(d => d.total_cost);

  const ctx = document.getElementById('cost-chart').getContext('2d');

  if (costChart) {
    costChart.data.labels = labels;
    costChart.data.datasets[0].data = values;
    costChart.update();
    return;
  }

  costChart = new Chart(ctx, {
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
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', padding: 10, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1, titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10, cornerRadius: 8,
          callbacks: { label: (ctx) => ' ' + formatCost(ctx.parsed) }
        },
      },
    },
  });
}

// Update hourly activity chart
async function updateHourlyChart() {
  const calls = await api('/api/calls?limit=500');
  const hours = new Array(24).fill(0);
  calls.forEach(c => {
    const h = new Date(c.timestamp).getHours();
    hours[h]++;
  });

  const labels = hours.map((_, i) => i.toString().padStart(2, '0') + ':00');

  const ctx = document.getElementById('hourly-chart').getContext('2d');

  if (hourlyChart) {
    hourlyChart.data.datasets[0].data = hours;
    hourlyChart.update();
    return;
  }

  hourlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: hours,
        backgroundColor: COLORS.blue + '60',
        borderColor: COLORS.blue,
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: COLORS.blue,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1, titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10, cornerRadius: 8 },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { color: '#8b949e', font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
      },
    },
  });
}

// Render table with percentage bars
function renderTableRows(data, columns, totalTokens) {
  return data.map((stat, idx) => {
    const total = columns.totalFn(stat);
    const pct = totalTokens > 0 ? (total / totalTokens * 100) : 0;
    const cells = columns.fields.map(f => f(stat, totalTokens)).join('');
    return `<tr style="animation-delay:${idx * 0.03}s">${cells}</tr>`;
  }).join('');
}

// Update tools table
async function updateToolsTable() {
  const data = await api('/api/tools?days=' + currentDays);
  const tbody = document.getElementById('tools-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">\u{1F4CA}</div>No data yet</td></tr>';
    return;
  }

  const totalTokens = data.reduce((s, d) => s + d.total_input_tokens + d.total_output_tokens, 0);

  tbody.innerHTML = data.map((stat, idx) => {
    const t = stat.total_input_tokens + stat.total_output_tokens;
    const pct = totalTokens > 0 ? (t / totalTokens * 100) : 0;
    return `<tr style="animation:slideUp 0.3s ease ${idx*0.03}s both">
      <td><strong>${escapeHtml(stat.tool_name)}</strong></td>
      <td class="token-value">${stat.call_count.toLocaleString()}</td>
      <td class="token-value" style="position:relative"><span class="pct-bar" style="width:${pct}%"></span>${formatTokens(stat.total_input_tokens)}</td>
      <td class="token-value">${formatTokens(stat.total_output_tokens)}</td>
      <td class="token-value" style="position:relative"><span class="pct-bar" style="width:${pct}%"></span>${formatTokens(t)}</td>
      <td class="token-value">${formatCost(stat.total_cost)}</td>
    </tr>`;
  }).join('');
}

// Update sessions table
async function updateSessionsTable() {
  const data = await api('/api/sessions?days=' + currentDays);
  const tbody = document.getElementById('sessions-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">\u{1F517}</div>No sessions recorded</td></tr>';
    return;
  }

  const totalTokens = data.reduce((s, d) => s + d.total_input_tokens + d.total_output_tokens, 0);

  tbody.innerHTML = data.map((stat, idx) => {
    const t = stat.total_input_tokens + stat.total_output_tokens;
    const pct = totalTokens > 0 ? (t / totalTokens * 100) : 0;
    return `<tr style="animation:slideUp 0.3s ease ${idx*0.03}s both">
      <td title="${escapeHtml(stat.session_id)}">${escapeHtml(formatSessionLabel(stat))}</td>
      <td>${formatDuration(stat.first_call, stat.last_call)}</td>
      <td class="token-value">${stat.call_count.toLocaleString()}</td>
      <td class="token-value">${stat.tools_used}</td>
      <td class="token-value" style="position:relative"><span class="pct-bar" style="width:${pct}%"></span>${formatTokens(t)}</td>
      <td class="token-value">${formatCost(stat.total_cost)}</td>
    </tr>`;
  }).join('');
}

// Update models table
async function updateModelsTable() {
  const data = await api('/api/models?days=' + currentDays);
  const tbody = document.getElementById('models-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">\u{1F916}</div>No model data</td></tr>';
    return;
  }

  const totalCalls = data.reduce((s, d) => s + d.call_count, 0);
  const totalTokens = data.reduce((s, d) => s + d.total_input_tokens + d.total_output_tokens, 0);

  tbody.innerHTML = data.map((stat, idx) => {
    const t = stat.total_input_tokens + stat.total_output_tokens;
    const pct = totalTokens > 0 ? (t / totalTokens * 100) : 0;
    const callPct = totalCalls > 0 ? (stat.call_count / totalCalls * 100) : 0;
    return `<tr style="animation:slideUp 0.3s ease ${idx*0.03}s both">
      <td><strong>${escapeHtml(stat.model)}</strong> <span class="badge" style="background:rgba(88,166,255,0.1);color:var(--accent);font-size:10px">${Math.round(callPct)}%</span></td>
      <td class="token-value">${stat.call_count.toLocaleString()}</td>
      <td class="token-value">${formatTokens(stat.total_input_tokens)}</td>
      <td class="token-value">${formatTokens(stat.total_output_tokens)}</td>
      <td class="token-value" style="position:relative"><span class="pct-bar" style="width:${pct}%"></span>${formatTokens(t)}</td>
      <td class="token-value">${formatCost(stat.total_cost)}</td>
    </tr>`;
  }).join('');
}

// Update agents table
async function updateAgentsTable() {
  const data = await api('/api/agents?days=' + currentDays);
  const tbody = document.getElementById('agents-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">\u{1F3AF}</div>No agent data</td></tr>';
    return;
  }

  const totalCalls = data.reduce((s, d) => s + d.call_count, 0);
  const totalTokens = data.reduce((s, d) => s + d.total_input_tokens + d.total_output_tokens, 0);

  tbody.innerHTML = data.map((stat, idx) => {
    const t = stat.total_input_tokens + stat.total_output_tokens;
    const pct = totalTokens > 0 ? (t / totalTokens * 100) : 0;
    const callPct = totalCalls > 0 ? (stat.call_count / totalCalls * 100) : 0;
    return `<tr style="animation:slideUp 0.3s ease ${idx*0.03}s both">
      <td><strong>${escapeHtml(stat.agent_type)}</strong> <span class="badge" style="background:rgba(88,166,255,0.1);color:var(--accent);font-size:10px">${Math.round(callPct)}%</span></td>
      <td class="token-value">${stat.call_count.toLocaleString()}</td>
      <td class="token-value">${formatTokens(stat.total_input_tokens)}</td>
      <td class="token-value">${formatTokens(stat.total_output_tokens)}</td>
      <td class="token-value" style="position:relative"><span class="pct-bar" style="width:${pct}%"></span>${formatTokens(t)}</td>
      <td class="token-value">${formatCost(stat.total_cost)}</td>
    </tr>`;
  }).join('');
}

// Update calls table
async function updateCallsTable() {
  const data = await api('/api/calls?limit=20');
  const tbody = document.getElementById('calls-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="empty-icon">\u{1F4CA}</div>No tool calls recorded yet.<br><small>Start using Claude Code to see data here.</small></td></tr>';
    return;
  }

  tbody.innerHTML = data.map((call, idx) => {
    const cacheRead = call.cache_read_input_tokens || 0;
    const cacheCreate = call.cache_creation_input_tokens || 0;
    const input = call.input_tokens || 0;
    let cacheHtml = '-';
    if (cacheRead > 0 || cacheCreate > 0) {
      const hitRate = input > 0 ? Math.round((cacheRead / input) * 100) : 0;
      const parts = [];
      if (cacheRead > 0) parts.push(`<span class="cache-hit" title="Cache read">${formatTokens(cacheRead)}</span>`);
      if (cacheCreate > 0) parts.push(`<span class="cache-write" title="Cache write">${formatTokens(cacheCreate)}</span>`);
      cacheHtml = `<span class="cache-info">${parts.join(' ')} <span class="cache-rate">${hitRate}%</span></span>`;
    }
    const effort = call.effort || '-';
    return `<tr style="animation:slideUp 0.3s ease ${idx*0.02}s both">
      <td>${formatTime(call.timestamp)}</td>
      <td><strong>${escapeHtml(call.tool_name)}</strong></td>
      <td><span style="opacity:0.8">${escapeHtml(call.model || '-')}</span></td>
      <td><span class="badge" style="background:rgba(88,166,255,0.1);color:var(--accent)">${escapeHtml(effort)}</span></td>
      <td class="token-value">${formatTokens(call.input_tokens)}</td>
      <td class="token-value">${formatTokens(call.output_tokens)}</td>
      <td class="token-value">${cacheHtml}</td>
      <td class="token-value">${formatCost(call.estimated_cost)}</td>
      <td>${call.is_error ? '<span class="badge badge-error">Error</span>' : '<span class="badge badge-success">OK</span>'}</td>
    </tr>`;
  }).join('');
}

// Update last updated time
function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tabId = 'tab-' + btn.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    refreshActiveTab(btn.dataset.tab);
  });
});

// Period selector
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDays = parseInt(btn.dataset.days);
    refresh();
  });
});

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', () => {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  refresh().then(() => setTimeout(() => btn.classList.remove('spinning'), 800));
});

// Refresh active tab data
async function refreshActiveTab(tab) {
  switch (tab) {
    case 'tools': await updateToolsTable(); break;
    case 'sessions': await updateSessionsTable(); break;
    case 'models': await updateModelsTable(); break;
    case 'agents': await updateAgentsTable(); break;
    case 'calls': await updateCallsTable(); break;
  }
}

// Refresh all
async function refresh() {
  await Promise.all([
    updateOverview(),
    updateTrendChart(),
    updateToolsChart(),
    updateCostChart(),
    updateHourlyChart(),
    updateToolsTable(),
    updateSessionsTable(),
    updateModelsTable(),
    updateAgentsTable(),
    updateCallsTable(),
  ]);
  updateTimestamp();
}

// Initial load
refresh();

// Auto-refresh every 5 seconds
setInterval(refresh, 5000);
