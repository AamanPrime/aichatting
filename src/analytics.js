// ===== Analytics — Relationship Timeline + Chart.js =====

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

/**
 * Compute relationship analytics from messages.
 */
export function computeAnalytics(messages, senders) {
  if (!messages || messages.length === 0) return null;

  // Sort by timestamp
  const sorted = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // --- Milestones ---
  const milestones = [];

  // First message
  if (sorted[0].timestamp) {
    milestones.push({
      date: formatDate(sorted[0].timestamp),
      text: `First message`,
      emoji: '💬'
    });
  }

  // First emoji/heart
  const firstEmoji = sorted.find(m => m.emojis && m.emojis.length > 0);
  if (firstEmoji && firstEmoji.timestamp) {
    milestones.push({
      date: formatDate(firstEmoji.timestamp),
      text: `First emoji: ${firstEmoji.emojis[0]}`,
      emoji: '✨'
    });
  }

  // First heart
  const heartEmojis = ['❤', '💕', '💗', '💖', '💝', '💘', '💓', '💞', '🥰', '😍'];
  const firstHeart = sorted.find(m =>
    m.emojis && m.emojis.some(e => heartEmojis.some(h => e.includes(h)))
  );
  if (firstHeart && firstHeart.timestamp) {
    milestones.push({
      date: formatDate(firstHeart.timestamp),
      text: `First ❤️ emoji`,
      emoji: '❤️'
    });
  }

  // --- Monthly Message Counts ---
  const monthlyData = {};
  const monthlySenderData = {};

  senders.forEach(s => { monthlySenderData[s] = {}; });

  sorted.forEach(m => {
    if (!m.timestamp) return;
    const d = new Date(m.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = (monthlyData[key] || 0) + 1;

    if (monthlySenderData[m.sender]) {
      monthlySenderData[m.sender][key] = (monthlySenderData[m.sender][key] || 0) + 1;
    }
  });

  const months = Object.keys(monthlyData).sort();

  // Most active month
  if (months.length > 0) {
    const mostActive = months.reduce((a, b) => monthlyData[a] > monthlyData[b] ? a : b);
    milestones.push({
      date: formatMonthLabel(mostActive),
      text: `Most active month (${monthlyData[mostActive]} msgs)`,
      emoji: '🔥'
    });
  }

  // Total stats
  const totalMessages = messages.length;

  // Longest conversation streak (messages within 5 min of each other)
  let maxStreak = 0;
  let currentStreak = 1;
  let streakStart = sorted[0]?.timestamp;

  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i].timestamp || 0) - (sorted[i - 1].timestamp || 0);
    if (diff < 5 * 60 * 1000) { // 5 minutes
      currentStreak++;
    } else {
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      currentStreak = 1;
      streakStart = sorted[i].timestamp;
    }
  }
  if (currentStreak > maxStreak) maxStreak = currentStreak;

  if (maxStreak > 5) {
    milestones.push({
      date: '',
      text: `Longest conversation: ${maxStreak} messages`,
      emoji: '📱'
    });
  }

  // Total stats milestone
  milestones.push({
    date: '',
    text: `Total messages: ${totalMessages}`,
    emoji: '📊'
  });

  return {
    milestones,
    months,
    monthlyData,
    monthlySenderData,
    senders,
    totalMessages
  };
}

/**
 * Render the timeline chart using Chart.js.
 */
export function renderTimelineChart(canvasId, analytics) {
  if (!analytics || !analytics.months.length) return;

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy existing chart
  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  const colors = [
    'rgba(244, 63, 94, 0.8)',   // rose
    'rgba(168, 85, 247, 0.8)',  // purple
    'rgba(251, 191, 36, 0.8)',  // gold
  ];

  const datasets = analytics.senders.map((sender, i) => ({
    label: sender,
    data: analytics.months.map(m => analytics.monthlySenderData[sender]?.[m] || 0),
    borderColor: colors[i % colors.length],
    backgroundColor: colors[i % colors.length].replace('0.8', '0.15'),
    borderWidth: 2,
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointHoverRadius: 6,
    pointBackgroundColor: colors[i % colors.length]
  }));

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: analytics.months.map(formatMonthLabel),
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          labels: {
            color: '#c4c4d4',
            font: { family: 'Inter', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.95)',
          borderColor: 'rgba(244, 63, 94, 0.3)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#c4c4d4',
          cornerRadius: 8,
          padding: 12
        }
      },
      scales: {
        x: {
          ticks: { color: '#6b6b8a', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          ticks: { color: '#6b6b8a', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

/**
 * Render milestones in the DOM.
 */
export function renderMilestones(containerId, milestones) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = milestones.map(m => `
    <div class="milestone">
      <span class="milestone-dot"></span>
      <span class="milestone-date">${m.date || ''}</span>
      <span>${m.emoji} ${m.text}</span>
    </div>
  `).join('');
}

// --- Helpers ---

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year.slice(-2)}`;
}
