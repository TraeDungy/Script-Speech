'use client';

import { useState } from 'react';
import { Check, Zap, Crown, Building2, Loader2 } from 'lucide-react';

interface PricingTier {
  name: string;
  price: number;
  credits: number;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
  tier: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Creator',
    tier: 'creator',
    price: 10,
    credits: 10000,
    features: [
      '10,000 characters/month',
      '24 premium voices',
      'MP3 download',
      'Standard support',
      'No API access',
    ],
    icon: <Zap className="w-6 h-6" />,
  },
  {
    name: 'Pro',
    tier: 'pro',
    price: 50,
    credits: 50000,
    features: [
      '50,000 characters/month',
      'All 24+ voices',
      'Multiple formats (MP3, WAV, M4A)',
      'Priority support',
      'API access included',
      'Commercial license',
    ],
    icon: <Crown className="w-6 h-6" />,
    popular: true,
  },
  {
    name: 'Agency',
    tier: 'agency',
    price: 500,
    credits: -1,
    features: [
      'Unlimited characters',
      'All voices + custom training',
      'All formats + Studio Quality',
      'Dedicated support',
      'Full API access',
      'White-label option',
      'Custom voice cloning',
    ],
    icon: <Building2 className="w-6 h-6" />,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const subscribe = async (tier: string) => {
    setLoading(tier);
    try {
      const email = prompt('Enter your email to subscribe:');
      if (!email) { setLoading(null); return; }

      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            Simple Pricing
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Choose the plan that fits your voiceover needs. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-2xl p-8 border ${
                t.popular
                  ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-500/50 scale-105'
                  : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              {t.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className={`inline-flex p-3 rounded-xl mb-4 ${
                  t.popular ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  {t.icon}
                </div>
                <h3 className="text-2xl font-bold">{t.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">${t.price}</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="mt-2 text-emerald-400 font-medium">
                  {t.credits === -1 ? 'Unlimited' : t.credits.toLocaleString()} characters
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {t.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(t.tier)}
                disabled={loading === t.tier}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  t.popular
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === t.tier ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                  `Get ${t.name}`
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center text-slate-500">
          <p>Need a custom plan? Contact us at sales@script-speech.com</p>
          <p className="mt-2">30-day money-back guarantee. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}
