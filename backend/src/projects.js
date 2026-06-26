'use strict';
const fsp = require('fs/promises');
const path = require('path');
const { PROJECTS_ROOT } = require('./config');
const { projectDir } = require('./files');

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_ ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'project';
}

function agentsTemplate(meta) {
  return `# ${meta.name}

${meta.description ? meta.description + '\n' : ''}
## Project Context

_What this project is and its goals._
${meta.description ? '\n' + meta.description + '\n' : ''}
## Tech Stack

${meta.stack ? '- ' + meta.stack : '_To be determined / auto-detected._'}

## Coding Preferences

- Produce complete, production-ready code — no placeholders or TODOs.
- Prefer modern stacks (Next.js, Tailwind, TypeScript) unless specified otherwise.
- Keep changes focused; match existing style.

## Session Notes

_The agent appends a timestamped summary here at the end of each session:
what was built, current stack, known issues, and next steps._
`;
}

async function ensureRoot() {
  await fsp.mkdir(PROJECTS_ROOT, { recursive: true });
}

// A project is any directory in PROJECTS_ROOT that does NOT start with '_'.
async function listProjects() {
  await ensureRoot();
  const entries = await fsp.readdir(PROJECTS_ROOT, { withFileTypes: true });
  const projects = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('_') || e.name.startsWith('.')) continue;
    let meta = { name: e.name, description: '', stack: '' };
    try {
      meta = { ...meta, ...JSON.parse(await fsp.readFile(path.join(PROJECTS_ROOT, e.name, 'meta.json'), 'utf8')) };
    } catch { /* legacy project without meta.json */ }
    let mtime = 0;
    try { mtime = (await fsp.stat(path.join(PROJECTS_ROOT, e.name))).mtimeMs; } catch {}
    projects.push({ id: e.name, name: meta.name || e.name, description: meta.description || '', stack: meta.stack || '', mtime });
  }
  projects.sort((a, b) => b.mtime - a.mtime);
  return projects;
}

async function createProject({ name, description = '', stack = '' }) {
  await ensureRoot();
  if (!name || !String(name).trim()) throw new Error('Project name is required');
  let id = slugify(name);
  // de-dupe folder name
  const existing = new Set((await fsp.readdir(PROJECTS_ROOT, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name));
  if (existing.has(id)) {
    let n = 2;
    while (existing.has(id + '-' + n)) n++;
    id = id + '-' + n;
  }
  const dir = path.join(PROJECTS_ROOT, id);
  await fsp.mkdir(dir, { recursive: true });
  const meta = { name: String(name).trim(), description: String(description || ''), stack: String(stack || ''), createdAt: new Date().toISOString() };
  await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  await fsp.writeFile(path.join(dir, 'AGENTS.md'), agentsTemplate(meta));
  await fsp.writeFile(path.join(dir, 'chat.json'), '[]');
  return { id, ...meta };
}

async function deleteProject(id) {
  const dir = projectDir(id);
  if (path.basename(dir).startsWith('_')) throw new Error('Refusing to delete a system folder');
  if (path.dirname(dir) !== path.resolve(PROJECTS_ROOT)) throw new Error('Invalid project id');
  await fsp.rm(dir, { recursive: true, force: true });
  return true;
}

async function getMeta(id) {
  try {
    return JSON.parse(await fsp.readFile(path.join(projectDir(id), 'meta.json'), 'utf8'));
  } catch {
    return { name: id, description: '', stack: '' };
  }
}

async function readChat(id) {
  try {
    const raw = await fsp.readFile(path.join(projectDir(id), 'chat.json'), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function appendChat(id, ...messages) {
  const chat = await readChat(id);
  for (const m of messages) chat.push(m);
  await fsp.writeFile(path.join(projectDir(id), 'chat.json'), JSON.stringify(chat, null, 2));
  return chat;
}

module.exports = { slugify, listProjects, createProject, deleteProject, getMeta, readChat, appendChat };
