'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState('elevenlabs');
  const [selectedVoice, setSelectedVoice] = useState('adam');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClientComponentClient();

    // Check authentication
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setUser(user);

      // Fetch TTS providers
      fetch('/api/tts/settings')
        .then(res => res.json())
        .then(data => {
          setProviders(data.providers);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load providers:', err);
          setLoading(false);
        });
    });
  }, [router]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value;
    setSelectedProvider(provider);
    // Reset voice to first available voice
    if (providers?.[provider]?.voices?.[0]) {
      setSelectedVoice(providers[provider].voices[0].id);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoice(e.target.value);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/tts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          voice: selectedVoice,
        }),
      });

      if (res.ok) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <p>Loading settings...</p>
      </div>
    );
  }

  const currentProvider = providers?.[selectedProvider];
  const currentVoices = currentProvider?.voices || [];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: 'white',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>Settings</h1>
            <p style={{ margin: '5px 0 0', opacity: 0.8 }}>{user?.email}</p>
          </div>
          <a href="/dashboard" style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px',
            color: 'white',
            textDecoration: 'none',
            cursor: 'pointer',
          }}>
            ← Back to Dashboard
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <h2>Voice & TTS Settings</h2>

        {/* Provider Selection */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '30px',
          backdropFilter: 'blur(10px)',
          marginBottom: '30px',
        }}>
          <h3 style={{ marginTop: 0 }}>Select Voice Provider</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            {Object.entries(providers || {}).map(([key, provider]: any) => (
              <div
                key={key}
                onClick={() => setSelectedProvider(key)}
                style={{
                  background: selectedProvider === key ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: selectedProvider === key ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = selectedProvider === key ? 'rgba(102, 126, 234, 0.3)' : 'rgba(255,255,255,0.05)';
                }}
              >
                <h4 style={{ margin: '0 0 10px' }}>
                  {provider.name}
                  {provider.status === 'active' && <span style={{ fontSize: '12px', marginLeft: '10px', background: '#4ade80', padding: '3px 8px', borderRadius: '4px' }}>ACTIVE</span>}
                  {provider.status === 'planned' && <span style={{ fontSize: '12px', marginLeft: '10px', background: '#f59e0b', padding: '3px 8px', borderRadius: '4px' }}>COMING SOON</span>}
                </h4>
                <p style={{ margin: '0 0 10px', opacity: 0.8, fontSize: '14px' }}>{provider.description}</p>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  <div>💬 {provider.languages} languages</div>
                  <div>🎤 {provider.voices.length} voices</div>
                  {provider.pricing === 'free' && <div style={{ color: '#4ade80', fontWeight: 'bold' }}>💰 FREE</div>}
                  {provider.pricing !== 'free' && <div>💰 ${provider.costPer1MChars}/1M chars</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Voice Selection */}
          {currentProvider?.status === 'active' && (
            <div>
              <h3>Select Voice</h3>
              <select
                value={selectedVoice}
                onChange={handleVoiceChange}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '16px',
                  marginBottom: '20px',
                }}
              >
                {currentVoices.map((voice: any) => (
                  <option key={voice.id} value={voice.id} style={{ background: '#333' }}>
                    {voice.name} ({voice.gender}) - {voice.accent}
                  </option>
                ))}
              </select>

              {/* Voice Preview */}
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '6px',
                padding: '20px',
                marginBottom: '20px',
              }}>
                <h4 style={{ margin: '0 0 15px' }}>Preview</h4>
                <p>Text: "Welcome to Script-Speech, your AI voice generation platform."</p>
                <button
                  style={{
                    padding: '10px 20px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                  onClick={() => alert('Voice preview feature coming soon!')}
                >
                  🔊 Play Preview
                </button>
              </div>
            </div>
          )}

          {currentProvider?.status === 'planned' && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              padding: '20px',
            }}>
              <p>✨ This provider is coming soon! We're integrating {currentProvider.name} for more voice options.</p>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            disabled={saving || currentProvider?.status !== 'active'}
            style={{
              padding: '12px 30px',
              background: currentProvider?.status === 'active' ? '#667eea' : '#999',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: currentProvider?.status === 'active' ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 'bold',
              marginTop: '20px',
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Provider Comparison */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '30px',
          backdropFilter: 'blur(10px)',
        }}>
          <h3 style={{ marginTop: 0 }}>Provider Comparison</h3>
          
          <div style={{
            overflowX: 'auto',
            marginTop: '20px',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold' }}>Provider</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold' }}>Pricing</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold' }}>Languages</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontWeight: 'bold' }}>Voices</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(providers || {}).map(([key, provider]: any) => (
                  <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '12px' }}>{provider.name}</td>
                    <td style={{ padding: '12px' }}>
                      {provider.status === 'active' && <span style={{ background: '#4ade80', padding: '3px 8px', borderRadius: '4px' }}>Active</span>}
                      {provider.status === 'planned' && <span style={{ background: '#f59e0b', padding: '3px 8px', borderRadius: '4px' }}>Coming Soon</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {provider.pricing === 'free' && '🎉 Free'}
                      {provider.pricing === 'character-based' && `$${provider.costPer1MChars}/1M`}
                      {provider.pricing === 'token-based' && `$${provider.costPer1MTokens}/1M`}
                    </td>
                    <td style={{ padding: '12px' }}>{provider.languages}</td>
                    <td style={{ padding: '12px' }}>{provider.voices.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
