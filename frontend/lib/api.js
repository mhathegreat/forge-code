// Client API helpers. The backend lives on the same host, port 4000.
export function apiBase() {
  if (typeof window === 'undefined') return '';
  return `http://${window.location.hostname}:4000`;
}
export function wsBase() {
  if (typeof window === 'undefined') return '';
  return `ws://${window.location.hostname}:4000`;
}

async function req(path, opts = {}) {
  const res = await fetch(apiBase() + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

const enc = encodeURIComponent;

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req('/api/logout', { method: 'POST' }),

  projects: () => req('/api/projects'),
  createProject: (body) => req('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  deleteProject: (id) => req('/api/projects/' + enc(id), { method: 'DELETE' }),

  meta: (id) => req(`/api/projects/${enc(id)}/meta`),
  tree: (id) => req(`/api/projects/${enc(id)}/tree`),
  file: (id, path) => req(`/api/projects/${enc(id)}/file?path=${enc(path)}`),
  saveFile: (id, path, content) =>
    req(`/api/projects/${enc(id)}/file`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
  chat: (id) => req(`/api/projects/${enc(id)}/chat`),
  previewUrl: (id) => `${apiBase()}/preview/${enc(id)}/index.html`,
};

// Map a filename to a Monaco language id.
export function langForPath(p = '') {
  const ext = p.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    md: 'markdown', markdown: 'markdown',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', c: 'c', h: 'c',
    cpp: 'cpp', cc: 'cpp', cs: 'csharp', php: 'php', sh: 'shell', bash: 'shell',
    yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', sql: 'sql', xml: 'xml',
    vue: 'html', svelte: 'html', dockerfile: 'dockerfile',
  };
  if (p.toLowerCase().endsWith('dockerfile')) return 'dockerfile';
  return map[ext] || 'plaintext';
}
