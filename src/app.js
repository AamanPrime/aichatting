// ===== HeartEcho — Main App Controller =====
// SPA routing, page management, and feature orchestration

import { parseChat } from './parser.js';
import { extractStyle } from './styleExtractor.js';
import { buildIndex } from './retrieval.js';
import { initChatEngine, loadModel, generateResponse, isModelLoaded, isAPIConfigured, getEngineLabel, detectEngineMode } from './chatEngine.js';
import { computeAnalytics, renderTimelineChart, renderMilestones } from './analytics.js';
import { generateFingerprintCard, generateScoreCard, downloadCard } from './shareCard.js';
import { initGame, answerRound, nextRound, isGameOver, getEndMessage } from './gameMode.js';
import { saveConversation, getAllConversations, clearAllData, exportAllData, saveStyleProfile, saveAPISettings, getAPISettings, clearAPISettings } from './storage.js';
import { burstHearts } from './particles.js';

// ===== App State =====
let state = {
  currentPage: 'landing',
  parsedData: null,        // { messages, senders }
  selectedSender: null,
  styleProfile: null,
  searchIndex: null,
  analytics: null,
  chatHistory: [],
  gameState: null,
  conversationId: null
};

// ===== Page Navigation =====
const pages = ['landing', 'upload', 'dashboard', 'chat', 'game'];

export function navigateTo(pageId) {
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.classList.toggle('active', p === pageId);
    }
  });
  state.currentPage = pageId;
  window.scrollTo(0, 0);
}

// ===== Upload Flow =====

function setupUpload() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const pasteArea = document.getElementById('paste-area');
  const pasteSubmit = document.getElementById('paste-submit');

  if (!dropZone) return;

  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());

  // Drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // File input
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // Paste submit
  pasteSubmit.addEventListener('click', () => {
    const text = pasteArea.value.trim();
    if (text) processConversation(text, 'pasted.txt');
  });
}

async function handleFile(file) {
  const text = await file.text();
  processConversation(text, file.name);
}

async function processConversation(content, filename) {
  const progressEl = document.getElementById('upload-progress');
  const dropZone = document.getElementById('drop-zone');
  const progressText = document.getElementById('progress-text');
  const pasteArea = document.getElementById('paste-area');
  const pasteSubmit = document.getElementById('paste-submit');

  // Show progress
  if (dropZone) dropZone.style.display = 'none';
  if (pasteArea) pasteArea.style.display = 'none';
  if (pasteSubmit) pasteSubmit.style.display = 'none';
  document.querySelector('.upload-or')?.style.setProperty('display', 'none');
  if (progressEl) progressEl.style.display = 'block';

  progressText.textContent = 'Parsing conversation...';
  await sleep(400);

  // Parse
  const parsed = parseChat(content, filename);

  if (!parsed.messages || parsed.messages.length === 0) {
    progressText.textContent = '❌ Could not parse any messages. Try a different format.';
    setTimeout(() => resetUploadUI(), 2000);
    return;
  }

  progressText.textContent = `Found ${parsed.messages.length} messages from ${parsed.senders.length} people...`;
  await sleep(400);

  state.parsedData = parsed;

  // If only 2 senders, auto-select the non-user
  if (parsed.senders.length === 2) {
    // The person who sends less is likely the user (in exported chats, the other person usually has more messages)
    // Let user pick from the dashboard instead
    state.selectedSender = parsed.senders[0]; // default to first
  } else if (parsed.senders.length === 1) {
    state.selectedSender = parsed.senders[0];
  }

  // Show sender selection if more than 2
  if (parsed.senders.length > 2) {
    showSenderPicker(parsed.senders);
    return;
  }

  progressText.textContent = 'Analyzing texting style...';
  await sleep(400);

  await finishProcessing();
}

function showSenderPicker(senders) {
  const progressText = document.getElementById('progress-text');
  const progressEl = document.getElementById('upload-progress');

  progressEl.innerHTML = `
    <h3 style="color: #fff; font-family: var(--font-display); margin-bottom: 16px;">Who do you want to chat with?</h3>
    <div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px; margin: 0 auto;">
      ${senders.map(s => `
        <button class="btn btn-ghost sender-pick" data-sender="${s}" style="justify-content: center;">
          ${s}
        </button>
      `).join('')}
    </div>
  `;

  progressEl.querySelectorAll('.sender-pick').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.selectedSender = btn.dataset.sender;
      progressEl.innerHTML = `
        <div class="progress-heart">💕</div>
        <p class="progress-text">Analyzing ${state.selectedSender}'s texting style...</p>
      `;
      await sleep(400);
      await finishProcessing();
    });
  });
}

