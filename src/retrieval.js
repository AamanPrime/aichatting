// ===== Retrieval System — TF-IDF + Cosine Similarity =====
// Finds similar past messages for context-aware responses

/**
 * Build TF-IDF index from messages.
 */
export function buildIndex(messages) {
  const docs = messages.map(m => ({
    text: m.text,
    sender: m.sender,
    timestamp: m.timestamp,
    tokens: tokenize(m.text)
  }));

  // Compute document frequency
  const df = {};
  const N = docs.length;

  docs.forEach(doc => {
    const unique = new Set(doc.tokens);
    unique.forEach(token => {
      df[token] = (df[token] || 0) + 1;
    });
  });

  // Compute TF-IDF vectors
  docs.forEach(doc => {
    const tf = {};
    doc.tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });

    doc.tfidf = {};
    doc.tokens.forEach(t => {
      const tfScore = tf[t] / doc.tokens.length;
      const idfScore = Math.log((N + 1) / (1 + (df[t] || 0)));
      doc.tfidf[t] = tfScore * idfScore;
    });

    // Pre-compute magnitude
    doc.magnitude = Math.sqrt(
      Object.values(doc.tfidf).reduce((sum, v) => sum + v * v, 0)
    );
  });

  return { docs, df, N };
}

/**
 * Retrieve the most similar messages to a query.
 * @param {Object} index - Built index from buildIndex()
 * @param {string} query - The user's message
 * @param {number} topK - Number of results
 * @param {string} filterSender - Optional sender to filter by
 * @returns {Array} Top matching messages
 */
export function retrieve(index, query, topK = 5, filterSender = null) {
  if (!index || !index.docs || index.docs.length === 0) return [];

  const queryTokens = tokenize(query);
  const queryTf = {};
  queryTokens.forEach(t => { queryTf[t] = (queryTf[t] || 0) + 1; });

  const queryTfidf = {};
  queryTokens.forEach(t => {
    const tfScore = queryTf[t] / queryTokens.length;
    const idfScore = Math.log((index.N + 1) / (1 + (index.df[t] || 0)));
    queryTfidf[t] = tfScore * idfScore;
  });

  const queryMag = Math.sqrt(
    Object.values(queryTfidf).reduce((sum, v) => sum + v * v, 0)
  );

  if (queryMag === 0) return [];

  // Compute cosine similarity with each doc
  const scored = index.docs
    .filter(doc => !filterSender || doc.sender === filterSender)
    .map(doc => {
      let dotProduct = 0;
      for (const token in queryTfidf) {
        if (doc.tfidf[token]) {
          dotProduct += queryTfidf[token] * doc.tfidf[token];
        }
      }

      const similarity = doc.magnitude > 0
        ? dotProduct / (queryMag * doc.magnitude)
        : 0;

      return { ...doc, similarity };
    })
    .filter(d => d.similarity > 0.01)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored.map(d => ({
    text: d.text,
    sender: d.sender,
    timestamp: d.timestamp,
    similarity: d.similarity
  }));
}

/**
 * Retrieve messages related to a topic (memory recall).
 */
export function recallMemories(index, topic, topK = 5) {
  return retrieve(index, topic, topK);
}

// --- Tokenizer (supports Hindi/Devanagari + English) ---

function tokenize(text) {
  return text
    .toLowerCase()
    // Keep word characters AND Devanagari Unicode range (U+0900–U+097F)
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !isStopWord(t));
}

function isStopWord(word) {
  const stops = new Set([
    // English stop words
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'can', 'and', 'but', 'or', 'not', 'so', 'for', 'with',
    'that', 'this', 'it', 'its', 'you', 'your', 'they', 'them', 'their',
    'she', 'her', 'him', 'his', 'we', 'us', 'our', 'me', 'my', 'am',
    'to', 'in', 'on', 'at', 'by', 'of', 'if', 'up', 'no', 'as',
    // Hindi stop words (Devanagari)
    'और', 'का', 'की', 'के', 'में', 'है', 'हैं', 'को', 'से', 'पर',
    'ने', 'यह', 'वह', 'भी', 'तो', 'जो', 'इस', 'उस', 'एक', 'या',
    'कि', 'नहीं', 'हो', 'था', 'थी', 'थे', 'कर', 'मैं', 'तुम', 'हम',
    // Hindi stop words (Romanized)
    'hai', 'hain', 'ko', 'se', 'par', 'bhi', 'toh', 'aur', 'nahi',
    'kya', 'mein', 'tha', 'thi', 'the', 'kar', 'mai', 'tum', 'hum'
  ]);
  return stops.has(word);
}
