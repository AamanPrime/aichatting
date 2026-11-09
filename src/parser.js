// ===== Multi-Format Chat Parser =====
// Supports: WhatsApp, Telegram, Messenger, Plain Text

/**
 * Parse raw chat text/JSON into a normalized format.
 * Returns: { messages: [{ sender, text, timestamp, emojis }], senders: string[] }
 */
export function parseChat(content, filename = '') {
  const ext = filename.split('.').pop().toLowerCase();

  let messages;

  if (ext === 'json') {
    messages = parseJSON(content);
  } else {
    messages = parseText(content);
  }

  // Extract unique senders
  const senders = [...new Set(messages.map(m => m.sender))].filter(Boolean);

  // Extract emojis from each message
  messages = messages.map(m => ({
    ...m,
    emojis: extractEmojis(m.text)
  }));

  return { messages, senders };
}

// --- WhatsApp & Plain Text ---

function parseText(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const messages = [];

  // WhatsApp format: "12/1/23, 9:41 PM - Name: message" or "[12/1/23, 9:41:00 PM] Name: message"
  const waPattern1 = /^(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*[-–]\s*(.+?):\s*(.+)$/;
  const waPattern2 = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*(.+?):\s*(.+)$/;
  // Simple format: "Name: message"
  const simplePattern = /^(.+?):\s+(.+)$/;

  for (const line of lines) {
    let match;

    if ((match = line.match(waPattern1)) || (match = line.match(waPattern2))) {
      const timestamp = parseTimestamp(match[1]);
      const sender = match[2].trim();
      const text = match[3].trim();

      // Skip system messages
      if (isSystemMessage(text)) continue;

      messages.push({ sender, text, timestamp });
    } else if ((match = line.match(simplePattern))) {
      const sender = match[1].trim();
      const text = match[2].trim();

      // Avoid matching URLs or system text
      if (sender.length > 30 || sender.includes('http')) continue;

      messages.push({
        sender,
        text,
        timestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : Date.now()
      });
    } else if (messages.length > 0) {
      // Continuation of previous message
      messages[messages.length - 1].text += '\n' + line.trim();
    }
  }

  return messages;
}

// --- JSON (Telegram / Messenger) ---

function parseJSON(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    // If JSON parse fails, try as text
    return parseText(content);
  }

  // Telegram format: { messages: [{ from, text, date }] }
  if (data.messages && Array.isArray(data.messages)) {
    return data.messages
      .filter(m => m.text && typeof m.text === 'string' && m.from)
      .map(m => ({
        sender: m.from || m.from_id || 'Unknown',
        text: typeof m.text === 'string' ? m.text : JSON.stringify(m.text),
        timestamp: m.date ? new Date(m.date).getTime() : Date.now()
      }));
  }

  // Messenger format: { participants: [], messages: [{ sender_name, content, timestamp_ms }] }
  if (data.participants && data.messages) {
    return data.messages
      .filter(m => m.content)
      .map(m => ({
        sender: m.sender_name || 'Unknown',
        text: decodeMessengerText(m.content),
        timestamp: m.timestamp_ms || Date.now()
      }))
      .reverse(); // Messenger exports are newest-first
  }

  return [];
}

// --- Helpers ---

function parseTimestamp(str) {
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date.getTime();
  } catch {}

  // Manual parse for common formats
  const parts = str.match(/(\d+)/g);
  if (parts && parts.length >= 5) {
    const [month, day, year, hour, minute] = parts.map(Number);
    const fullYear = year < 100 ? 2000 + year : year;
    const isPM = str.toLowerCase().includes('pm');
    const adjustedHour = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
    return new Date(fullYear, month - 1, day, adjustedHour, minute).getTime();
  }

  return Date.now();
}

function isSystemMessage(text) {
  const systemPatterns = [
    'Messages and calls are end-to-end encrypted',
    'created group',
    'added you',
    'changed the subject',
    'changed this group',
    'left the group',
    'removed you',
    '<Media omitted>',
    'missed voice call',
    'missed video call',
    'deleted this message',
    'This message was deleted',
    'security code changed'
  ];
  return systemPatterns.some(p => text.includes(p));
}

function decodeMessengerText(text) {
  // Messenger exports use latin1-encoded UTF-8
  try {
    return decodeURIComponent(escape(text));
  } catch {
    return text;
  }
}

function extractEmojis(text) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}❤️‍🔥❤️‍🩹💕💞💓💗💖💘💝]/gu;
  return text.match(emojiRegex) || [];
}
