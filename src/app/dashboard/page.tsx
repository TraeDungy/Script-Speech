'use client';

import { useState } from 'react';
import { Mic, FileText, CreditCard, Download, Settings } from 'lucide-react';

interface UsageStats {
  charactersUsed: number;
  charactersLimit: number;
  audioFilesGenerated: number;
  subscriptionTier: string;
}

export default function DashboardPage() {
  const [stats] = useState<UsageStats>({
    charactersUsed: 0,
    charactersLimit: 10000,
    audioFilesGenerated: 12,
    subscriptionTier: 'Creator',
  });
  const [recentGenerations] = useState([
    { id: 1, text: 'Welcome to Script-Speech...', voice: 'Adam', date: '2024-02-21', chars: 150 },
    { id: 2, text: 'In this tutorial we will...', voice: 'Bella', date: '2024-02-20', chars: 280 },
    { id: 3, text: 'Today\'s episode covers...', voice: 'Charlie', date: '2024-02-19', chars: 420 },
  ]);

  const usagePercent = Math.round((stats.charactersUsed / stats.charactersLimit) * 100);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-slate-400">Manage your voiceover generations</p>
          </div>
          <a
            href="/tts"
            className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all"
          >
            <Mic className="w-5 h-5" />
            Generate New
          </a>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Usage Card */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Character Usage
              </h3>
              <span className="text-2xl font-bold text-blue-400">
                {usagePercent}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-sm text-slate-400">
              {stats.charactersUsed.toLocaleString()} / {stats.charactersLimit.toLocaleString()} characters used
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {stats.charactersLimit - stats.charactersUsed} remaining this month
            </p>
          </div>

          {/* Tier Card */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Plan
              </h3>
              <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
                {stats.subscriptionTier}
              </span>
            </div>
            <p className="text-3xl font-bold mb-2">
              ${stats.subscriptionTier === 'Creator' ? '10' : stats.subscriptionTier === 'Pro' ? '50' : '500'}
              <span className="text-lg font-normal text-slate-400">/month</span>
            </p>
            <p className="text-sm text-slate-400">
              {stats.charactersLimit.toLocaleString()} characters included
            </p>
            <a
              href="/pricing"
              className="mt-4 inline-block text-emerald-400 hover:text-emerald-300 text-sm font-medium"
            >
              Upgrade plan →
            </a>
          </div>

          {/* Quick Stats */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-400" />
                Total Generated
              </h3>
            </div>
            <p className="text-3xl font-bold text-purple-400">
              {stats.audioFilesGenerated}
            </p>
            <p className="text-sm text-slate-400 mt-2">Audio files created</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
              <span>This week: +5</span>
              <span>This month: +12</span>
            </div>
          </div>
        </div>

        {/* Recent Generations */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-xl font-semibold">Recent Generations</h3>
          </div>
          <div className="divide-y divide-slate-700">
            {recentGenerations.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audio generated yet</p>
                <a href="/tts" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
                  Create your first voiceover →
                </a>
              </div>
            ) : (
              recentGenerations.map((gen) => (
                <div key={gen.id} className="p-6 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 truncate mb-1">&quot;{gen.text}&quot;</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Settings className="w-4 h-4" />
                          {gen.voice}
                        </span>
                        <span>{gen.chars} chars</span>
                        <span>{gen.date}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <a
            href="/pricing"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-6 transition-colors"
          >
            <h4 className="font-semibold mb-2">Need more characters?</h4>
            <p className="text-sm text-slate-400">Upgrade to Pro for 5x more monthly credits</p>
          </a>
          <a
            href="/api/docs"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-6 transition-colors"
          >
            <h4 className="font-semibold mb-2">API Access</h4>
            <p className="text-sm text-slate-400">Integrate voice generation into your workflows</p>
          </a>
        </div>
      </div>
    </div>
  );
}