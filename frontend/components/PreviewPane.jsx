'use client';
import { useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

export default function PreviewPane({ projectId }) {
  const [nonce, setNonce] = useState(Date.now());
  const url = api.previewUrl(projectId) + '?t=' + nonce;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="flex items-center gap-2 bg-ink-900 border-b border-ink-700 px-3 py-1.5">
        <span className="text-xs text-gray-400 flex-1 truncate font-mono">{api.previewUrl(projectId)}</span>
        <button onClick={() => setNonce(Date.now())} className="text-gray-400 hover:text-accent" title="Reload preview">
          <RefreshCw size={14} />
        </button>
        <a href={api.previewUrl(projectId)} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-accent" title="Open in new tab">
          <ExternalLink size={14} />
        </a>
      </div>
      <iframe
        key={nonce}
        src={url}
        title="preview"
        className="flex-1 w-full bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
