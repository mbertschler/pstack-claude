import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mergeSafety = readFileSync(new URL('../plugins/pstack/skills/poteto-mode/references/merge-safety.md', import.meta.url), 'utf8');
const blocks = [...mergeSafety.matchAll(/^```sh\n([\s\S]*?)^```$/gm)].map((m) => m[1]);
const landedCheck = blocks.find((block) => block.includes('merge-base --is-ancestor'));
const leasePush = blocks.find((block) => block.includes('--force-with-lease'));
if (!landedCheck || !leasePush) throw new Error('merge-safety.md lacks its landed-parent check or lease push');

const run = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const runBlock = (block, cwd, vars) => spawnSync('sh', ['-e', '-c', block], {
  cwd, encoding: 'utf8', env: { ...process.env, ...vars },
});
function fixture(body) {
  const root = mkdtempSync(join(tmpdir(), 'pstack-shipping-'));
  try {
    run(root, 'init', '-b', 'main');
    run(root, 'config', 'user.email', 'fixture@example.invalid');
    run(root, 'config', 'user.name', 'Fixture');
    const commit = (file, content) => {
      writeFileSync(join(root, file), content);
      run(root, 'add', file);
      run(root, 'commit', '-m', `Update ${file}`);
      return run(root, 'rev-parse', 'HEAD');
    };
    commit('base.txt', 'base\n');
    body(root, commit);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('after a parent merge commit, the child diff against trunk is only child work', () => fixture((root, commit) => {
  run(root, 'checkout', '-b', 'parent');
  commit('parent.txt', 'first\n');
  const parentHead = commit('parent.txt', 'parent final\n');
  run(root, 'checkout', '-b', 'child');
  const childHead = commit('child.txt', 'child only\n');
  run(root, 'checkout', 'main');
  run(root, 'merge', '--no-ff', '-m', 'Merge parent', 'parent');
  const trunk = run(root, 'rev-parse', 'HEAD');
  const check = runBlock(landedCheck, root, { parent_head: parentHead, trunk_tip: trunk, child: 'child' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(check.stdout.trim(), 'child.txt');
  assert.equal(run(root, 'rev-parse', 'child'), childHead);
}));

test('explicit pre-rewrite lease refuses concurrent work even after a background fetch', () => fixture((root, commit) => {
  const remote = join(root, 'remote.git');
  run(root, 'init', '--bare', remote);
  run(root, 'remote', 'add', 'origin', remote);
  run(root, 'checkout', '-b', 'child');
  const captured = commit('child.txt', 'original\n');
  run(root, 'push', 'origin', 'child');
  const concurrent = commit('concurrent.txt', 'someone else\n');
  run(root, 'push', 'origin', 'child');
  run(root, 'reset', '--hard', captured);
  commit('child.txt', 'rewritten\n');
  run(root, 'fetch', 'origin');
  const push = runBlock(leasePush, root, { child: 'child', captured_remote_head: captured });
  assert.notEqual(push.status, 0);
  assert.match(push.stderr, /stale info/);
  assert.equal(run(root, 'ls-remote', 'origin', 'refs/heads/child').split(/\s/)[0], concurrent);
}));
