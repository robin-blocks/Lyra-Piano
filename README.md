# Lyra - AI Piano Teacher

> Your AI companion for mastering the keys. Learn piano through natural conversation.

Lyra is a voice-driven AI piano teacher built for the **Google Cloud AI Partner Catalyst Hackathon** (ElevenLabs Challenge). It combines ElevenLabs Conversational AI with Google Gemini to create an accessible, conversational piano learning experience.

## Features

- **Voice-First Interaction**: Speak naturally with Lyra - no typing required
- **Real Piano Sound**: High-quality piano synthesis via SplendidGrandPiano
- **Visual Feedback**: Animated Orb shows agent state (listening/talking)
- **Beginner-Friendly**: Learn piano without reading sheet music

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4
- **AI Voice**: ElevenLabs Agents Platform + Google Gemini
- **Audio**: smplr (SplendidGrandPiano)
- **3D Graphics**: Three.js, React Three Fiber

## Quick Start

### Prerequisites

- Node.js 18+
- ElevenLabs account with an agent configured
- Your agent must use **Google Gemini** as the LLM

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lyra.git
cd lyra

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local and add your ElevenLabs Agent ID
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## ElevenLabs Agent Setup

1. Go to [ElevenLabs Dashboard](https://elevenlabs.io/app/agents)
2. Create a new agent or select existing
3. In **Agent Settings → LLM**, select **Google Gemini** (gemini-2.5-flash recommended)
4. Configure the system prompt for a friendly piano teacher personality
5. Copy the Agent ID to your `.env.local` file

### Recommended System Prompt

```
You are Lyra, a friendly and patient AI piano teacher. You help beginners learn piano through natural conversation. You:
- Explain musical concepts in simple, approachable terms
- Demonstrate scales and chords by name
- Give encouraging feedback when students play
- Never use technical jargon without explaining it first
- Keep lessons fun and achievable

When teaching, start with the basics like finding Middle C, then progress to simple scales and chords.
```

## Deployment

### Firebase Hosting (Recommended)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting

# Build and deploy
npm run build
firebase deploy
```

### Google Cloud Run

```bash
# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/lyra

# Deploy
gcloud run deploy lyra --image gcr.io/YOUR_PROJECT/lyra --platform managed
```

## Project Structure

```
lyra/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   │   ├── Lyra.tsx      # Main container
│   │   ├── LyraOrb.tsx   # Orb with connect button
│   │   ├── Piano/        # Piano keyboard (Phase 2)
│   │   └── ui/           # UI primitives
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utilities and audio
├── public/               # Static assets
└── package.json
```

## Roadmap

- [x] Phase 1: Voice Agent MVP with Orb UI
- [ ] Phase 2: Piano Keyboard + Audio
- [ ] Phase 3: MIDI Capture + Phrase Grouping
- [ ] Phase 4: Evaluation Tools (Client Tools)
- [ ] Phase 5: Full Lesson Loop

## Hackathon Submission

This project is submitted to the **ElevenLabs Challenge** of the Google Cloud AI Partner Catalyst Hackathon.

**Requirements Met:**
- ✅ ElevenLabs Agents Platform integration
- ✅ Google Cloud Gemini as LLM
- ✅ Voice-first, conversational UX
- ✅ MIT License (OSI-approved)
- ✅ Hosted on Google Cloud

## License

[MIT](LICENSE)

## Acknowledgments

- [ElevenLabs](https://elevenlabs.io) for the Conversational AI platform
- [Google Cloud](https://cloud.google.com) for Gemini and hosting
- [smplr](https://github.com/danigb/smplr) for the SplendidGrandPiano sampler
- [JamieOnKeys](https://www.jamieonkeys.dev) for piano keyboard inspiration
