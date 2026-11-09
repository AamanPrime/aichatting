// ===== Prompt Builder — Bilingual (Hindi + English) Chat Prompts =====
// Builds prompts for both cloud API (message format) and local model (text format)

/**
 * Build the system prompt describing the person's style.
 */
function buildSystemPrompt(styleProfile, retrieved) {
  const parts = [];

  parts.push(`You are roleplaying as "${styleProfile.personName}" in a text conversation.`);
  parts.push(`Your ONLY job is to reply EXACTLY like ${styleProfile.personName} would — same tone, same style, same language.`);
  parts.push('');

  // Language instruction
  parts.push('LANGUAGE RULES:');
  parts.push('- If the user texts in Hindi/Hinglish, reply in Hindi/Hinglish.');
  parts.push('- If the user texts in English, reply in English.');
  parts.push('- Match the exact mix of Hindi-English they use (Hinglish style).');
  parts.push('');

  // Style traits
  parts.push(`${styleProfile.personName}'s texting style:`);

  if (styleProfile.lengthStyle === 'short texter') {
    parts.push('- Sends short casual replies, usually 1-8 words');
  } else if (styleProfile.lengthStyle === 'essay writer') {
    parts.push('- Writes longer detailed messages');
  } else {
    parts.push(`- Average message length: ${styleProfile.avgLength} words`);
  }

  if (styleProfile.emojiRate > 0.3) {
    const topEmoji = styleProfile.topEmojis.slice(0, 3).map(e => e.emoji).join(' ');
    parts.push(`- Uses lots of emojis, favorites: ${topEmoji}`);
  } else if (styleProfile.emojiRate > 0.1) {
    parts.push('- Uses emojis occasionally');
  } else {
    parts.push('- Rarely uses emojis');
  }

  if (styleProfile.topPhrases.length > 0) {
    parts.push(`- Commonly says: "${styleProfile.topPhrases.slice(0, 4).join('", "')}"`);
  }

  if (styleProfile.tone) {
    parts.push(`- Overall tone: ${styleProfile.tone}`);
  }

  if (styleProfile.caps) {
    parts.push('- Sometimes uses CAPS for emphasis');
  }

  if (styleProfile.usesEllipsis) {
    parts.push('- Often uses "..." in messages');
  }

  parts.push('');

  // Strict output rules
  parts.push('STRICT RULES:');
  parts.push('- Reply with ONLY the message text. No labels, no "Name:", no quotes.');
  parts.push('- Keep replies short and natural like real texting.');
  parts.push('- Do NOT write more than 1-2 sentences max.');
  parts.push('- Never break character. You ARE this person.');

  // Add retrieved context
  if (retrieved && retrieved.length > 0) {
    parts.push('');
    parts.push(`Some of ${styleProfile.personName}'s actual past messages for reference:`);
    retrieved.slice(0, 5).forEach((msg, i) => {
      parts.push(`${i + 1}. "${msg.text}"`);
    });
  }

  return parts.join('\n');
}

/**
 * Build API-format messages (for Gemini/OpenAI).
 * Returns array of { role, content } objects.
 */
export function buildAPIMessages(styleProfile, retrievedMessages, recentChatHistory, userMessage) {
  const messages = [];

  // System message
  messages.push({
    role: 'system',
    content: buildSystemPrompt(styleProfile, retrievedMessages)
  });

  // Recent chat history as conversation turns
  if (recentChatHistory && recentChatHistory.length > 0) {
    recentChatHistory.slice(-8).forEach(msg => {
      if (msg.isRecall) return; // skip memory recall messages
      messages.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: msg.text
      });
    });
  }

  // Current user message
  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}

/**
 * Build a COMPACT system prompt for local models with small context windows (e.g. TinyLlama 2048 tokens).
 * Much shorter than the full system prompt used for cloud APIs.
 */
function buildCompactSystemPrompt(styleProfile, retrieved) {
  const parts = [];

  parts.push(`You are "${styleProfile.personName}" texting casually. Reply as them.`);

  // Key style in one line
  const traits = [];
  if (styleProfile.lengthStyle === 'short texter') traits.push('short replies');
  if (styleProfile.emojiRate > 0.3 && styleProfile.topEmojis.length > 0) {
    traits.push(`uses ${styleProfile.topEmojis.slice(0, 2).map(e => e.emoji).join(' ')}`);
  }
  if (styleProfile.tone) traits.push(`${styleProfile.tone} tone`);
  if (traits.length > 0) parts.push(`Style: ${traits.join(', ')}.`);

  // Only 2 example messages (compact)
  if (retrieved && retrieved.length > 0) {
    parts.push('Examples:');
    retrieved.slice(0, 2).forEach(msg => {
      parts.push(`"${msg.text.substring(0, 60)}"`);
    });
  }

  parts.push('Reply with ONLY the message. Keep it short, 1-2 sentences max.');

  return parts.join('\n');
}

/**
 * Build a text prompt for local model (TinyLlama / Llama2 chat format).
 * Uses compact system prompt to fit within 2048-token context.
 */
export function buildPrompt(styleProfile, retrievedMessages, recentChatHistory, userMessage) {
  // Use compact prompt for local model to fit in TinyLlama's 2048-token context
  const systemPrompt = buildCompactSystemPrompt(styleProfile, retrievedMessages);

  // Simple single-turn format — most reliable for small models
  // Include only the last 2 chat messages for minimal context
  let contextStr = '';
  if (recentChatHistory && recentChatHistory.length > 0) {
    const recent = recentChatHistory.slice(-2).filter(m => !m.isRecall);
    if (recent.length > 0) {
      contextStr = recent.map(m => m.isUser ? `User: ${m.text}` : `${styleProfile.personName}: ${m.text}`).join('\n') + '\n';
    }
  }

  return `<s>[INST] <<SYS>>\n${systemPrompt}\n<</SYS>>\n\n${contextStr}${userMessage} [/INST]`;
}

