import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeRevision } from './task-record-store.mjs';
import { observeRemoteRevision, parseExecResult, parseObserverOutput, lsMode, remoteObserverArgv } from './remote-revision.mjs';

const run = promisify(execFile);
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

// Stands in for `hc exec --on <machine>`: runs the observer argv on this host with `env`.
const localExec = env => async ({ argv }) =>
  (await run(argv[0], argv.slice(1), { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } })).stdout;

async function scratchTree() {
  const base = await mkdtemp(join(tmpdir(), 'hc-remote-rev-'));
  const repo = join(base, 'repo');
  await mkdir(repo);
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'test@example.invalid');
  git(repo, 'config', 'user.name', 'test');
  await writeFile(join(repo, 'a.txt'), '1\n');
  await writeFile(join(repo, 'gone.txt'), 'x\n');
  await writeFile(join(repo, 'staged.txt'), 'old\n');
  await writeFile(join(repo, '-dash name.txt'), 'dash\n');
  await mkdir(join(repo, 'dir'));
  await writeFile(join(repo, 'dir', 'run.sh'), '#!/bin/sh\n');
  await symlink('a.txt', join(repo, 'link'));
  await writeFile(join(repo, 'trailing-newline-link-target\n'), 'odd\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'base');
  // Dirty states: unstaged edit, staged edit, deletion, mode change, binary
  // untracked bytes, a newline and Unicode in names, a dangling symlink, a
  // gitlink without its directory, and excluded task evidence.
  await writeFile(join(repo, 'a.txt'), '2\n');
  await writeFile(join(repo, 'staged.txt'), 'new\n');
  git(repo, 'add', 'staged.txt');
  await unlink(join(repo, 'gone.txt'));
  await chmod(join(repo, 'dir', 'run.sh'), 0o755);
  await writeFile(join(repo, 'bin.dat'), Buffer.from([0, 255, 10, 13, 0x80, 0]));
  await writeFile(join(repo, 'new\nline é.txt'), 'nl\n');
  await symlink('missing-target\n', join(repo, 'dangling'));
  git(repo, 'update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},sub`);
  await mkdir(join(repo, '.herdr-tasks', 't1'), { recursive: true });
  await writeFile(join(repo, '.herdr-tasks', 't1', 'report.md'), 'ignored\n');
  return { base, repo };
}

test('the remote observer gives the local digest for the same tree', async () => {
  const { base, repo } = await scratchTree();
  try {
    const local = await observeRevision(repo);
    const remote = await observeRemoteRevision('fixture', repo, { exec: localExec() });
    assert.deepEqual(remote, { machine: 'fixture', checkout: repo, ...local });
    await writeFile(join(repo, '.herdr-tasks', 't1', 'report.md'), 'changed\n');
    assert.equal((await observeRemoteRevision('fixture', repo, { exec: localExec() })).worktreeDigest, local.worktreeDigest, 'task evidence stays outside');
    await writeFile(join(repo, 'bin.dat'), Buffer.from([0, 255, 10, 13, 0x80, 1]));
    const changed = await observeRemoteRevision('fixture', repo, { exec: localExec() });
    assert.notEqual(changed.worktreeDigest, local.worktreeDigest);
    assert.equal(changed.worktreeDigest, (await observeRevision(repo)).worktreeDigest);
  } finally { await rm(base, { recursive: true, force: true }); }
});

// macOS runs BSD tools and bash as sh above. With Homebrew coreutils (and
// findutils and dash, when present), shim them in front of PATH so the usual
// Linux tool path runs too.
const where = tool => { try { return execFileSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const coreutils = ['ls', 'readlink', 'wc', 'cat'];
test('GNU coreutils and dash give the same digest', { skip: !coreutils.every(tool => where(`g${tool}`)) && 'GNU coreutils not installed' }, async () => {
  const { base, repo } = await scratchTree();
  try {
    const shims = join(base, 'gnu-bin');
    await mkdir(shims);
    for (const tool of [...coreutils, ...(where('gxargs') ? ['xargs'] : [])])
      await symlink(where(`g${tool}`), join(shims, tool));
    if (where('dash')) await symlink(where('dash'), join(shims, 'sh'));
    const env = { PATH: `${shims}:${process.env.PATH}` };
    const exec = localExec(env);
    assert.match(execFileSync('ls', ['--version'], { env, encoding: 'utf8' }), /GNU/);
    if (where('dash')) assert.equal((await exec({ argv: ['sh', '-c', 'echo "${BASH_VERSION:-none}"'] })).toString(), 'none\n');
    assert.equal((await observeRemoteRevision('fixture', repo, { exec })).worktreeDigest, (await observeRevision(repo)).worktreeDigest);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('a subdirectory, a missing checkout or a non-repository is refused', async () => {
  const { base, repo } = await scratchTree();
  try {
    for (const checkout of [join(repo, 'dir'), join(base, 'absent'), base])
      await assert.rejects(observeRemoteRevision('fixture', checkout, { exec: localExec() }), checkout);
    await assert.rejects(observeRemoteRevision('fixture', 'relative', { exec: localExec() }), /absolute/);
    await assert.rejects(observeRemoteRevision('a/b', repo, { exec: localExec() }), /machine/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('an unsupported path type fails instead of hashing', async () => {
  const { base, repo } = await scratchTree();
  try {
    await rm(join(repo, 'a.txt'));
    await mkdir(join(repo, 'a.txt'));
    await assert.rejects(observeRevision(repo), /Unsupported revision input: a.txt/);
    await assert.rejects(observeRemoteRevision('fixture', repo, { exec: localExec() }), /Unsupported revision input: a.txt/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('partial, truncated or failed remote output is never a revision', async () => {
  const { base, repo } = await scratchTree();
  try {
    const full = await localExec()({ argv: remoteObserverArgv(repo) });
    for (const output of [full.subarray(0, full.length - 2), Buffer.concat([full, Buffer.from('x')]), Buffer.alloc(0),
      Buffer.from(full.toString('latin1').replace(/^C [a-f0-9]+/, 'C nothex'), 'latin1')])
      await assert.rejects(observeRemoteRevision('fixture', repo, { exec: async () => output }));
    const omitted = full.toString('latin1').replace(/P 5 -[^\n]+\na\.txt2\n\n/, '');
    assert.notEqual(omitted, full.toString('latin1'));
    await assert.rejects(observeRemoteRevision('fixture', repo, { exec: async () => Buffer.from(omitted, 'latin1') }), /omitted a.txt/);
    await assert.rejects(observeRemoteRevision('fixture', repo, { exec: async () => { throw new Error('unreachable'); } }), /unreachable/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('hc exec JSON passes only a complete exit 0', () => {
  const ok = { code: 0, signal: null, stderr: '', stdout: Buffer.from([0, 1, 255]).toString('base64'), timed_out: false, truncated: false };
  assert.deepEqual([...parseExecResult(JSON.stringify(ok))], [0, 1, 255]);
  for (const [bad, pattern] of [
    [{ error: { kind: 'machine_unknown', message: 'unknown machine "x"' } }, /machine_unknown/],
    [{ ...ok, code: 3, stderr: 'not a repository' }, /exited 3: not a repository/],
    [{ ...ok, truncated: true }, /truncated/],
    [{ ...ok, timed_out: true }, /timed out/],
    [{ ...ok, signal: 'SIGKILL', code: null }, /signal/],
    [{ ...ok, stdout: undefined }, /stdout/],
  ]) assert.throws(() => parseExecResult(JSON.stringify(bad)), pattern);
  assert.throws(() => parseExecResult('not json'), /no JSON/);
});

test('ls modes map to st_mode, including special bits', () => {
  assert.equal(lsMode('-rw-r--r--'), 0o100644);
  assert.equal(lsMode('lrwxrwxrwx'), 0o120777);
  assert.equal(lsMode('drwxr-xr-x'), 0o040755);
  assert.equal(lsMode('-rwsr-Sr-T'), 0o107744);
  assert.equal(lsMode('prw-------'), 0o010600);
  for (const bad of ['-rw-r--r', '?rw-r--r--', '-rwxr-xr-s', 'missing']) assert.throws(() => lsMode(bad), /unrecognized/);
});

test('duplicate path records must agree', () => {
  const header = `C ${'a'.repeat(40)}\nS 0\n\nT 0\n\nO 0\n\n`;
  assert.equal(parseObserverOutput(Buffer.from(`${header}P 1 -rw-r--r-- 1\nab\nP 1 -rw-r--r-- 1\nab\nE\n`)).entries.size, 1);
  assert.throws(() => parseObserverOutput(Buffer.from(`${header}P 1 -rw-r--r-- 1\nab\nP 1 -rw-r--r-- 1\nac\nE\n`)), /changed/);
});
