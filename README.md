# HeartEcho

HeartEcho turns an exported conversation into an interactive memory and personality experience. Upload a chat, explore relationship analytics, discover the other person's texting style, and chat with an AI-generated version of their voice.

## Features

- Import WhatsApp and plain-text exports (`.txt`), Telegram and Messenger exports (`.json`), or paste plain text.
- Generate a **Style Fingerprint** from message patterns, emojis, phrases, and tone.
- View message analytics, monthly activity, milestones, and conversation streaks.
- Chat using one of three response engines:
  - Google Gemini or OpenAI through a user-provided API key.
  - An in-browser Llama 3.2 model through WebLLM.
  - A lightweight Markov-chain fallback that requires no API key or model download.
- Search relevant past messages to ground replies and recall memories.
- Play **Guess The AI**, a game that asks whether a message is real or AI-generated.
- Export conversations and download shareable fingerprint and score cards.
- Store conversations, profiles, and chat history in the browser using IndexedDB.

## Requirements

- Node.js 18 or newer
- npm
- A modern browser with JavaScript enabled

No backend or database server is required.

## Getting started

```bash
git clone <repository-url>
cd aichatting
npm install
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`.

## Using HeartEcho

1. Export a conversation from WhatsApp, Telegram, or Messenger, or paste a supported plain-text conversation.
2. Upload the file from the landing page.
3. Select the person whose style should be analyzed.
4. Explore the dashboard, then open Chat or Guess The AI.
5. Optionally open Settings to choose a cloud provider or local AI mode.

### Supported input examples

WhatsApp and plain text:

```text
12/1/23, 9:41 PM - Alex: Hey, are you free tonight?
12/1/23, 9:42 PM - Sam: Yes, see you soon!
```

Telegram JSON should contain a `messages` array with `from`, `text`, and optionally `date`. Messenger JSON should contain `participants` and a `messages` array with `sender_name`, `content`, and optionally `timestamp_ms`.

## AI configuration

By default, HeartEcho can fall back to lightweight local generation. For higher-quality replies, open **Settings** and choose:

- **Google Gemini** — enter a Google AI Studio API key and choose a supported Gemini model.
- **OpenAI** — enter an OpenAI API key and choose a supported model.
- **Local AI** — downloads the in-browser Llama 3.2 model the first time Chat is opened.

API keys are saved in the browser's local storage. Do not use this app to enter keys on a shared or untrusted device.

## Privacy

Conversation data is processed in the browser and saved locally in IndexedDB. There is no application backend or tracking service. If a cloud provider is configured, chat prompts and relevant imported messages are sent to that provider to generate replies; use Local AI or Lightweight Mode when data must remain entirely on-device.

Use the Settings menu to clear API configuration, and the app's data controls to clear locally stored conversations and profiles.

## Project structure

```text
.
├── index.html              # Application shell and page markup
├── src/
│   ├── app.js              # UI state and application flow
│   ├── chatEngine.js       # Cloud, local, and Markov response engines
│   ├── parser.js           # Chat import parsing
│   ├── retrieval.js        # TF-IDF message retrieval
│   ├── analytics.js        # Timeline and conversation analytics
│   ├── gameMode.js         # Guess The AI game
│   ├── styleExtractor.js   # Texting-style analysis
│   ├── storage.js          # IndexedDB and localStorage persistence
│   └── style.css           # Visual design system
├── public/                 # Static public assets
└── package.json            # Scripts and dependencies
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |

## License

No license file is currently included in this repository.
