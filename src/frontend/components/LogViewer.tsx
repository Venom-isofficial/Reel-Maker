import React, { useEffect, useRef } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

interface LogViewerProps {
  logs: string[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Terminal className="w-4 h-4 text-cyan-400" />
          Execution Log (`execution.log`)
        </div>
        <button
          onClick={copyLogs}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 bg-slate-950/90 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-y-auto space-y-1.5 border border-slate-800/80 min-h-[220px] max-h-[350px]"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No logs available yet. Start pipeline to stream events...</div>
        ) : (
          logs.map((log, idx) => {
            let color = 'text-slate-300';
            if (log.includes('[ERROR]')) color = 'text-rose-400 font-bold';
            if (log.includes('[WARN]')) color = 'text-amber-300';
            if (log.includes('🎉') || log.includes('Success')) color = 'text-emerald-400 font-semibold';
            if (log.includes('Step') || log.includes('Starting')) color = 'text-cyan-300 font-semibold';

            return (
              <div key={idx} className={`leading-relaxed ${color}`}>
                {log}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
