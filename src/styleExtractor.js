// ===== Style Extractor — Text Personality Analysis =====
// Analyzes a person's texting style from their messages

/**
 * Extract a style profile from messages for a given sender.
 * @param {Array} messages - All parsed messages
 * @param {string} senderName - The person to analyze
 * @returns {Object} Style profile
 */
export function extractStyle(messages, senderName) {
  const personMsgs = messages.filter(m => m.sender === senderName);

  if (personMsgs.length === 0) {
    return getDefaultProfile(senderName);
  }

  const texts = personMsgs.map(m => m.text);
  const allText = texts.join(' ');

  // --- Basic Metrics ---
  const avgLength = Math.round(texts.reduce((sum, t) => sum + t.split(/\s+/).length, 0) / texts.length);
  const totalEmojis = personMsgs.reduce((sum, m) => sum + (m.emojis ? m.emojis.length : 0), 0);
  const emojiRate = parseFloat((totalEmojis / personMsgs.length).toFixed(2));

  // --- Top Emojis ---
  const emojiCounts = {};
  personMsgs.forEach(m => {
    (m.emojis || []).forEach(e => {
      emojiCounts[e] = (emojiCounts[e] || 0) + 1;
    });
  });
  const topEmojis = Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji, count]) => ({ emoji, count }));

  // --- Top Phrases ---
  const phraseCounts = {};
  const words = allText.toLowerCase().split(/\s+/);

  // Unigrams (common short words)
  words.forEach(w => {
    const clean = w.replace(/[.,!?;:'"]/g, '');
    if (clean.length >= 3 && !isStopWord(clean)) {
      phraseCounts[clean] = (phraseCounts[clean] || 0) + 1;
    }
  });

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i].replace(/[.,!?]/g, '') + ' ' + words[i + 1].replace(/[.,!?]/g, '');
    if (bigram.length > 4) {
      phraseCounts[bigram] = (phraseCounts[bigram] || 0) + 1;
    }
  }

  const topPhrases = Object.entries(phraseCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase]) => phrase);

  // --- Punctuation Style ---
  const exclamations = (allText.match(/!/g) || []).length;
  const questions = (allText.match(/\?/g) || []).length;
  const ellipsis = (allText.match(/\.\.\./g) || []).length;
  const caps = (allText.match(/[A-Z]{2,}/g) || []).length;

  const punctuationStyle = exclamations > questions ? 'exclamatory' :
    questions > exclamations ? 'inquisitive' : 'balanced';

  // --- Tone Detection ---
  const tone = detectTone(texts);

  // --- Reply Time Patterns (if timestamps available) ---
  const activeHours = getActiveHours(personMsgs);

  // --- Message Length Distribution ---
  const shortMsgs = texts.filter(t => t.split(/\s+/).length <= 3).length;
  const longMsgs = texts.filter(t => t.split(/\s+/).length > 15).length;
  const lengthStyle = shortMsgs > texts.length * 0.6 ? 'short texter' :
    longMsgs > texts.length * 0.3 ? 'essay writer' : 'moderate';

  // --- Style Labels (for the fingerprint card) ---
  const labels = generateLabels({
    emojiRate, avgLength, punctuationStyle, tone, lengthStyle,
    topEmojis, caps, exclamations, ellipsis
  });

  return {
    personName: senderName,
    totalMessages: personMsgs.length,
    avgLength,
    emojiRate,
    topEmojis,
    topPhrases,
    punctuationStyle,
    tone,
    activeHours,
    lengthStyle,
    labels,
    caps: caps > 10,
    usesEllipsis: ellipsis > 5,
    exclamationRate: parseFloat((exclamations / personMsgs.length).toFixed(2))
  };
}

// --- Tone Detection ---

