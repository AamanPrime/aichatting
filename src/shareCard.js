// ===== Share Card Generator — Canvas → PNG =====
// Generates beautiful shareable cards for Style Fingerprint & Game Score

/**
 * Generate a Style Fingerprint share card.
 */
export function generateFingerprintCard(styleProfile) {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return null;

  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 600, 800);
  bg.addColorStop(0, '#0f0f1a');
  bg.addColorStop(0.5, '#1a0a1a');
  bg.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 600, 800);

  // Decorative circles
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(500, 100, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, 700, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Top border glow
  const glow = ctx.createLinearGradient(0, 0, 600, 0);
  glow.addColorStop(0, 'rgba(244, 63, 94, 0)');
  glow.addColorStop(0.5, 'rgba(244, 63, 94, 0.6)');
  glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 600, 3);

  // Title
  ctx.fillStyle = '#f43f5e';
  ctx.font = '16px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('💕 HeartEcho', 300, 50);

  // Person name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Outfit, sans-serif';
  ctx.fillText(`${styleProfile.personName}'s`, 300, 110);

  ctx.font = 'bold 28px Outfit, sans-serif';
  const gradient = ctx.createLinearGradient(150, 130, 450, 130);
  gradient.addColorStop(0, '#f43f5e');
  gradient.addColorStop(1, '#a855f7');
  ctx.fillStyle = gradient;
  ctx.fillText('Text Personality', 300, 148);

  // Divider
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, 175);
  ctx.lineTo(500, 175);
  ctx.stroke();

  // Labels/Traits
  let y = 220;
  const labels = styleProfile.labels || [];

  labels.forEach((label, i) => {
    if (y > 600) return;

    // Background pill
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    roundRect(ctx, 60, y - 18, 480, 44, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, 60, y - 18, 480, 44, 12);
    ctx.stroke();

    // Emoji
    ctx.font = '20px serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label.emoji, 80, y + 10);

    // Text
    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(label.text, 115, y + 8);

    y += 55;
  });

  // Top phrases
  if (styleProfile.topPhrases && styleProfile.topPhrases.length > 0) {
    y += 15;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#9898b0';
    ctx.textAlign = 'center';
    ctx.fillText('Favorite phrases', 300, y);
    y += 25;

    // Phrases as tags
    let tagX = 100;
    const tagY = y;
    ctx.font = '13px Inter, sans-serif';

    styleProfile.topPhrases.slice(0, 5).forEach(phrase => {
      const width = ctx.measureText(`"${phrase}"`).width + 24;
      if (tagX + width > 500) return;

      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      roundRect(ctx, tagX, tagY - 12, width, 28, 14);
      ctx.fill();

      ctx.fillStyle = '#c084fc';
      ctx.textAlign = 'left';
      ctx.fillText(`"${phrase}"`, tagX + 12, tagY + 6);

      tagX += width + 8;
    });
  }

  // Footer
  ctx.fillStyle = '#4a4a6a';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Made with HeartEcho • Your chats never leave your device', 300, 760);

  return canvas.toDataURL('image/png');
}

/**
 * Generate a Game Score share card.
 */
export function generateScoreCard(score, total, personName) {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return null;

  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 600, 400);
  bg.addColorStop(0, '#0f0f1a');
  bg.addColorStop(1, '#1a0a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 600, 400);

  // Glow
  ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
  ctx.beginPath();
  ctx.arc(300, 200, 200, 0, Math.PI * 2);
  ctx.fill();

  // Title
  ctx.fillStyle = '#f43f5e';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('💕 HeartEcho — Guess The AI', 300, 50);

  // Score
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Outfit, sans-serif';
  ctx.fillText(`${score}/${total}`, 300, 170);

  // Percentage
  const pct = Math.round((score / Math.max(total, 1)) * 100);
  const scoreGrad = ctx.createLinearGradient(200, 190, 400, 190);
  scoreGrad.addColorStop(0, '#f43f5e');
  scoreGrad.addColorStop(1, '#a855f7');
  ctx.fillStyle = scoreGrad;
  ctx.font = 'bold 24px Outfit, sans-serif';
  ctx.fillText(`${pct}% accuracy`, 300, 210);

  // Message
  ctx.fillStyle = '#c4c4d4';
  ctx.font = '16px Inter, sans-serif';
  const msg = pct >= 80 ? `I really know ${personName}'s texts! 🥰` :
    pct >= 50 ? `Not bad at spotting AI vs ${personName}! 🤔` :
      `The AI fooled me pretending to be ${personName}! 😂`;
  ctx.fillText(msg, 300, 270);

  // Footer
  ctx.fillStyle = '#4a4a6a';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('Try it yourself at HeartEcho', 300, 360);

  return canvas.toDataURL('image/png');
}

/**
 * Download a canvas as PNG.
 */
export function downloadCard(dataUrl, filename = 'heartecho-card.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- Helpers ---

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
