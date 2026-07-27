import React, { useState } from 'react';
import { WizardView } from './components/WizardView';
import { SettingsPage } from './components/SettingsPage';
import { PromptManager } from './components/PromptManager';
import { LayoutDashboard, Settings, FileCode, Clapperboard } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'wizard' | 'prompts' | 'settings'>('wizard');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-cyan-400 to-pink-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Clapperboard className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                AI Reel Factory
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  v2.0 Local
                </span>
              </span>
              <p className="text-[11px] text-slate-400">Desktop-First AI Reel Studio</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('wizard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'wizard'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Create Reel
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'prompts'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Prompts
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={activeTab === 'wizard' ? 'block' : 'hidden'}>
          <WizardView />
        </div>
        <div className={activeTab === 'prompts' ? 'block' : 'hidden'}>
          <PromptManager />
        </div>
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
          <SettingsPage />
        </div>
      </main>
    </div>
  );
}
