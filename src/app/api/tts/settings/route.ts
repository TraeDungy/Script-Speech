import { NextRequest, NextResponse } from 'next/server';

/**
 * Get available TTS providers and voices
 * This endpoint returns all available voice options including:
 * - ElevenLabs (primary)
 * - NVIDIA (free models)
 * - OpenAI (realtime)
 * - Google Cloud (future)
 * - Amazon Polly (future)
 */

export const dynamic = 'force-dynamic';

const TTS_PROVIDERS = {
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Professional, natural-sounding voices',
    status: 'active',
    pricing: 'character-based',
    costPer1MChars: 0.30,
    languages: 50,
    voices: [
      // Male Voices
      { id: 'adam', name: 'Adam', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'antoni', name: 'Antoni', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'arnold', name: 'Arnold', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'callum', name: 'Callum', gender: 'male', language: 'en-UK', accent: 'british' },
      { id: 'charlie', name: 'Charlie', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'clyde', name: 'Clyde', gender: 'male', language: 'en-US', accent: 'southern' },
      { id: 'daniel', name: 'Daniel', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'dave', name: 'Dave', gender: 'male', language: 'en-US', accent: 'casual' },
      { id: 'dom', name: 'Dom', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'ethan', name: 'Ethan', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'george', name: 'George', gender: 'male', language: 'en-UK', accent: 'british' },
      { id: 'josh', name: 'Josh', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'liam', name: 'Liam', gender: 'male', language: 'en-UK', accent: 'irish' },
      { id: 'michael', name: 'Michael', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'patrick', name: 'Patrick', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'sam', name: 'Sam', gender: 'male', language: 'en-US', accent: 'american' },
      { id: 'thomas', name: 'Thomas', gender: 'male', language: 'en-UK', accent: 'british' },
      // Female Voices
      { id: 'bella', name: 'Bella', gender: 'female', language: 'en-US', accent: 'american' },
      { id: 'ella', name: 'Ella', gender: 'female', language: 'en-UK', accent: 'british' },
      { id: 'glinda', name: 'Glinda', gender: 'female', language: 'en-US', accent: 'american' },
      { id: 'jessica', name: 'Jessica', gender: 'female', language: 'en-US', accent: 'american' },
      { id: 'matilda', name: 'Matilda', gender: 'female', language: 'en-US', accent: 'american' },
      { id: 'rachel', name: 'Rachel', gender: 'female', language: 'en-US', accent: 'american' },
      { id: 'serena', name: 'Serena', gender: 'female', language: 'en-US', accent: 'american' },
    ]
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA',
    description: 'Free high-quality voice models',
    status: 'available',
    pricing: 'free',
    costPer1MChars: 0,
    languages: 20,
    voices: [
      // NVIDIA Orca - Conversational
      { id: 'nvidia-orca-hq', name: 'NVIDIA Orca HQ', gender: 'neutral', language: 'en-US', accent: 'professional' },
      { id: 'nvidia-orca-speed', name: 'NVIDIA Orca Speed', gender: 'neutral', language: 'en-US', accent: 'fast' },
      // NVIDIA FastPitch - Real-time capable
      { id: 'nvidia-fastpitch', name: 'NVIDIA FastPitch', gender: 'neutral', language: 'en-US', accent: 'natural' },
      // NVIDIA Glow-TTS - Lightweight
      { id: 'nvidia-glowtts', name: 'NVIDIA Glow-TTS', gender: 'neutral', language: 'en-US', accent: 'neutral' },
      // NVIDIA HiFi-GAN - High fidelity
      { id: 'nvidia-hifigan-male', name: 'NVIDIA HiFi-GAN Male', gender: 'male', language: 'en-US', accent: 'natural' },
      { id: 'nvidia-hifigan-female', name: 'NVIDIA HiFi-GAN Female', gender: 'female', language: 'en-US', accent: 'natural' },
      // NVIDIA Radiance - Multilingual
      { id: 'nvidia-radiance', name: 'NVIDIA Radiance', gender: 'neutral', language: 'multilingual', accent: 'natural' },
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'Real-time voice API',
    status: 'available',
    pricing: 'token-based',
    costPer1MTokens: 5.0,
    languages: 1,
    voices: [
      { id: 'alloy', name: 'Alloy', gender: 'neutral', language: 'en-US', accent: 'professional' },
      { id: 'echo', name: 'Echo', gender: 'male', language: 'en-US', accent: 'smooth' },
      { id: 'fable', name: 'Fable', gender: 'male', language: 'en-US', accent: 'storyteller' },
      { id: 'onyx', name: 'Onyx', gender: 'male', language: 'en-US', accent: 'deep' },
      { id: 'nova', name: 'Nova', gender: 'female', language: 'en-US', accent: 'clear' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female', language: 'en-US', accent: 'bright' },
    ]
  },
  google: {
    id: 'google',
    name: 'Google Cloud',
    description: 'Cloud-based voice synthesis (coming soon)',
    status: 'planned',
    pricing: 'character-based',
    costPer1MChars: 0.16,
    languages: 30,
    voices: []
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon Polly',
    description: 'AWS voice synthesis (coming soon)',
    status: 'planned',
    pricing: 'character-based',
    costPer1MChars: 0.15,
    languages: 30,
    voices: []
  }
};

export async function GET(req: NextRequest) {
  try {
    // Get provider from query params (optional)
    const provider = req.nextUrl.searchParams.get('provider');
    
    if (provider) {
      const providerData = TTS_PROVIDERS[provider as keyof typeof TTS_PROVIDERS];
      if (!providerData) {
        return NextResponse.json(
          { error: `Provider "${provider}" not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(providerData);
    }

    // Return all providers and summary
    return NextResponse.json({
      providers: TTS_PROVIDERS,
      summary: {
        active: Object.values(TTS_PROVIDERS).filter(p => p.status === 'active').length,
        available: Object.values(TTS_PROVIDERS).filter(p => p.status === 'available').length,
        planned: Object.values(TTS_PROVIDERS).filter(p => p.status === 'planned').length,
        totalVoices: Object.values(TTS_PROVIDERS).reduce((sum, p) => sum + p.voices.length, 0),
      }
    });
  } catch (error) {
    console.error('Error fetching TTS settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TTS settings' },
      { status: 500 }
    );
  }
}

/**
 * POST - Update user's preferred TTS provider
 */
export async function POST(req: NextRequest) {
  try {
    const { provider, voice } = await req.json();

    // Validate provider
    if (!provider || !TTS_PROVIDERS[provider as keyof typeof TTS_PROVIDERS]) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const providerData = TTS_PROVIDERS[provider as keyof typeof TTS_PROVIDERS];

    // Validate voice if provider is active
    if (providerData.status === 'active') {
      const voiceExists = providerData.voices.some(v => v.id === voice);
      if (!voiceExists) {
        return NextResponse.json(
          { error: 'Invalid voice for selected provider' },
          { status: 400 }
        );
      }
    }

    // TODO: Save user preference to database
    // await updateUserTTSSettings(userId, { provider, voice });

    return NextResponse.json({
      success: true,
      settings: { provider, voice },
      message: `Switched to ${providerData.name}`
    });
  } catch (error) {
    console.error('Error updating TTS settings:', error);
    return NextResponse.json(
      { error: 'Failed to update TTS settings' },
      { status: 500 }
    );
  }
}
