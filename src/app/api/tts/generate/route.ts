import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from 'elevenlabs';

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Voice mapping
const VOICES = {
  'adam': 'Adam',
  'antoni': 'Antoni',
  'arnold': 'Arnold',
  'bella': 'Bella',
  'callum': 'Callum',
  'charlie': 'Charlie',
  'clyde': 'Clyde',
  'daniel': 'Daniel',
  'dave': 'Dave',
  'dom': 'Dom',
  'ella': 'Ella',
  'ethan': 'Ethan',
  'george': 'George',
  'glinda': 'Glinda',
  'jessica': 'Jessica',
  'josh': 'Josh',
  'liam': 'Liam',
  'matilda': 'Matilda',
  'michael': 'Michael',
  'patrick': 'Patrick',
  'rachel': 'Rachel',
  'sam': 'Sam',
  'serena': 'Serena',
  'thomas': 'Thomas',
};

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'adam', model = 'eleven_monolingual_v1' } = await req.json();

    // Validation
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 });
    }

    // Generate audio
    const audioStream = await elevenlabs.generate({
      voice: VOICES[voice as keyof typeof VOICES] || 'Adam',
      text: text,
      model_id: model,
    });

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Return audio as base64 for easy frontend consumption
    const base64Audio = audioBuffer.toString('base64');
    
    // Track usage (simple in-memory for MVP - upgrade to DB later)
    const charCount = text.length;
    
    return NextResponse.json({
      success: true,
      audio: base64Audio,
      format: 'mp3',
      characterCount: charCount,
      voice: voice,
    });

  } catch (error) {
    console.error('[TTS Generate Error]:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Get available voices
export async function GET() {
  return NextResponse.json({
    voices: Object.keys(VOICES).map(key => ({
      id: key,
      name: VOICES[key as keyof typeof VOICES],
    })),
    models: [
      { id: 'eleven_monolingual_v1', name: 'Eleven English v1' },
      { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2' },
    ],
  });
}