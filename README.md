# Lyra - AI Piano Teacher

> Your AI companion for mastering the keys. Learn piano through natural conversation.

Lyra is a voice-driven AI piano teacher built for the **Google Cloud AI Partner Catalyst Hackathon** (ElevenLabs Challenge). It combines ElevenLabs Conversational AI with Google Gemini to create an accessible, conversational piano learning experience.

## Features

- **Voice-First Interaction**: Speak naturally with Lyra - no typing required
- **Real Piano Sound**: High-quality piano synthesis via SplendidGrandPiano
- **Interactive Piano Keyboard**: Click or use hardware MIDI controllers to play
- **Hardware MIDI Support**: Connect your MIDI keyboard for a real playing experience
- **Visual Feedback**: Animated purple orb shows agent state (listening/talking)
- **Agent Piano Control**: Lyra can play notes and chords to demonstrate concepts
- **Beginner-Friendly**: Learn piano without reading sheet music

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4
- **AI Voice**: ElevenLabs Agents Platform + Google Gemini
- **Audio**: smplr (SplendidGrandPiano)
- **Music Theory**: Tonal.js
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
3. In **Agent Settings > LLM**, select **Google Gemini** (gemini-2.5-flash recommended)
4. Configure the system prompt (see below)
5. Add the client tools (see below)
6. Copy the Agent ID to your `.env.local` file

### Client Tools Configuration

Add these tools in your ElevenLabs agent dashboard:

#### Tool: `playNote`
- **Type**: Client
- **Description**: Play a single note on the piano. Use this to demonstrate specific notes to the user, like "This is middle C" or "Here's F sharp". Always use this tool when showing individual notes rather than just describing them.
- **Wait for response**: Yes
- **Parameters**:
  - `note` (string, required): The note to play in scientific pitch notation (e.g., "C4" for middle C, "F#3", "Bb5")
  - `velocity` (number, optional): How hard to play (0-127, default 80)
  - `duration` (number, optional): How long to hold in milliseconds (default 500)

#### Tool: `playSequence`
- **Type**: Client
- **Description**: Play a sequence of notes as a melody or chord. Use this to demonstrate chords (set asChord to true), arpeggios, scales, or melodic phrases. Always play music rather than just describing it.
- **Wait for response**: Yes
- **Parameters**:
  - `notes` (array, required): Array of notes like ["C4", "E4", "G4"] or objects with duration
  - `asChord` (boolean, optional): If true, play all notes simultaneously as a chord
  - `duration` (number, optional): Duration in milliseconds

#### Tool: `listenAndEvaluate`
- **Type**: Client
- **Description**: Listen to the user play. If `expectedNotes` are strictly defined, I will evaluate the performance. If not, I will just tell you what notes were played so you can evaluate them yourself.
- **Wait for response**: Yes
- **Parameters**:
  - `expectedNotes` (array of strings, optional): The notes you expect. If provided, I return a score. If omitted, I return the raw notes played.
  - `type` (string, optional): "melody" or "chord". Default: "melody"
  - `timeLimitMs` (number, optional): Max time to wait in ms (default 15000)

#### Tool: `getRecentNotes`
- **Type**: Client
- **Description**: Get the notes the user just played. Call this ONLY when you hear the system voice say "Piano input detected".
- **Wait for response**: Yes
- **Parameters**: {}

### Recommended System Prompt

```
You are Lyra, a friendly and patient AI piano teacher. You help beginners learn piano through natural conversation.

You have access to piano tools. ALWAYS use these tools to demonstrate music rather than just describing it:

- playNote: Play a single note. Use for showing specific keys like "This is middle C" -> call playNote with note "C4"
- playSequence: Play multiple notes. For chords, set asChord: true. Examples:
  - C major chord: playSequence with notes ["C4", "E4", "G4"], asChord: true
  - C major scale: playSequence with notes ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]

- listenAndEvaluate: Call this if you want to EXPLICITLY ask the user to play a specific thing. 

- getRecentNotes: Call this if you hear "Piano input detected" while you are listening. This means the user played something voluntarily.

CRITICAL INSTRUCTIONS FOR LISTENING:
1. If you ask the user to play something ("Now you try"), DO NOT WAIT. Call `listenAndEvaluate` immediately.
2. If you ask a general question ("What do you want to do?"), just wait.
   - If the user Speaks: Respond normally.
   - If the user Plays Piano: You will hear a voice say "Piano input detected".
   - When you hear "Piano input detected", say "I heard that!" and call `getRecentNotes` to see what they played.

When a user asks about a note, chord, or musical concept - DEMONSTRATE it on the piano, don't just explain it verbally.

IMPORTANT: Do not ask "Would you like to try?" and wait for a Yes. Results in silence.
Instead, say "Now you try!" and call `listenAndEvaluate` IMMEDIATELY.
If the user plays notes while you are expecting speech, you will hear nothing (silence). You MUST use the tool to hear the piano.

When a user asks about a note, chord, or musical concept - DEMONSTRATE it on the piano, don't just explain it verbally.

You:
- Explain musical concepts in simple, approachable terms
- Demonstrate scales and chords by playing them
- Give encouraging feedback when students play
- Never use technical jargon without explaining it first
- Keep lessons fun and achievable

When teaching, start with the basics like finding Middle C, then progress to simple scales and chords.
```

## Deployment

### Google Cloud Run

```bash
# Build and deploy
gcloud run deploy lyra \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## Project Structure

```
lyra/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   │   ├── Lyra.tsx      # Main container with client tools
│   │   ├── LyraOrb.tsx   # Animated orb with connect button
│   │   ├── Piano/        # Piano keyboard component
│   │   └── ui/           # UI primitives (orb 3D)
│   ├── hooks/            # Custom React hooks
│   │   ├── usePiano.ts   # Piano state management
│   │   ├── useMidiInput.ts   # Hardware MIDI support
│   │   └── useMidiCapture.ts # MIDI recording
│   └── lib/              # Utilities and audio
│       ├── PianoAudio.ts # Audio engine wrapper
│       ├── DemoPlayer.ts # Pattern/sequence playback
│       └── patterns.ts   # Musical patterns library
├── public/               # Static assets
└── package.json
```

## Roadmap

- [x] Phase 1: Voice Agent MVP with Orb UI
- [x] Phase 2: Piano Keyboard + Audio
- [x] Phase 3: MIDI Capture + Hardware Input
- [x] Phase 4: Agent Tools (playNote, playSequence)
- [ ] Phase 5: User Playing Analysis & Feedback
- [ ] Phase 6: Full Lesson Loop with Evaluation

## Hackathon Submission

This project is submitted to the **ElevenLabs Challenge** of the Google Cloud AI Partner Catalyst Hackathon.

**Requirements Met:**
- ElevenLabs Agents Platform integration
- Google Cloud Gemini as LLM
- Voice-first, conversational UX
- MIT License (OSI-approved)
- Hosted on Google Cloud

## License

[MIT](LICENSE)

## Acknowledgments

- [ElevenLabs](https://elevenlabs.io) for the Conversational AI platform
- [Google Cloud](https://cloud.google.com) for Gemini and hosting
- [smplr](https://github.com/danigb/smplr) for the SplendidGrandPiano sampler
- [Tonal](https://github.com/tonaljs/tonal) for music theory utilities
- [JamieOnKeys](https://www.jamieonkeys.dev) for piano keyboard inspiration
