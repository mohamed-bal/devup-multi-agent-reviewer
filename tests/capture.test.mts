import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { capture } from '../src/capture.mts';

test('capture reads committed blobs, ignores dirty files, and supports additions/deletions', () => {
  const repo = mkdtempSync(join(tmpdir(), 'devup-review-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  try {
    git('init', '-q'); git('config', 'user.name', 'Local Test'); git('config', 'user.email', 'test@example.invalid');
    mkdirSync(join(repo, 'src')); writeFileSync(join(repo, 'src/a.mjs'), 'export const n = 1;\n');
    writeFileSync(join(repo, 'src/deleted.mjs'), 'export const old = true;\n');
    git('add', '.'); git('commit', '-qm', 'base'); const base = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, 'src/a.mjs'), 'export const n = 2;\n');
    rmSync(join(repo, 'src/deleted.mjs')); writeFileSync(join(repo, 'src/added.mjs'), 'export const added = true;\n');
    git('add', '.'); git('commit', '-qm', 'head'); const head = git('rev-parse', 'HEAD');
    writeFileSync(join(repo, 'src/a.mjs'), 'dirty working tree\n');
    const snapshot = capture(repo, base, head, ['src/a.mjs', 'src/added.mjs', 'src/deleted.mjs']);
    assert.equal(snapshot.files[0].after, 'export const n = 2;\n');
    assert.equal(snapshot.files[1].before, null); assert.equal(snapshot.files[2].after, null);
    assert.equal(snapshot.base, base); assert.equal(snapshot.head, head);
    symlinkSync('a.mjs', join(repo, 'src/link.mjs')); git('add', '.'); git('commit', '-qm', 'symlink');
    assert.throws(() => capture(repo, head, 'HEAD', ['src/link.mjs']), /REGULAR_BLOB_REQUIRED/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