/**
 * Post-process the response to match the person's style.
 * Works for both API and local model output.
 */
export function postProcess(response, styleProfile) {
  console.log('=== Raw AI Response ===');
  console.log(response);
  console.log('=======================');
  
  let text = response.trim();

  // --- Step 1: Strip prompt artifacts ---

  // Remove <think> blocks (Chain of Thought output)
  text = text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '');

  // Remove any ChatML/Llama2 template tags that leaked through
  text = text.replace(/<\|im_start\|>/g, '');
  text = text.replace(/<\|im_end\|>/g, '');
  text = text.replace(/<\|endoftext\|>/g, '');
  text = text.replace(/<\|end\|>/g, '');
  text = text.replace(/\[INST\]/g, '');
  text = text.replace(/\[\/INST\]/g, '');
  text = text.replace(/<<SYS>>/g, '');
  text = text.replace(/<< *\/ *SYS *>>/g, '');
  text = text.replace(/<\/?s>/g, '');

  // Remove role names that leak from ChatML (system, user, assistant)
  text = text.replace(/^\s*(system|user|assistant)\s*/gi, '');
  text = text.replace(/\n\s*(system|user|assistant)\s*/gi, '\n');
  text = text.trim();

  // Remove any "Name:" prefix the model may echo
  const namePattern = new RegExp(`^${escapeRegex(styleProfile.personName)}:\\s*`, 'i');
  text = text.replace(namePattern, '');

  // Remove "User:" and everything after (model continuing the conversation)
  const cutPatterns = ['User:', 'You:', '\nUser', '\nYou', 'Style traits:', 'Relevant past', 'Conversation:', 'STRICT RULES:', 'LANGUAGE RULES:'];
  for (const pattern of cutPatterns) {
    const idx = text.indexOf(pattern);
    if (idx > 0) text = text.substring(0, idx).trim();
  }

  // Remove any remaining "Name:" patterns mid-text
  text = text.replace(/\b[A-Z][a-z]+:\s/g, '');

  // Remove numbered list artifacts
  text = text.replace(/^\d+\.\s*/gm, '');

  // --- Step 2: Take only the first coherent sentence/fragment ---

  // Split on newlines first — only take line 1
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) text = lines[0].trim();

  // Split on sentence boundaries, take at most 2 sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 1);
  if (sentences.length > 2) {
    text = sentences.slice(0, 2).join(' ');
  }

  // --- Step 3: Enforce word limits ---

  const targetWords = styleProfile.avgLength || 8;
  const maxWords = Math.max(targetWords + 8, 20);
  const words = text.split(/\s+/);

  if (words.length > maxWords) {
    let cutIdx = maxWords;
    for (let i = Math.min(targetWords + 3, words.length - 1); i < maxWords && i < words.length; i++) {
      if (/[.!?,।]$/.test(words[i])) {
        cutIdx = i + 1;
        break;
      }
    }
    text = words.slice(0, cutIdx).join(' ');
  }

  // Remove trailing incomplete fragments
  text = text.replace(/\s+\w{1,2}$/, '');
  text = text.replace(/[,;:\-–]\s*$/, '');

  // --- Step 4: Style matching ---

  // Lowercase if person writes casually
  if (styleProfile.tone === 'casual' || styleProfile.tone === 'playful') {
    if (text.length > 0 && !/^[A-Z]{2,}/.test(text)) {
      text = text.charAt(0).toLowerCase() + text.slice(1);
    }
  }

  // Add emoji if person uses them frequently and response has none
  const hasEmoji = /[\u{1F600}-\u{1FAFF}\u{2600}-\u{26FF}❤️💕💗💖💝💘💓💞🥰😍🥺]/u.test(text);
  if (styleProfile.emojiRate > 0.3 && !hasEmoji) {
    const randomEmoji = styleProfile.topEmojis.length > 0
      ? styleProfile.topEmojis[Math.floor(Math.random() * Math.min(3, styleProfile.topEmojis.length))].emoji
      : '😊';
    if (Math.random() > 0.3) {
      text = text + ' ' + randomEmoji;
    }
  }

  // --- Step 5: Ensure quality ---

  // Remove quotes wrapping the whole response
  text = text.replace(/^["'](.+)["']$/, '$1');

  // Ensure not empty or too short
  if (!text || text.length < 2 || text.split(/\s+/).length < 1) {
    text = generateFallbackResponse(styleProfile);
  }

  return text;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateFallbackResponse(profile) {
  const casualResponses = ['hmm', 'yeah', 'haha okay', 'sure', 'lol', 'okayy', 'acha', 'theek hai'];
  const playfulResponses = ['hehe', 'nooo way', 'omgg', 'lmaoo', 'stopppp', 'arey yaar 😂', 'pagal hai kya'];
  const emotionalResponses = ['aww', 'i miss that', 'thats so sweet', 'you always make me smile', 'bohot yaad aata hai'];

  let pool;
  switch (profile.tone) {
    case 'playful': pool = playfulResponses; break;
    case 'emotional': pool = emotionalResponses; break;
    default: pool = casualResponses;
  }

  let text = pool[Math.floor(Math.random() * pool.length)];

  if (profile.emojiRate > 0.2 && profile.topEmojis.length > 0) {
    text += ' ' + profile.topEmojis[0].emoji;
  }

  return text;
}
