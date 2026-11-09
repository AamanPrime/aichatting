// ===== IndexedDB Storage Layer =====
// All data stays on-device. No server, no tracking.

const DB_NAME = 'heartecho';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('conversations')) {
        database.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('chatHistory')) {
        database.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
      }
      if (!database.objectStoreNames.contains('styleProfiles')) {
        database.createObjectStore('styleProfiles', { keyPath: 'personName' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

async function getStore(storeName, mode = 'readonly') {
  const database = await openDB();
  return database.transaction(storeName, mode).objectStore(storeName);
}

// --- Conversations ---

export async function saveConversation(data) {
  const store = await getStore('conversations', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getConversation(id) {
  const store = await getStore('conversations');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllConversations() {
  const store = await getStore('conversations');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteConversation(id) {
  const store = await getStore('conversations', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Style Profiles ---

export async function saveStyleProfile(profile) {
  const store = await getStore('styleProfiles', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(profile);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getStyleProfile(personName) {
  const store = await getStore('styleProfiles');
  return new Promise((resolve, reject) => {
    const req = store.get(personName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Chat History ---

export async function saveChatMessage(message) {
  const store = await getStore('chatHistory', 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add(message);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getChatHistory(conversationId) {
  const store = await getStore('chatHistory');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const msgs = req.result.filter(m => m.conversationId === conversationId);
      resolve(msgs);
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Bulk Operations ---

export async function clearAllData() {
  const database = await openDB();
  const storeNames = ['conversations', 'chatHistory', 'styleProfiles'];
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeNames, 'readwrite');
    storeNames.forEach(name => tx.objectStore(name).clear());
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportAllData() {
  const conversations = await getAllConversations();
  const store = await getStore('styleProfiles');
  const profiles = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return {
    exportDate: new Date().toISOString(),
    conversations,
    styleProfiles: profiles
  };
}

// --- API Settings (localStorage — simple key-value, not sensitive enough for IndexedDB) ---

const API_SETTINGS_KEY = 'heartecho_api_settings';

/**
 * Save API settings.
 * @param {{ provider: 'gemini'|'openai', apiKey: string, model?: string }} settings
 */
export function saveAPISettings(settings) {
  try {
    localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save API settings:', e);
  }
}

/**
 * Get stored API settings.
 * @returns {{ provider: string, apiKey: string, model?: string } | null}
 */
export function getAPISettings() {
  try {
    const raw = localStorage.getItem(API_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear API settings.
 */
export function clearAPISettings() {
  localStorage.removeItem(API_SETTINGS_KEY);
}

