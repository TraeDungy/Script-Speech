'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Demo mode: show dashboard without auth if Supabase not configured
  const hasSupabaseConfig = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    // Demo mode: skip auth check
    if (!hasSupabaseConfig) {
      setUser({ email: 'demo@example.com', id: 'demo-user' });
      setLoading(false);
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth');
      } else {
        setUser(user);
        setLoading(false);
      }
    });
  }, [router, hasSupabaseConfig]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <p>Loading...</p>
      </div>
    );
  }

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
            <h1 style={{ margin: 0 }}>Script-Speech</h1>
            <p style={{ margin: '5px 0 0', opacity: 0.8 }}>Welcome, {user?.email}</p>
          </div>
          <a href="/settings" style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px',
            color: 'white',
            textDecoration: 'none',
            cursor: 'pointer',
          }}>
            ⚙️ Settings
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <h2>Generate AI Voiceovers</h2>
        <p style={{ fontSize: '16px', opacity: 0.9, marginBottom: '30px' }}>
          Convert your text into natural-sounding speech with 50+ AI voices.
        </p>

        {/* Feature Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '40px',
        }}>
          <FeatureCard
            icon="🎤"
            title="50+ Voices"
            description="Choose from multiple languages and voice styles"
          />
          <FeatureCard
            icon="⚡"
            title="Instant"
            description="Generate voiceovers in seconds"
          />
          <FeatureCard
            icon="💼"
            title="Commercial"
            description="Use for commercial projects with included license"
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '30px',
          backdropFilter: 'blur(10px)',
        }}>
          <h3 style={{ marginTop: 0 }}>Get Started</h3>
          
          <div style={{
            display: 'flex',
            gap: '15px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}>
            <QuickActionButton
              href="/studio"
              label="📝 Create Script"
              description="Write and edit your script"
            />
            <QuickActionButton
              href="/voiceover"
              label="🎯 Generate Voiceover"
              description="Convert text to speech"
            />
            <QuickActionButton
              href="/pricing"
              label="💳 View Pricing"
              description="Check subscription plans"
            />
          </div>

          {/* API Info */}
          <div style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h4 style={{ marginTop: 0 }}>Using the API?</h4>
            <p style={{ opacity: 0.9 }}>
              Access our REST API to generate voiceovers programmatically.
            </p>
            <code style={{
              background: 'rgba(0,0,0,0.2)',
              padding: '10px',
              borderRadius: '6px',
              display: 'block',
              fontSize: '12px',
              marginTop: '10px',
              overflowX: 'auto',
            }}>
              POST /api/tts/generate
            </code>
          </div>
        </div>

        {/* Pricing Summary */}
        <div style={{ marginTop: '40px' }}>
          <h3>Simple Pricing</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
          }}>
            <PricingCard
              tier="Creator"
              price="$10/mo"
              characters="10,000"
              description="Perfect for YouTubers and podcasters"
            />
            <PricingCard
              tier="Pro"
              price="$50/mo"
              characters="100,000"
              description="For growing creators and teams"
            />
            <PricingCard
              tier="Agency"
              price="Custom"
              characters="1M+"
              description="Enterprise solutions"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '20px',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
      <h4 style={{ margin: '0 0 8px' }}>{title}</h4>
      <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>{description}</p>
    </div>
  );
}

function QuickActionButton({ href, label, description }: any) {
  return (
    <a
      href={href}
      style={{
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '8px',
        padding: '15px 20px',
        textDecoration: 'none',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        flex: 1,
        minWidth: '200px',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
      }}
    >
      <strong>{label}</strong>
      <small style={{ opacity: 0.7 }}>{description}</small>
    </a>
  );
}

function PricingCard({ tier, price, characters, description }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '20px',
      backdropFilter: 'blur(10px)',
    }}>
      <h4 style={{ margin: '0 0 10px' }}>{tier}</h4>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>
        {price}
      </div>
      <p style={{ margin: '0 0 10px', opacity: 0.8 }}>
        <strong>{characters}</strong> characters/month
      </p>
      <p style={{ margin: 0, fontSize: '14px', opacity: 0.7 }}>{description}</p>
    </div>
  );
}
