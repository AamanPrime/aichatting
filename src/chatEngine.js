// ===== Chat Engine — Hybrid AI (Cloud API + In-Browser Qwen2.5) =====
// Option C: Users choose between cloud API (Gemini/OpenAI) or local model
// Falls back to improved Markov chain if both fail

import { buildAPIMessages, postProcess } from './promptBuilder.js';
import { retrieve, recallMemories } from './retrieval.js';
import { MarkovEngine } from './markovEngine.js';
import { getAPISettings } from './storage.js';
import { CreateMLCEngine } from '@mlc-ai/web-llm';

let pipeline = null;
let generator = null;
let modelLoading = false;
let modelReady = false;
const markov = new MarkovEngine();

// Current engine mode: 'api' | 'local' | 'markov'
let engineMode = 'markov';

/**
 * Initialize the chat engine with conversation data.
 */
export function initChatEngine(messages, targetSender) {
  const personMsgs = messages.filter(m => m.sender === targetSender);
  markov.train(personMsgs);
}

/**
 * Determine the best available engine mode.
 */
export async function detectEngineMode() {
  const settings = getAPISettings();
  if (settings && settings.apiKey && settings.provider) {
    engineMode = 'api';
    return 'api';
  }
  if (modelReady) {
    engineMode = 'local';
    return 'local';
  }
  engineMode = 'markov';
  return 'markov';
}

/**
 * Get current engine mode label for UI.
 */
export function getEngineLabel() {
  switch (engineMode) {
    case 'api': {
      const s = getAPISettings();
      return `☁️ ${s?.provider === 'openai' ? 'OpenAI' : 'Google Gemini'}`;
    }
    case 'local': return '🧠 Local AI (Llama-3.2-1B-Instruct)';
    default: return '⚡ Lightweight Mode';
  }
}

/**
 * Load the in-browser Transformers.js model (Qwen2.5-1.5B-Instruct).
 * @param {Function} onProgress - Progress callback (0-100)
 */
export async function loadModel(onProgress) {
  if (modelReady || modelLoading) return modelReady;
  modelLoading = true;

  try {
    onProgress?.(5);

    const initProgressCallback = (initProgress) => {
      onProgress?.(initProgress.progress * 100);
    };

    generator = await CreateMLCEngine(
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      { initProgressCallback: initProgressCallback }
    );

    onProgress?.(100);
    modelReady = true;
    modelLoading = false;
    engineMode = 'local';
    return true;
  } catch (err) {
    console.warn('Failed to load AI model:', err);
    modelLoading = false;
    modelReady = false;
    return false;
  }
}

/**
 * Generate a chat response using the best available engine.
 */
export async function generateResponse(userMessage, styleProfile, index, chatHistory = []) {
  // Check for memory recall trigger
  const memoryKeywords = ['remember', 'recall', 'that time', 'what about', 'did we', 'trip', 'when we', 'yaad', 'woh din', 'jab hum'];
  const isMemoryQuery = memoryKeywords.some(kw => userMessage.toLowerCase().includes(kw));

  // Retrieve relevant past messages
  let retrieved = [];
  let memories = null;

  if (index) {
    retrieved = retrieve(index, userMessage, 5, styleProfile.personName);
    if (isMemoryQuery) {
      memories = recallMemories(index, userMessage, 5);
    }
  }

  // Re-detect engine mode in case settings changed
  await detectEngineMode();

  // --- Try Cloud API first ---
  if (engineMode === 'api') {
    try {
      const result = await generateViaAPI(userMessage, styleProfile, retrieved, chatHistory);
      if (result) {
        const text = postProcess(result, styleProfile);
        return { text, memories, engine: 'api' };
      }
    } catch (err) {
      console.warn('Cloud API failed, trying fallback:', err);
    }
  }

  // --- Try Local Model ---
  if (modelReady && generator) {
    try {
      const messages = buildAPIMessages(styleProfile, retrieved, chatHistory, userMessage);
      
      const reply = await generator.chat.completions.create({
        messages,
        temperature: 0.8,
        max_tokens: 1024,
      });
      
      let generated = reply.choices[0].message.content;

      // Quality gate: if the output is empty, just a role name, or too short — skip to Markov
      const junkPatterns = /^(system|user|assistant|\.|\\?|!|,|\s)*$/i;
      if (!generated || generated.length < 2 || junkPatterns.test(generated)) {
        console.warn('Local model produced junk output, using Markov fallback:', JSON.stringify(generated));
      } else {
        const text = postProcess(generated, styleProfile);
        return { text, memories, engine: 'local' };
      }
    } catch (err) {
      console.warn('Local model generation failed, using Markov fallback:', err);
    }
  }

  // --- Markov Fallback ---
  let text = markov.generate(userMessage);
  text = postProcess(text, styleProfile);
  return { text, memories, engine: 'markov' };
}

/**
 * Generate response via cloud API (Gemini or OpenAI).
 */
async function generateViaAPI(userMessage, styleProfile, retrieved, chatHistory) {
  const settings = getAPISettings();
  if (!settings?.apiKey || !settings?.provider) return null;

  const messages = buildAPIMessages(styleProfile, retrieved, chatHistory, userMessage);

  if (settings.provider === 'gemini') {
    return await callGemini(settings.apiKey, messages, settings.model);
  } else if (settings.provider === 'openai') {
    return await callOpenAI(settings.apiKey, messages, settings.model);
  }

  return null;
}

/**
 * Call Google Gemini API.
 */
async function callGemini(apiKey, messages, model = 'gemini-2.0-flash') {
  // Convert chat messages to Gemini format
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 150
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/**
 * Call OpenAI-compatible API.
 */
async function callOpenAI(apiKey, messages, model = 'gpt-4o-mini') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.9
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

/**
 * Check if the AI model is loaded.
 */
export function isModelLoaded() {
  return modelReady;
}

/**
 * Check if cloud API is configured.
 */
export function isAPIConfigured() {
  const settings = getAPISettings();
  return !!(settings?.apiKey && settings?.provider);
}
