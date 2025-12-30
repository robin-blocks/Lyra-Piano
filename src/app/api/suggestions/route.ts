import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are helping generate practice suggestions for a piano learning app called Lyra.

The app can teach:
- Chords (major, minor, 7ths, inversions, etc.)
- Scales (major, minor, pentatonic, etc.)
- Simple songs and melodies
- Music theory concepts

Based on the conversation context, generate exactly 3 follow-up suggestions that build on what was just learned.
Each suggestion should help the user extend their knowledge in a natural way.

Return ONLY a valid JSON array with this exact format, no other text:
[
  {"title": "Short Title (2-4 words)", "prompt": "Full prompt the user could say (1 sentence)"},
  {"title": "Short Title (2-4 words)", "prompt": "Full prompt the user could say (1 sentence)"},
  {"title": "Short Title (2-4 words)", "prompt": "Full prompt the user could say (1 sentence)"}
]

Focus on: inversions, adding 7ths/extensions, transposition to different keys, related chords/scales,
arpeggios, combining concepts, or practicing what was learned.

Examples of good titles: "Add a Seventh", "Try an Inversion", "Change the Key", "Play it Faster", "Learn the Relative Minor"`

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google AI API key not configured' },
        { status: 500 }
      )
    }

    const { conversationContext } = await request.json()

    if (!conversationContext || !Array.isArray(conversationContext)) {
      return NextResponse.json(
        { error: 'conversationContext must be an array of strings' },
        { status: 400 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const contextText = conversationContext.slice(-10).join('\n') // Last 10 messages max

    const prompt = `${SYSTEM_PROMPT}

The user just had this conversation with their AI piano teacher:
${contextText}

Generate 3 follow-up suggestions:`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Parse the JSON response
    // Handle potential markdown code blocks
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    jsonText = jsonText.trim()

    const suggestions = JSON.parse(jsonText)

    // Validate the response structure
    if (!Array.isArray(suggestions) || suggestions.length !== 3) {
      throw new Error('Invalid response format from Gemini')
    }

    for (const suggestion of suggestions) {
      if (!suggestion.title || !suggestion.prompt) {
        throw new Error('Invalid suggestion format')
      }
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