function detectTone(texts) {
  let casual = 0, formal = 0, playful = 0, emotional = 0;

  const casualWords = [
    'lol', 'haha', 'hehe', 'lmao', 'bruh', 'nah', 'yeah', 'yaar', 'omg', 'tbh', 'ikr', 'ngl', 'fr',
    // Hindi/Hinglish casual
    'acha', 'accha', 'theek', 'sahi', 'chal', 'haan', 'nahi', 'kya', 'bhai', 'yaar', 'arre', 'chalo',
    'bas', 'ok', 'hmm', 'arey'
  ];
  const formalWords = [
    'however', 'therefore', 'regarding', 'furthermore', 'accordingly', 'hence',
    'kripya', 'dhanyavaad', 'namaste'
  ];
  const playfulWords = [
    'hehe', '😂', '🤣', 'xd', 'lmfao', 'rofl', 'haha', ':p', ':)', ';)',
    'pagal', 'paagal', 'bewakoof', 'mazak', 'hasna', 'lmao'
  ];
  const emotionalWords = [
    'love', 'miss', 'heart', '❤', '🥺', '😭', 'aww', 'baby', 'babe',
    'pyaar', 'mohabbat', 'yaad', 'dil', 'jaan', 'jaanu', 'babu', 'miss karta', 'miss karti'
  ];

  for (const text of texts) {
    const lower = text.toLowerCase();
    casualWords.forEach(w => { if (lower.includes(w)) casual++; });
    formalWords.forEach(w => { if (lower.includes(w)) formal++; });
    playfulWords.forEach(w => { if (lower.includes(w)) playful++; });
    emotionalWords.forEach(w => { if (lower.includes(w)) emotional++; });
  }

  const scores = { casual, formal, playful, emotional };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// --- Active Hours ---

function getActiveHours(messages) {
  const hourCounts = new Array(24).fill(0);
  messages.forEach(m => {
    if (m.timestamp) {
      const hour = new Date(m.timestamp).getHours();
      if (!isNaN(hour)) hourCounts[hour]++;
    }
  });

  const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
  let period;
  if (maxHour >= 6 && maxHour < 12) period = 'morning';
  else if (maxHour >= 12 && maxHour < 17) period = 'afternoon';
  else if (maxHour >= 17 && maxHour < 21) period = 'evening';
  else period = 'night';

  return { hourCounts, peakHour: maxHour, period };
}

// --- Label Generator ---

function generateLabels(profile) {
  const labels = [];

  if (profile.emojiRate > 0.5) labels.push({ emoji: '❤️', text: 'Emoji addict' });
  else if (profile.emojiRate > 0.2) labels.push({ emoji: '😊', text: 'Emoji friendly' });
  else labels.push({ emoji: '📝', text: 'Minimal emoji user' });

  labels.push({ emoji: '💬', text: `Avg ${profile.avgLength} words/msg` });

  if (profile.tone === 'playful') labels.push({ emoji: '😅', text: 'Uses humor in serious moments' });
  if (profile.tone === 'casual') labels.push({ emoji: '😎', text: 'Super casual vibes' });
  if (profile.tone === 'emotional') labels.push({ emoji: '🥺', text: 'Wears heart on sleeve' });

  if (profile.lengthStyle === 'short texter') labels.push({ emoji: '⚡', text: 'Short & snappy texter' });
  if (profile.lengthStyle === 'essay writer') labels.push({ emoji: '📖', text: 'Writes paragraphs' });

  if (profile.caps) labels.push({ emoji: '🔊', text: 'CAPS LOCK ENTHUSIAST' });
  if (profile.usesEllipsis) labels.push({ emoji: '💭', text: 'Loves the ...' });
  if (profile.exclamations > 0.3) labels.push({ emoji: '❗', text: 'Exclamation lover!' });

  if (profile.topEmojis.length > 0) {
    labels.push({
      emoji: '✨',
      text: `Favorite: ${profile.topEmojis.slice(0, 3).map(e => e.emoji).join(' ')}`
    });
  }

  return labels;
}

// --- Stop Words ---

function isStopWord(word) {
  const stops = new Set([
    // English
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'for', 'with', 'from',
    'that', 'this', 'these', 'those', 'it', 'its', 'you', 'your', 'yours',
    'they', 'them', 'their', 'theirs', 'she', 'her', 'hers', 'him', 'his',
    'who', 'whom', 'what', 'which', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
    'also', 'just', 'than', 'too', 'very', 'then', 'about', 'into', 'over',
    'after', 'before', 'between', 'out', 'off', 'down', 'there', 'here',
    'now', 'only', 'well', 'back', 'get', 'got', 'like', 'want', 'know',
    'think', 'say', 'said', 'one', 'two', 'going', 'come', 'came', 'make',
    // Hindi (Romanized)
    'hai', 'hain', 'ko', 'se', 'par', 'bhi', 'toh', 'aur', 'nahi',
    'mein', 'tha', 'thi', 'the', 'kar', 'mai', 'tum', 'hum',
    // Hindi (Devanagari)
    'और', 'का', 'की', 'के', 'में', 'है', 'हैं', 'को', 'से', 'पर',
    'ने', 'यह', 'वह', 'भी', 'तो', 'जो', 'इस', 'उस', 'एक', 'या'
  ]);
  return stops.has(word);
}

function getDefaultProfile(name) {
  return {
    personName: name,
    totalMessages: 0,
    avgLength: 0,
    emojiRate: 0,
    topEmojis: [],
    topPhrases: [],
    punctuationStyle: 'balanced',
    tone: 'casual',
    activeHours: { hourCounts: new Array(24).fill(0), peakHour: 12, period: 'afternoon' },
    lengthStyle: 'moderate',
    labels: [{ emoji: '❓', text: 'Not enough data' }],
    caps: false,
    usesEllipsis: false,
    exclamationRate: 0
  };
}
