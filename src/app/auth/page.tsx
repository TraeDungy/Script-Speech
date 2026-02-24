'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        alert('Check your email to confirm your account!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        maxWidth: '400px',
        width: '100%',
      }}>
        <h1 style={{ marginTop: 0, color: '#333', textAlign: 'center' }}>
          Script-Speech
        </h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </p>

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '20px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c00',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px',
              fontFamily: 'inherit',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
          📧 Test Email: test@example.com<br />
          🔑 Test Password: TestPassword123!
        </p>
      </div>
    </div>
  );
}
