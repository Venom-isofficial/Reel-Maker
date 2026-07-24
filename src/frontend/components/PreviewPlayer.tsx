import React, { useState } from 'react';
import { Film, FileText, Download, CheckCircle2, Folder, ExternalLink } from 'lucide-react';

interface PreviewPlayerProps {
  runId?: string;
  files?: string[];
  hasRender?: boolean;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({ runId, files = [], hasRender }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  const fetchFileContent = async (filePath: string) => {
    if (!runId) return;
    setSelectedFile(filePath);
    try {
      const res = await fetch(`/api/runs/${runId}/file/${filePath}`);
      if (filePath.endsWith('.json') || filePath.endsWith('.log') || filePath.endsWith('.md')) {
        const text = await res.text();
        setFileContent(text);
      } else {
        setFileContent(null);
      }
    } catch (err) {
      console.error('Failed fetching file content:', err);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Film className="w-5 h-5 text-cyan-400" />
          Run Preview & Files ({runId || 'No active run'})
        </h2>
        {runId && (
          <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full">
            workspace/{runId}/
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Video Preview Canvas */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/90 rounded-2xl p-4 border border-slate-800">
          {runId && hasRender ? (
            <div className="w-full max-w-[280px] aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border border-cyan-500/30 relative group">
              <video
                controls
                className="w-full h-full object-cover"
                src={`/api/runs/${runId}/file/render/final.mp4`}
              />
            </div>
          ) : (
            <div className="w-full max-w-[280px] aspect-[9/16] rounded-xl border border-dashed border-slate-800 bg-slate-900/40 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <Film className="w-12 h-12 mb-3 text-slate-600" />
              <p className="text-xs font-medium">Final rendered Reel video (`render/final.mp4`) will appear here upon completion.</p>
            </div>
          )}
        </div>

        {/* File Browser & Viewer */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-amber-400" />
              Workspace Run Artifacts
            </h3>
            <div className="flex flex-wrap gap-2 mb-3 max-h-[140px] overflow-y-auto p-2 bg-slate-950/50 rounded-xl border border-slate-800/80">
              {files.length === 0 ? (
                <span className="text-xs text-slate-500">No artifacts found in run directory.</span>
              ) : (
                files.map((file) => (
                  <button
                    key={file}
                    onClick={() => fetchFileContent(file)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                      selectedFile === file
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {file}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected File Content Viewer */}
          <div className="flex-1 bg-slate-950/90 rounded-xl p-4 border border-slate-800 font-mono text-xs overflow-auto max-h-[240px]">
            {selectedFile ? (
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                  <span>{selectedFile}</span>
                  <a
                    href={`/api/runs/${runId}/file/${selectedFile}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Raw
                  </a>
                </div>
                {fileContent !== null ? (
                  <pre className="text-slate-300 whitespace-pre-wrap">{fileContent}</pre>
                ) : (
                  <span className="text-slate-500 italic">Binary or media file. Click Raw to view/download.</span>
                )}
              </div>
            ) : (
              <span className="text-slate-600 italic">Select an artifact file above to view contents.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
