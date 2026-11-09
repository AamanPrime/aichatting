// ===== Guess The AI — Game Mode =====
// Shows real vs AI-generated messages, user guesses which is real

import { MarkovEngine } from './markovEngine.js';

/**
 * Initialize a game session.
 * @param {Array} messages - All parsed messages
 * @param {string} targetSender - Person to test knowledge of
 * @param {number} rounds - Number of rounds
 * @returns {Object} Game state
 */
export function initGame(messages, targetSender, rounds = 10) {
  const personMsgs = messages
    .filter(m => m.sender === targetSender && m.text.length > 5 && m.text.length < 200)
    .map(m => m.text);

  if (personMsgs.length < 5) {
    return { error: 'Not enough messages to play the game. Need at least 5 messages.' };
  }

  // Train a Markov chain for generating fake messages
  const markov = new MarkovEngine(2);
  markov.train(messages.filter(m => m.sender === targetSender));

  // Generate rounds
  const gameRounds = [];
  const usedIndices = new Set();

  const actualRounds = Math.min(rounds, Math.floor(personMsgs.length / 2));

  for (let i = 0; i < actualRounds; i++) {
    // Pick a random real message
    let realIdx;
    do {
      realIdx = Math.floor(Math.random() * personMsgs.length);
    } while (usedIndices.has(realIdx));
    usedIndices.add(realIdx);

    const realMsg = personMsgs[realIdx];

    // Generate a fake message
    let fakeMsg = markov.generate(realMsg.split(' ')[0], 12);

    // Make fake more believable by occasionally using fragments of real messages
    if (Math.random() > 0.5) {
      const otherIdx = Math.floor(Math.random() * personMsgs.length);
      const otherMsg = personMsgs[otherIdx];
      const words = otherMsg.split(/\s+/);
      if (words.length > 3) {
        const start = Math.floor(Math.random() * Math.max(1, words.length - 4));
        fakeMsg = words.slice(start, start + 3 + Math.floor(Math.random() * 3)).join(' ');
      }
    }

    // Randomize order (real first or second)
    const realFirst = Math.random() > 0.5;

    gameRounds.push({
      options: realFirst
        ? [{ text: realMsg, isReal: true }, { text: fakeMsg, isReal: false }]
        : [{ text: fakeMsg, isReal: false }, { text: realMsg, isReal: true }],
      answered: false,
      correct: null
    });
  }

  return {
    rounds: gameRounds,
    currentRound: 0,
    score: 0,
    total: actualRounds,
    targetSender,
    error: null
  };
}

/**
 * Answer the current round.
 * @param {Object} gameState - Current game state
 * @param {number} choiceIndex - 0 or 1
 * @returns {Object} Updated game state with result
 */
export function answerRound(gameState, choiceIndex) {
  const round = gameState.rounds[gameState.currentRound];
  if (!round || round.answered) return gameState;

  const isCorrect = round.options[choiceIndex].isReal;
  round.answered = true;
  round.correct = isCorrect;
  round.choiceIndex = choiceIndex;

  if (isCorrect) {
    gameState.score++;
  }

  return { ...gameState };
}

/**
 * Move to the next round.
 */
export function nextRound(gameState) {
  gameState.currentRound++;
  return { ...gameState };
}

/**
 * Check if the game is over.
 */
export function isGameOver(gameState) {
  return gameState.currentRound >= gameState.total;
}

/**
 * Get end-of-game message.
 */
export function getEndMessage(gameState) {
  const pct = Math.round((gameState.score / Math.max(gameState.total, 1)) * 100);

  if (pct >= 90) return { title: '🎉 Incredible!', msg: `You really know ${gameState.targetSender}'s texting style!` };
  if (pct >= 70) return { title: '👏 Great Job!', msg: `You know ${gameState.targetSender} pretty well!` };
  if (pct >= 50) return { title: '🤔 Not Bad!', msg: `The AI is getting good at mimicking ${gameState.targetSender}.` };
  if (pct >= 30) return { title: '😅 Tricky!', msg: `${gameState.targetSender}'s clone is quite convincing!` };
  return { title: '😂 AI Wins!', msg: `The AI completely fooled you pretending to be ${gameState.targetSender}!` };
}