async function finishProcessing() {
  // Extract style
  state.styleProfile = extractStyle(state.parsedData.messages, state.selectedSender);

  // Build search index
  state.searchIndex = buildIndex(state.parsedData.messages);

  // Init chat engine
  initChatEngine(state.parsedData.messages, state.selectedSender);

  // Compute analytics
  state.analytics = computeAnalytics(state.parsedData.messages, state.parsedData.senders);

  // Save to IndexedDB
  const convData = {
    id: Date.now(),
    filename: 'conversation',
    senders: state.parsedData.senders,
    messageCount: state.parsedData.messages.length,
    selectedSender: state.selectedSender,
    messages: state.parsedData.messages,
    createdAt: new Date().toISOString()
  };
  state.conversationId = await saveConversation(convData);
  await saveStyleProfile(state.styleProfile);

  // Navigate to dashboard
  showDashboard();
}

function resetUploadUI() {
  const dropZone = document.getElementById('drop-zone');
  const progressEl = document.getElementById('upload-progress');
  const pasteArea = document.getElementById('paste-area');
  const pasteSubmit = document.getElementById('paste-submit');

  if (dropZone) dropZone.style.display = '';
  if (pasteArea) pasteArea.style.display = '';
  if (pasteSubmit) pasteSubmit.style.display = '';
  document.querySelector('.upload-or')?.style.setProperty('display', '');
  if (progressEl) progressEl.style.display = 'none';
}

// ===== Dashboard =====

function showDashboard() {
  navigateTo('dashboard');

  const titleEl = document.getElementById('dash-title');
  if (titleEl) titleEl.textContent = `${state.selectedSender}'s Dashboard`;

  // Render fingerprint
  renderFingerprint();

  // Render timeline
  if (state.analytics) {
    renderTimelineChart('timeline-chart', state.analytics);
    renderMilestones('timeline-milestones', state.analytics.milestones);
  }
}

function renderFingerprint() {
  const container = document.getElementById('fingerprint-content');
  if (!container || !state.styleProfile) return;

  const p = state.styleProfile;

  container.innerHTML = `
    <div class="fingerprint-name">${p.personName}'s Text Personality</div>
    ${p.labels.map(l => `
      <div class="fingerprint-trait">
        <span class="trait-emoji">${l.emoji}</span>
        <span class="trait-text">${l.text}</span>
      </div>
    `).join('')}
    ${p.topPhrases.length > 0 ? `
      <div class="fingerprint-phrases">
        ${p.topPhrases.slice(0, 6).map(ph => `<span class="phrase-tag">"${ph}"</span>`).join('')}
      </div>
    ` : ''}
  `;
}

// ===== Chat =====

function setupChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  if (!input || !sendBtn) return;

  sendBtn.addEventListener('click', () => sendMessage());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

