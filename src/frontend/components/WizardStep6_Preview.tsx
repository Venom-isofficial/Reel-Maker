import React, { useState, useEffect } from 'react';
import { VideoMetadata } from '../../backend/types';
import { PartyPopper, Download, Plus, Edit3, Save, ArrowLeft, Loader2 } from 'lucide-react';

interface Props {
  runId: string;
  finalVideoUrl: string;
  onNewReel: () => void;
  onBack: () => void;
}

export const WizardStep6_Preview: React.FC<Props> = ({ runId, finalVideoUrl, onNewReel, onBack }) => {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedHashtags, setEditedHashtags] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wizard/step6-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (data.success && data.metadata) {
        setMetadata(data.metadata);
        setEditedTitle(data.metadata.title);
        setEditedDescription(data.metadata.description);
        setEditedHashtags(data.metadata.hashtags.join(' '));
      }
    } catch (err: any) {
      console.error('Metadata fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveMetadata = async () => {
    try {
      const updated: VideoMetadata = {
        title: editedTitle,
        description: editedDescription,
        hashtags: editedHashtags.split(/\s+/).filter(Boolean),
        thumbnailText: metadata?.thumbnailText || '',
        suggestedFilename: metadata?.suggestedFilename || 'reel.mp4',
      };
      await fetch('/api/wizard/save-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, field: 'metadata', data: updated }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save metadata error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="glass-panel rounded-3xl p-6 text-center relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <PartyPopper className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-2xl font-extrabold text-white mb-1">Your Reel is Ready!</h2>
          <p className="text-sm text-slate-400">{runId} • Final video rendered successfully</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-5">
          <div className="glass-panel rounded-2xl p-4">
            <div className="aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border border-cyan-500/20 bg-black">
              <video
                controls
                autoPlay
                className="w-full h-full object-cover"
                key={finalVideoUrl}
              >
                <source src={finalVideoUrl} type="video/mp4" />
              </video>
            </div>
            <div className="flex gap-3 mt-4">
              <a
                href={finalVideoUrl}
                download={`${runId}_final.mp4`}
                className="flex-1 glow-button px-4 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download MP4
              </a>
            </div>
          </div>
        </div>

        {/* Metadata Editor */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" /> Video Metadata
              </h3>
              {saved && (
                <span className="text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60">
                  ✓ Saved!
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mr-2" />
                <span className="text-sm text-slate-400">Generating metadata...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Title</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Hashtags (space-separated)</label>
                  <input
                    type="text"
                    value={editedHashtags}
                    onChange={(e) => setEditedHashtags(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={saveMetadata}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40 flex items-center gap-1.5 transition"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Metadata
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800 hover:bg-slate-900/50 flex items-center gap-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={onNewReel}
              className="glow-button px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create New Reel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
