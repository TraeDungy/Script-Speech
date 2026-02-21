'use client';

import { useState, useEffect } from 'react';

interface Voice {
  id: string;
  name: string;
}

export default function TTSPage() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('adam');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  // Load voices on mount
  useEffect(() => {
    fetch('/api/tts/generate')
      .then(res => res.json())
      .then(data => setVoices(data.voices || []))
      .catch(console.error);
  }, []);

  const generateAudio = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // Convert base64 to blob
      const byteCharacters = atob(data.audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      
      setAudioUrl(URL.createObjectURL(blob));
      setCharCount(data.characterCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Script-Speech TTS
        </h1>
        <p className="text-slate-400 mb-8">Transform your scripts into professional voiceovers</p>

        <div className="space-y-6">
          {/* Text Input */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <label className="block text-sm font-medium mb-2 text-slate-300">
              Your Script
            </label>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCharCount(e.target.value.length);
              }}
              placeholder="Paste your script here..."
              className="w-full h-40 bg-slate-900 rounded-lg p-4 border border-slate-700 focus:border-blue-500 focus:outline-none resize-none"
              maxLength={5000}
            />
            <div className="flex justify-between text-sm text-slate-500 mt-2">
              <span>{charCount}/5000 characters</span>
              <span>{Math.ceil(charCount / 150)} words (est.)</span>
            </div>
          </div>

          {/* Voice Selection */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <label className="block text-sm font-medium mb-3 text-slate-300">
              Voice
            </label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-slate-900 rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 focus:outline-none w-full"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateAudio}
            disabled={loading || !text.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Audio...
              </span>
            ) : (
              'Generate Voiceover'
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Audio Player */}
          {audioUrl && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="font-semibold mb-4 text-emerald-400">✅ Audio Generated!</h3>
              <audio controls className="w-full" src={audioUrl}>
                Your browser does not support the audio element.
              </audio>
              <div className="flex gap-3 mt-4">
                <a
                  href={audioUrl}
                  download="voiceover.mp3"
                  className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-center py-2 rounded-lg transition-colors"
                >
                  Download MP3
                </a>
                <button
                  onClick={() => {
                    setAudioUrl(null);
                    setText('');
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors"
                >
                  New Script
                </button>
              </div>
            </div>
          )}

          {/* Pricing Hint */}
          <div className="text-center text-slate-500 text-sm">
            <p>Free tier: 1,000 chars/generation</p>
            <p>Upgrade for unlimited generations</p>
          </div>
        </div>
      </div>
    </div>
  );
}