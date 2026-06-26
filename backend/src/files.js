'use strict';
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { PROJECTS_ROOT } = require('./config');

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache', '.turbo']);

// Absolute path to a project's directory. projectId is just the folder name.
function projectDir(projectId) {
  return path.join(PROJECTS_ROOT, path.basename(String(projectId || '')));
}

// Resolve a relative path inside a project, refusing anything that escapes it.
function resolveInProject(projectId, relPath) {
  const base = projectDir(projectId);
  const target = path.resolve(base, relPath == null ? '.' : String(relPath));
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('Path escapes project directory: ' + relPath);
  }
  return target;
}

// Recursively build a file tree (dirs first, alphabetical). Ignored dirs are
// listed but not descended into.
async function listTree(projectId) {
  const base = projectDir(projectId);
  async function walk(dir, rel) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => {
      const ad = a.isDirectory(), bd = b.isDirectory();
      if (ad !== bd) return ad ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const out = [];
    for (const e of entries) {
      const childRel = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) {
          out.push({ name: e.name, path: childRel, type: 'dir', children: [], collapsed: true });
        } else {
          out.push({ name: e.name, path: childRel, type: 'dir', children: await walk(path.join(dir, e.name), childRel) });
        }
      } else {
        out.push({ name: e.name, path: childRel, type: 'file' });
      }
    }
    return out;
  }
  return walk(base, '');
}

// Flat list of file paths (for context / search), skipping ignored dirs.
async function listFilePaths(projectId, max = 800) {
  const base = projectDir(projectId);
  const out = [];
  async function walk(dir, rel) {
    if (out.length >= max) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= max) return;
      const childRel = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        await walk(path.join(dir, e.name), childRel);
      } else {
        out.push(childRel);
      }
    }
  }
  await walk(base, '');
  return out;
}

async function readFileText(projectId, relPath) {
  const target = resolveInProject(projectId, relPath);
  return fsp.readFile(target, 'utf8');
}

async function writeFileText(projectId, relPath, content) {
  const target = resolveInProject(projectId, relPath);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, content == null ? '' : String(content), 'utf8');
  return target;
}

function existsSync(projectId, relPath) {
  try { return fs.existsSync(resolveInProject(projectId, relPath)); } catch { return false; }
}

module.exports = {
  PROJECTS_ROOT, IGNORE_DIRS, projectDir, resolveInProject,
  listTree, listFilePaths, readFileText, writeFileText, existsSync,
};
