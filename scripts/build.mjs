#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const isWin = process.platform === 'win32';
const nextBin = join(repoRoot, 'node_modules', '.bin', isWin ? 'next.cmd' : 'next');

if (existsSync(nextBin)) {
  const result = spawnSync(nextBin, ['build'], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

console.log('[offline-build] `next` binary not found, performing TypeScript syntax check instead.');

let ts;
try {
  ts = await import('typescript');
} catch (error) {
  try {
    const globalRoot = execSync('npm root -g').toString().trim();
    const tsPath = pathToFileURL(join(globalRoot, 'typescript', 'lib', 'typescript.js')).href;
    ts = await import(tsPath);
  } catch (innerError) {
    console.error('[offline-build] Unable to locate the TypeScript compiler.');
    console.error(innerError instanceof Error ? innerError.message : innerError);
    process.exit(1);
  }
}

function gatherSourceFiles(rootDir) {
  const queue = [rootDir];
  const results = [];
  const excluded = new Set(['node_modules', '.git', '.next', 'out']);

  while (queue.length) {
    const current = queue.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        if (!['.eslintrc.json'].includes(entry.name)) {
          // skip hidden directories except specific files
          if (entry.isDirectory()) continue;
        }
      }
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (excluded.has(entry.name)) continue;
        queue.push(fullPath);
      } else if (entry.isFile()) {
        if (fullPath.endsWith('.tsx') || (fullPath.endsWith('.ts') && !fullPath.endsWith('.d.ts'))) {
          results.push(fullPath);
        }
      }
    }
  }

  return results;
}

const sourceFiles = gatherSourceFiles(repoRoot);
const compilerOptions = {
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2019,
  allowJs: false,
};

let hasErrors = false;

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  const result = ts.transpileModule(content, {
    compilerOptions,
    fileName: file,
    reportDiagnostics: true,
  });

  if (result.diagnostics?.length) {
    const errors = result.diagnostics.filter((diag) => diag.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
      hasErrors = true;
      for (const diag of errors) {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        const { line = 0, character = 0 } = diag.file
          ? diag.file.getLineAndCharacterOfPosition(diag.start ?? 0)
          : { line: 0, character: 0 };
        const relativePath = diag.file ? diag.file.fileName.replace(repoRoot + '/', '') : file.replace(repoRoot + '/', '');
        console.error(`${relativePath}:${line + 1}:${character + 1} - error TS${diag.code}: ${message}`);
      }
    }
  }
}

if (hasErrors) {
  console.error('[offline-build] Syntax check failed.');
  process.exit(1);
}

console.log('[offline-build] Syntax check passed.');