async function openChat() {
  navigateTo('chat');

  const nameEl = document.getElementById('chat-name');
  const avatarEl = document.getElementById('chat-avatar');
  const cloneEl = document.getElementById('clone-name');

  if (nameEl) nameEl.textContent = state.selectedSender;
  if (avatarEl) avatarEl.textContent = state.selectedSender.charAt(0).toUpperCase();
  if (cloneEl) cloneEl.textContent = state.selectedSender;

  state.chatHistory = [];
  renderMessages();

  // Detect engine mode and update badge
  await detectEngineMode();
  updateEngineBadge();

  // If API is configured, we're good to go — no model download needed
  if (isAPIConfigured()) {
    addSystemMessage(`☁️ Connected to ${getEngineLabel()}. Replies will be high quality!`);
    return;
  }

  // Otherwise try loading local model
  if (!isModelLoaded()) {
    const overlay = document.getElementById('model-overlay');
    const status = document.getElementById('model-status');
    const progress = document.getElementById('model-progress');

    overlay.style.display = 'flex';

    const loaded = await loadModel((pct) => {
      progress.style.width = pct + '%';
      if (pct < 20) status.textContent = 'Loading AI library...';
      else if (pct < 90) status.textContent = 'Downloading TinyLlama model (first time only)...';
      else status.textContent = 'Almost ready...';
    });

    overlay.style.display = 'none';
    updateEngineBadge();

    if (!loaded) {
      addSystemMessage('⚡ Running in lightweight mode. Go to ⚙️ Settings to connect an API for better replies!');
    }
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Add user message
  state.chatHistory.push({ text, isUser: true, timestamp: Date.now() });
  input.value = '';
  input.style.height = 'auto';
  renderMessages();

  // Show typing indicator
  showTyping(true);

  // Simulate realistic delay
  const delay = 800 + Math.random() * 1500;
  await sleep(delay);

  // Generate response
  const result = await generateResponse(text, state.styleProfile, state.searchIndex, state.chatHistory);

  showTyping(false);

  // Update engine badge based on which engine was used
  updateEngineBadge();

  // Show memory recall if found
  if (result.memories && result.memories.length > 0) {
    const memoryText = result.memories
      .slice(0, 3)
      .map(m => `"${m.text}"`)
      .join(' • ');
    state.chatHistory.push({ text: memoryText, isRecall: true, timestamp: Date.now() });
  }

  // Add AI response
  state.chatHistory.push({ text: result.text, isUser: false, timestamp: Date.now() });
  renderMessages();

  // Burst hearts on response
  burstHearts(window.innerWidth / 2, window.innerHeight - 100);
}

function renderMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (state.chatHistory.length === 0) {
    container.innerHTML = `
      <div class="chat-welcome">
        <span class="welcome-emoji">💕</span>
        <p>Start chatting! The AI will respond in <strong>${state.selectedSender}</strong>'s style.</p>
        <p class="welcome-hint">Try asking about a shared memory...</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.chatHistory.map(msg => {
    if (msg.isRecall) {
      return `<div class="message message-recall">${msg.text}</div>`;
    }
    const cls = msg.isUser ? 'message-me' : 'message-them';
    return `<div class="message ${cls}">${escapeHtml(msg.text)}</div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function addSystemMessage(text) {
  state.chatHistory.push({ text, isRecall: true, timestamp: Date.now() });
  renderMessages();
}

function showTyping(show) {
  const el = document.getElementById('chat-typing');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ===== Game Mode =====

function setupGame() {
  // Game event listeners are set up in openGame
}

function openGame() {
  if (!state.parsedData || !state.selectedSender) return;

  state.gameState = initGame(state.parsedData.messages, state.selectedSender, 10);

  if (state.gameState.error) {
    addSystemMessage(`⚠️ ${state.gameState.error}`);
    return;
  }

  navigateTo('game');
  renderGameRound();
}

function renderGameRound() {
  const gs = state.gameState;
  if (!gs) return;

  if (isGameOver(gs)) {
    showGameEnd();
    return;
  }

  const round = gs.rounds[gs.currentRound];
  const scoreEl = document.getElementById('game-score');
  const optionsEl = document.getElementById('game-options');
  const resultEl = document.getElementById('game-result');
  const nextBtn = document.getElementById('game-next');
  const endEl = document.getElementById('game-end');

  if (scoreEl) scoreEl.textContent = `Score: ${gs.score}/${gs.currentRound}`;
  if (resultEl) resultEl.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';
  if (endEl) endEl.style.display = 'none';

  optionsEl.innerHTML = round.options.map((opt, i) => `
    <button class="game-option" data-idx="${i}">
      <span class="option-label">${i + 1}</span>
      <span>${escapeHtml(opt.text)}</span>
    </button>
  `).join('');

  optionsEl.querySelectorAll('.game-option').forEach(btn => {
    btn.addEventListener('click', () => handleGameAnswer(parseInt(btn.dataset.idx)));
  });
}

function handleGameAnswer(choiceIndex) {
  state.gameState = answerRound(state.gameState, choiceIndex);

  const round = state.gameState.rounds[state.gameState.currentRound];
  const optionsEl = document.getElementById('game-options');
  const resultEl = document.getElementById('game-result');
  const nextBtn = document.getElementById('game-next');
  const scoreEl = document.getElementById('game-score');

  // Update score
  if (scoreEl) scoreEl.textContent = `Score: ${state.gameState.score}/${state.gameState.currentRound + 1}`;

  // Show correct/wrong on options
  const buttons = optionsEl.querySelectorAll('.game-option');
  buttons.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (round.options[i].isReal) {
      btn.classList.add('correct');
    } else if (i === choiceIndex && !round.options[i].isReal) {
      btn.classList.add('wrong');
    }
  });

  // Show result
  if (resultEl) {
    resultEl.style.display = 'block';
    if (round.correct) {
      resultEl.className = 'game-result correct-result';
      resultEl.textContent = '✅ Correct! That was the real message.';
    } else {
      resultEl.className = 'game-result wrong-result';
      resultEl.textContent = '❌ Wrong! The other one was real.';
    }
  }

  // Show next button
  if (nextBtn) {
    nextBtn.style.display = 'block';
    nextBtn.onclick = () => {
      state.gameState = nextRound(state.gameState);
      renderGameRound();
    };
  }

  // Burst hearts on correct
  if (round.correct) {
    burstHearts(window.innerWidth / 2, window.innerHeight / 2);
  }
}

function showGameEnd() {
  const gs = state.gameState;
  const endEl = document.getElementById('game-end');
  const endMsg = getEndMessage(gs);

  document.getElementById('game-end-title').textContent = endMsg.title;
  document.getElementById('game-end-score').textContent = `${gs.score}/${gs.total}`;
  document.getElementById('game-end-msg').textContent = endMsg.msg;

  if (endEl) endEl.style.display = 'flex';

  // Share button
  document.getElementById('game-share').onclick = () => {
    const dataUrl = generateScoreCard(gs.score, gs.total, gs.targetSender);
    if (dataUrl) downloadCard(dataUrl, 'heartecho-score.png');
  };

  // Restart button
  document.getElementById('game-restart').onclick = () => {
    openGame();
  };
}

// ===== Event Bindings =====

export function initApp() {
  // Navigation buttons
  bindClick('hero-start', () => navigateTo('upload'));
  bindClick('nav-get-started', () => navigateTo('upload'));
  bindClick('hero-demo', () => loadDemoData());

  // Upload page
  bindClick('upload-back', () => {
    resetUploadUI();
    navigateTo('landing');
  });

  // Dashboard
  bindClick('dash-back', () => navigateTo('landing'));
  bindClick('start-chat', () => openChat());
  bindClick('start-game', () => openGame());
  bindClick('share-fingerprint', () => {
    if (state.styleProfile) {
      const dataUrl = generateFingerprintCard(state.styleProfile);
      if (dataUrl) downloadCard(dataUrl, `heartecho-${state.selectedSender}.png`);
    }
  });
  bindClick('dash-delete', () => {
    showConfirmModal();
  });
  bindClick('confirm-cancel', () => {
    document.getElementById('confirm-overlay').style.display = 'none';
  });
  bindClick('confirm-delete', async () => {
    document.getElementById('confirm-overlay').style.display = 'none';
    await clearAllData();
    state = { currentPage: 'landing', parsedData: null, selectedSender: null, styleProfile: null, searchIndex: null, analytics: null, chatHistory: [], gameState: null, conversationId: null };
    navigateTo('landing');
  });
  bindClick('export-data', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heartecho-export.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Chat
  bindClick('chat-back', () => navigateTo('dashboard'));

  // Game
  bindClick('game-back', () => navigateTo('dashboard'));

  // Settings
  bindClick('nav-settings', () => openSettings());
  bindClick('chat-settings', () => openSettings());

  // Setup modules
  setupUpload();
  setupChat();
  setupSettings();
}

// ===== Demo Data =====

async function loadDemoData() {
  const demoChat = `1/15/24, 10:30 AM - Sarah: hey! good morning 😊
1/15/24, 10:31 AM - You: morning! how'd you sleep?
1/15/24, 10:31 AM - Sarah: pretty good hehe, dreamt about that trip we planned ❤️
1/15/24, 10:32 AM - You: haha the goa trip? can't wait!
1/15/24, 10:32 AM - Sarah: yesss!! its gonna be amazing 🌊
1/15/24, 10:33 AM - You: should we book the hotel today?
1/15/24, 10:34 AM - Sarah: omg yes please!! the beachfront one 🏖️
1/15/24, 10:35 AM - You: done! booked for next month
1/15/24, 10:35 AM - Sarah: YAYYYY you're the best 🥰💕
1/15/24, 10:36 AM - You: anything for you
1/15/24, 10:36 AM - Sarah: aww stopppp 🥺❤️
1/20/24, 8:15 PM - Sarah: heyyy what are you doing? 
1/20/24, 8:16 PM - You: just watching a movie, you?
1/20/24, 8:16 PM - Sarah: same hehe, watching that show you recommended
1/20/24, 8:17 PM - You: oh nice! which episode?
1/20/24, 8:17 PM - Sarah: episode 3... its SO good omg
1/20/24, 8:18 PM - You: wait till episode 5, it gets crazy
1/20/24, 8:18 PM - Sarah: no spoilers!! 😤😂
1/20/24, 8:19 PM - You: haha okay okay
1/20/24, 8:20 PM - Sarah: hehe thanks yaar ❤️
2/14/24, 12:00 AM - Sarah: HAPPY VALENTINES DAY 💕💗💖💝
2/14/24, 12:01 AM - You: happy valentines day!! ❤️
2/14/24, 12:01 AM - Sarah: you remembered!! 🥰
2/14/24, 12:02 AM - You: of course! got something special planned for us
2/14/24, 12:02 AM - Sarah: omggg what is it tell meee
2/14/24, 12:03 AM - You: its a surprise 😏
2/14/24, 12:03 AM - Sarah: hehe fine I'll wait... but I'm excited!! 💓
2/14/24, 9:30 AM - Sarah: good morning my valentine 😊❤️
2/14/24, 9:31 AM - You: good morning beautiful ❤️
2/14/24, 9:31 AM - Sarah: aww you're so sweet 🥺
2/14/24, 7:30 PM - You: ready for tonight?
2/14/24, 7:31 PM - Sarah: YESSS been getting ready for 2 hours hehe
2/14/24, 7:31 PM - You: haha you always look amazing anyway
2/14/24, 7:32 PM - Sarah: stopppp making me blush 🥺💕
3/10/24, 3:15 PM - Sarah: remember that cafe we went to last month?
3/10/24, 3:16 PM - You: the one with the amazing pasta?
3/10/24, 3:16 PM - Sarah: yesss! they have a new dessert menu
3/10/24, 3:17 PM - You: say no more, lets go this weekend
3/10/24, 3:17 PM - Sarah: you read my mind hehe 😍
3/10/24, 3:18 PM - You: great minds think alike
3/10/24, 3:18 PM - Sarah: aww we really do think alike 💕
4/5/24, 11:00 PM - You: hey are you still awake?
4/5/24, 11:01 PM - Sarah: yesss can't sleep 😅
4/5/24, 11:01 PM - You: same, want to video call?
4/5/24, 11:02 PM - Sarah: omg yes!! calling you now ❤️
4/5/24, 11:45 PM - Sarah: that was so nice talking to you 🥰
4/5/24, 11:46 PM - You: always is. goodnight ❤️
4/5/24, 11:46 PM - Sarah: goodnight!! sweet dreams 💕✨
5/20/24, 6:00 PM - Sarah: GUESS WHAT
5/20/24, 6:00 PM - You: what??
5/20/24, 6:01 PM - Sarah: I got the job!!! 🎉🎉🎉
5/20/24, 6:01 PM - You: OMG CONGRATS!! I knew you would get it!
5/20/24, 6:02 PM - Sarah: thank youuu 🥺 couldn't have done it without your support
5/20/24, 6:02 PM - You: you did it all yourself, I'm so proud of you
5/20/24, 6:03 PM - Sarah: aww you're making me cry happy tears 😭💕
5/20/24, 6:04 PM - You: we're celebrating tonight! dinner on me
5/20/24, 6:04 PM - Sarah: yesss!! you're the absolute best ❤️❤️❤️
6/15/24, 2:30 PM - You: sending you a song that reminded me of you
6/15/24, 2:31 PM - Sarah: aww which one?
6/15/24, 2:31 PM - You: perfect by ed sheeran
6/15/24, 2:32 PM - Sarah: STOPPP thats our song now 🥺💕
6/15/24, 2:32 PM - You: deal ❤️
6/15/24, 2:33 PM - Sarah: hehe I love that 😊
7/4/24, 10:00 AM - Sarah: happy 4th! are we doing fireworks tonight?
7/4/24, 10:01 AM - You: of course! I found the perfect spot
7/4/24, 10:01 AM - Sarah: yayy you always find the best spots 🎆
7/4/24, 10:02 AM - You: only the best for you
7/4/24, 10:02 AM - Sarah: hehe cheesy but I love it ❤️😂`;

  processConversation(demoChat, 'demo.txt');
}

// ===== Engine Badge =====

function updateEngineBadge() {
  const badge = document.getElementById('chat-engine-badge');
  if (!badge) return;

  const label = getEngineLabel();
  badge.textContent = label;
  badge.className = 'engine-badge';

  if (isAPIConfigured()) {
    badge.classList.add('api-mode');
  } else if (isModelLoaded()) {
    badge.classList.add('local-mode');
  }
}

// ===== Settings Modal =====

let selectedProvider = 'gemini';

function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKeySection = document.getElementById('api-key-section');
  const modelSection = document.getElementById('model-section');
  const modelSelect = document.getElementById('model-select');
  const hintEl = document.getElementById('api-key-hint');
  const statusEl = document.getElementById('settings-status');

  if (!overlay) return;

  // Load existing settings
  const settings = getAPISettings();
  if (settings) {
    selectedProvider = settings.provider || 'gemini';
    apiKeyInput.value = settings.apiKey || '';
  } else {
    selectedProvider = 'gemini';
    apiKeyInput.value = '';
  }

  // Update UI to match provider
  updateProviderUI(selectedProvider);

  statusEl.textContent = '';
  statusEl.className = 'settings-status';

  overlay.style.display = 'flex';
}

function updateProviderUI(provider) {
  const apiKeySection = document.getElementById('api-key-section');
  const modelSection = document.getElementById('model-section');
  const modelSelect = document.getElementById('model-select');
  const hintEl = document.getElementById('api-key-hint');

  // Update toggle buttons
  document.querySelectorAll('#provider-toggle .toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });

  if (provider === 'local') {
    apiKeySection.style.display = 'none';
    modelSection.style.display = 'none';
  } else {
    apiKeySection.style.display = '';
    modelSection.style.display = '';

    if (provider === 'gemini') {
      hintEl.innerHTML = 'Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>';
      modelSelect.innerHTML = `
        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
        <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Fastest)</option>
        <option value="gemini-2.5-flash-preview-05-20">Gemini 2.5 Flash (Best)</option>
      `;
    } else {
      hintEl.innerHTML = 'Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">OpenAI Dashboard</a>';
      modelSelect.innerHTML = `
        <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
        <option value="gpt-4o">GPT-4o (Best)</option>
        <option value="gpt-4.1-nano">GPT-4.1 Nano (Fastest)</option>
      `;
    }

    // Restore saved model if matching provider
    const settings = getAPISettings();
    if (settings?.provider === provider && settings?.model) {
      modelSelect.value = settings.model;
    }
  }
}

function setupSettings() {
  // Provider toggle
  document.querySelectorAll('#provider-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedProvider = btn.dataset.provider;
      updateProviderUI(selectedProvider);
    });
  });

  // Save
  bindClick('settings-save', () => {
    const statusEl = document.getElementById('settings-status');
    const apiKeyInput = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');

    if (selectedProvider === 'local') {
      // Clear API settings, will use local model
      clearAPISettings();
      statusEl.textContent = '✅ Switched to local AI model. Will download on next chat.';
      statusEl.className = 'settings-status success';

      setTimeout(() => {
        document.getElementById('settings-overlay').style.display = 'none';
        updateEngineBadge();
      }, 1500);
      return;
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      statusEl.textContent = '❌ Please enter your API key.';
      statusEl.className = 'settings-status error';
      return;
    }

    // Save settings
    saveAPISettings({
      provider: selectedProvider,
      apiKey: apiKey,
      model: modelSelect.value
    });

    statusEl.textContent = `✅ Saved! Now using ${selectedProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'}.`;
    statusEl.className = 'settings-status success';

    setTimeout(async () => {
      document.getElementById('settings-overlay').style.display = 'none';
      await detectEngineMode();
      updateEngineBadge();
    }, 1200);
  });

  // Cancel
  bindClick('settings-cancel', () => {
    document.getElementById('settings-overlay').style.display = 'none';
  });
}

// ===== Utilities =====

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showConfirmModal() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.style.display = 'flex';
}
