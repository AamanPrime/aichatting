// ===== HeartEcho — Entry Point =====
import './style.css';
import { initApp } from './app.js';
import { initParticles } from './particles.js';

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initApp();
});
