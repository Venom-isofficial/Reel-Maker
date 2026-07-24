import React, { useState, useEffect } from 'react';
import { FileCode, Save, CheckCircle2 } from 'lucide-react';

const PROMPT_LIST = [
  { id: 'analysis', label: 'Article Analysis (analysis.md)' },
  { id: 'script', label: 'Script Writing (script.md)' },
  { id: 'scene_planner', label: 'Scene Planning (scene_planner.md)' },
  { id: 'metadata', label: 'Video Metadata (metadata.md)' },
  { id: 'thumbnail', label: 'Thumbnail Visual (thumbnail.md)' },
];

export const PromptManager: React.FC = () => {
  const [selectedPrompt, setSelectedPrompt] = useState('analysis');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/prompts/${selectedPrompt}`)
      .then((res) => res.json())
      .then((data) => setContent(data.content || ''))
      .catch((err) => console.error('Error fetching prompt:', err));
  }, [selectedPrompt]);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/prompts/${selectedPrompt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Error saving prompt:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-indigo-400" />
              Dynamic Prompt Management Studio
            </h2>
            <p className="text-xs text-slate-400 mt-1">Prompts are loaded dynamically from `prompts/*.md`. Edit templates without touching code.</p>
          </div>
          {saved && (
            <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Template Saved!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Sidebar Prompt Select */}
          <div className="md:col-span-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Template</h3>
            {PROMPT_LIST.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedPrompt(item.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-xs transition ${
                  selectedPrompt === item.id
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-semibold'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Prompt Editor */}
          <div className="md:col-span-8 flex flex-col">
            <label className="text-xs font-medium text-slate-300 mb-2">Prompt Template Markdown (`prompts/${selectedPrompt}.md`)</label>
            <textarea
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 mb-4 leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="glow-button px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
