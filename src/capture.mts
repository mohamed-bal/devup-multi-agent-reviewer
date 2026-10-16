import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LIMITS, check, validPath, loadSnapshot } from './core.mts';
import type { Snapshot } from './core.mts';

export function capture(repo: string, baseRef: string, headRef: string, paths: string[]): Snapshot {
  check(paths.length > 0 && paths.length <= LIMITS.files && paths.every(validPath), 'INVALID_EXPLICIT_PATHS');
  const git = (args: string[], maxBuffer = 64_000): Buffer => execFileSync('git', [
    '--no-pager', '-c', 'core.fsmonitor=false', ...args,
  ], { cwd: resolve(repo), maxBuffer, timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] });
  const commit = (ref: string) => {
    check(ref.length > 0 && ref.length <= 200 && !/[\x00-\x1f\x7f]/.test(ref), 'INVALID_REF');
    const sha = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).toString().trim();
    check(/^[a-f0-9]{40}$/.test(sha), 'SHA1_REPOSITORY_REQUIRED'); return sha;
  };
  const base = commit(baseRef), head = commit(headRef);
  const blob = (sha: string, path: string): string | null => {
    const entry = git(['ls-tree', '-z', sha, '--', path]).toString('utf8');
    if (!entry) return null;
    check(/^(?:100644|100755) blob [a-f0-9]{40}\t/.test(entry), 'REGULAR_BLOB_REQUIRED');
    const size = Number(git(['cat-file', '-s', `${sha}:${path}`]).toString().trim());
    check(Number.isInteger(size) && size <= LIMITS.fileChars, 'FILE_TOO_LARGE');
    return new TextDecoder('utf-8', { fatal: true }).decode(git(['show', `${sha}:${path}`]));
  };
  return loadSnapshot({ version: 1, source: 'git-commits', base, head,
    files: paths.map(path => ({ path, before: blob(base, path), after: blob(head, path),
      diff: new TextDecoder('utf-8', { fatal: true }).decode(git([
        'diff', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames', '--unified=3',
        base, head, '--', path,
      ])),
    })),
  });
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const [repo, base, head, output, ...paths] = process.argv.slice(2);
  check(repo && base && head && output, 'Usage: npm run capture -- REPO BASE HEAD snapshot.json PATH [PATH...]');
  const snapshot = capture(repo, base, head, paths);
  writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  console.log(`Captured ${snapshot.files.length} explicit paths. Inspect ${output} before any live review.`);
}
