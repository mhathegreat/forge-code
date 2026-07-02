'use strict';
const fsp = require('fs/promises');
const { exec } = require('child_process');
const { SHELL } = require('./config');
const { projectDir, resolveInProject, readFileText, writeFileText, listFilePaths } = require('./files');

const shellNote = SHELL.kind === 'bash'
  ? 'The shell is bash (POSIX syntax; && works, forward slashes for paths).'
  : 'The shell is PowerShell (use ; to chain commands, NOT &&).';

// ---- Tool schemas (OpenAI/OpenRouter function-calling format) ----
const toolDefs = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full text contents of a file in the current project.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Project-relative path, e.g. "src/index.js"' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given complete contents. Parent folders are created automatically. Always write the entire file, never a diff.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative path' },
          content: { type: 'string', description: 'The complete file contents' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_folder',
      description: 'Create a directory (and any missing parents) in the project.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: `Run a shell command in the project root directory. ${shellNote} Use for npm install, scaffolding, git, builds, etc. Returns combined stdout/stderr and the exit code. Non-interactive only — do not start long-running foreground servers (they will time out).`,
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The shell command to execute' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List the contents of a directory in the project (defaults to the project root).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Project-relative directory, default "."' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file or directory (recursively) in the project.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search the text of all project files for a query string (case-insensitive substring). Returns matching files and line numbers.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
];

function runShell(cwd, command, timeoutMs = 600000) {
  return new Promise((resolve) => {
    exec(command, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 16,
      env: process.env,
      shell: SHELL.shell,
      windowsHide: true,
    }, (err, stdout, stderr) => {
      const code = err && typeof err.code === 'number' ? err.code : err ? 1 : 0;
      let out = '';
      if (stdout) out += stdout;
      if (stderr) out += (out ? '\n' : '') + stderr;
      if (err && err.killed) out += '\n[command timed out]';
      resolve({ code, output: out.trim() });
    });
  });
}

// Execute a tool. emit(event) is available for progress notices.
async function execTool(projectId, name, args = {}, emit = () => {}) {
  const dir = projectDir(projectId);
  switch (name) {
    case 'read_file': {
      try {
        const text = await readFileText(projectId, args.path);
        return text.length > 60000 ? text.slice(0, 60000) + '\n... [truncated]' : text;
      } catch (e) {
        return 'ERROR reading ' + args.path + ': ' + e.message;
      }
    }
    case 'write_file': {
      await writeFileText(projectId, args.path, args.content);
      return `Wrote ${Buffer.byteLength(args.content || '', 'utf8')} bytes to ${args.path}`;
    }
    case 'create_folder': {
      const target = resolveInProject(projectId, args.path);
      await fsp.mkdir(target, { recursive: true });
      return 'Created folder ' + args.path;
    }
    case 'run_command': {
      const { code, output } = await runShell(dir, args.command);
      const clipped = output.length > 12000 ? output.slice(0, 12000) + '\n... [output truncated]' : output;
      return `$ ${args.command}\n[exit ${code}]\n${clipped || '(no output)'}`;
    }
    case 'list_files': {
      const target = resolveInProject(projectId, args.path || '.');
      let entries;
      try { entries = await fsp.readdir(target, { withFileTypes: true }); }
      catch (e) { return 'ERROR listing ' + (args.path || '.') + ': ' + e.message; }
      const lines = entries
        .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
        .map((e) => (e.isDirectory() ? e.name + '/' : e.name));
      return lines.join('\n') || '(empty)';
    }
    case 'delete_file': {
      const target = resolveInProject(projectId, args.path);
      if (target === dir) return 'ERROR: refusing to delete the project root';
      await fsp.rm(target, { recursive: true, force: true });
      return 'Deleted ' + args.path;
    }
    case 'search_files': {
      const q = String(args.query || '').toLowerCase();
      if (!q) return 'ERROR: empty query';
      const files = await listFilePaths(projectId, 1500);
      const hits = [];
      for (const rel of files) {
        let content;
        try { content = await readFileText(projectId, rel); } catch { continue; }
        if (content.length > 500000) continue; // skip huge/binary
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 160)}`);
            if (hits.length >= 100) break;
          }
        }
        if (hits.length >= 100) break;
      }
      return hits.length ? hits.join('\n') : 'No matches for "' + args.query + '"';
    }
    default:
      return 'ERROR: unknown tool ' + name;
  }
}

module.exports = { toolDefs, execTool, runShell };
