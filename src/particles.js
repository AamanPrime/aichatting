// ===== Floating Hearts Particle System =====

const hearts = ['💕', '💗', '💖', '💝', '💘', '❤️', '💓', '💞', '✨', '🌸'];
let particles = [];
let ctx = null;
let canvas = null;
let animFrame = null;
let isRunning = false;

class Particle {
  constructor(canvasWidth, canvasHeight) {
    this.reset(canvasWidth, canvasHeight, true);
  }

  reset(canvasWidth, canvasHeight, initial = false) {
    this.x = Math.random() * canvasWidth;
    this.y = initial ? Math.random() * canvasHeight : canvasHeight + 20;
    this.size = 10 + Math.random() * 16;
    this.speed = 0.3 + Math.random() * 0.8;
    this.drift = (Math.random() - 0.5) * 0.5;
    this.opacity = 0.15 + Math.random() * 0.35;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 1.5;
    this.heart = hearts[Math.floor(Math.random() * hearts.length)];
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  update() {
    this.y -= this.speed;
    this.x += this.drift;
    this.rotation += this.rotationSpeed;

    // Wrap horizontally
    if (this.x < -20) this.x = this.canvasWidth + 20;
    if (this.x > this.canvasWidth + 20) this.x = -20;

    // Reset when off screen
    if (this.y < -30) {
      this.reset(this.canvasWidth, this.canvasHeight);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = this.opacity;
    ctx.font = `${this.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.heart, 0, 0);
    ctx.restore();
  }
}

function animate() {
  if (!isRunning || !ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    p.update();
    p.draw(ctx);
  }

  animFrame = requestAnimationFrame(animate);
}

export function initParticles(canvasId = 'particles-canvas') {
  canvas = document.getElementById(canvasId);
  if (!canvas) return;

  ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  // Create particles
  const count = Math.min(25, Math.floor(window.innerWidth / 60));
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(canvas.width, canvas.height));
  }

  isRunning = true;
  animate();
}

export function stopParticles() {
  isRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);
}

// Burst effect for special moments
export function burstHearts(x, y, count = 8) {
  if (!canvas) return;

  for (let i = 0; i < count; i++) {
    const p = new Particle(canvas.width, canvas.height);
    p.x = x;
    p.y = y;
    p.speed = 1 + Math.random() * 2;
    p.drift = (Math.random() - 0.5) * 3;
    p.opacity = 0.6 + Math.random() * 0.4;
    p.size = 14 + Math.random() * 10;
    particles.push(p);
  }
}
