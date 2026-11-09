// ===== Markov Chain Engine — Offline Fallback =====
// Generates text using Markov chains trained on the person's messages
// Now supports Hindi/Devanagari text

export class MarkovEngine {
  constructor(order = 2) {
    this.order = order;
    this.chain = {};
    this.starters = [];
    this.trained = false;
    this.recentMessages = []; // Store recent real messages for better fallbacks
  }

  /**
   * Train the Markov chain on a set of messages.
   */
  train(messages) {
    this.chain = {};
    this.starters = [];
    this.recentMessages = messages.slice(-50).map(m => m.text); // Keep last 50 messages

    for (const msg of messages) {
      // Split on whitespace, preserving Hindi/Devanagari characters
      const words = msg.text.split(/\s+/).filter(w => w.length > 0);
      if (words.length < this.order + 1) continue;

      // Record starter
      const starterKey = words.slice(0, this.order).join(' ');
      this.starters.push(starterKey);

      // Build chain
      for (let i = 0; i <= words.length - this.order; i++) {
        const key = words.slice(i, i + this.order).join(' ');
        const next = words[i + this.order];

        if (next) {
          if (!this.chain[key]) this.chain[key] = [];
          this.chain[key].push(next);
        }
      }
    }

    this.trained = this.starters.length > 0;
  }

  /**
   * Generate a response, optionally seeded by input.
   */
  generate(seed = '', maxWords = 15) {
    if (!this.trained) return this.getFallback();

    let currentKey;

    // Try to find a starting point related to the seed
    if (seed) {
      const seedWords = seed.toLowerCase().split(/\s+/);
      const relatedStarter = this.starters.find(s =>
        seedWords.some(sw => s.toLowerCase().includes(sw))
      );
      if (relatedStarter) {
        currentKey = relatedStarter;
      }
    }

    // If no seed match, pick a random recent message instead of a random starter
    if (!currentKey) {
      // Prefer recent messages for more relevant output
      if (this.recentMessages.length > 0 && Math.random() > 0.3) {
        const recent = this.recentMessages[Math.floor(Math.random() * this.recentMessages.length)];
        // Return a real recent message as-is for better quality
        if (recent.split(/\s+/).length <= maxWords) {
          return recent;
        }
      }
      currentKey = this.starters[Math.floor(Math.random() * this.starters.length)];
    }

    const result = currentKey.split(' ');

    for (let i = 0; i < maxWords - this.order; i++) {
      const candidates = this.chain[currentKey];
      if (!candidates || candidates.length === 0) break;

      const next = candidates[Math.floor(Math.random() * candidates.length)];
      result.push(next);

      // Slide window
      const keyWords = currentKey.split(' ');
      keyWords.shift();
      keyWords.push(next);
      currentKey = keyWords.join(' ');
    }

    return result.join(' ');
  }

  getFallback() {
    // Mixed Hindi + English fallbacks
    const fallbacks = [
      'haha nice',
      'yeah that sounds good',
      'hmm let me think',
      'omg really?',
      'aww thats sweet',
      'lol okay',
      'sure thing',
      'hehe',
      'yesss',
      'no wayyy',
      'acha theek hai',
      'haan haan',
      'kya yaar 😂',
      'sahi hai',
      'bohot accha',
      'hehe nice yaar',
      'hmm sochne do',
      'are wah',
      'pakka',
      'bilkul'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
