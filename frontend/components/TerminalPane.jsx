'use client';
import { useEffect, useRef } from 'react';
import { wsBase } from '@/lib/api';
import 'xterm/css/xterm.css';

export default function TerminalPane({ projectId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let resizeObs;

    (async () => {
      const { Terminal } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        theme: {
          background: '#0a0a0b',
          foreground: '#d4d4d8',
          cursor: '#7c5cff',
          selectionBackground: '#33335a',
        },
        scrollback: 5000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      try { fit.fit(); } catch {}
      termRef.current = term;
      fitRef.current = fit;

      const ws = new WebSocket(`${wsBase()}/ws/pty?project=${encodeURIComponent(projectId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const send = () => {
          try { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); } catch {}
        };
        send();
      };
      ws.onmessage = (ev) => term.write(typeof ev.data === 'string' ? ev.data : '');
      ws.onclose = () => { try { term.write('\r\n\x1b[90m[terminal disconnected]\x1b[0m\r\n'); } catch {} };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'data', data }));
      });

      const doFit = () => {
        try {
          fit.fit();
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        } catch {}
      };
      resizeObs = new ResizeObserver(doFit);
      resizeObs.observe(containerRef.current);
      setTimeout(doFit, 60);
    })();

    return () => {
      disposed = true;
      try { resizeObs && resizeObs.disconnect(); } catch {}
      try { wsRef.current && wsRef.current.close(); } catch {}
      try { termRef.current && termRef.current.dispose(); } catch {}
    };
  }, [projectId]);

  return <div ref={containerRef} className="h-full w-full bg-ink-950 overflow-hidden" />;
}
