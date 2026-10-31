import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRecord, acceptanceStatus } from './task-record.js';
import { writeRecord } from '../../records/task-record-store.mjs';
const fixture = async name => JSON.parse(await readFile(new URL(`../../records/fixtures/${name}.json`,import.meta.url),'utf8'));
const observed = record => ({machine:record.machine,checkout:record.checkout,...record.revision});

test('fixtures distinguish activity, missing worker, receipts and invalid input', async () => {
  for (const [name, expected] of Object.entries({active:'unverified','completed-unverified':'unverified',accepted:'accepted','stale-revision':'stale','missing-worker':'unverified',malformed:'malformed'})) {
    const record = await fixture(name);
    assert.equal(acceptanceStatus(record,observed(record)),expected,name);
  }
  assert.ok(parseRecord('{').errors.length);
  assert.equal(parseRecord('null').record,null);
});

test('acceptance requires matching observed machine, checkout, commit and dirty content', async () => {
  const record = await fixture('accepted');
  assert.equal(acceptanceStatus(record),'unverified');
  assert.equal(acceptanceStatus(record,{...observed(record),commit:'b'.repeat(40)}),'stale');
  assert.equal(acceptanceStatus(record,{...observed(record),worktreeDigest:'sha256:'+'c'.repeat(64)}),'stale');
  assert.equal(acceptanceStatus(record,{...observed(record),worktreeDigest:null}),'unverified');
  assert.equal(acceptanceStatus(record,{...observed(record),machine:'other'}),'unverified');
  assert.equal(acceptanceStatus(record,{...observed(record),checkout:'/other'}),'unverified');
  record.revision.worktreeDigest = 'sha256:'+'d'.repeat(64);
  assert.equal(acceptanceStatus(record,observed(record)),'stale');
});

test('coordinator writes atomically, rejects stale sequence and preserves prior contents on failure', async () => {
  const directory = await mkdtemp(join(tmpdir(),'task-record-'));
  try {
    const path = join(directory,'task.json');
    const record = await fixture('active');
    await assert.rejects(writeRecord(path,record,{writer:'worker-1'}),/coordinator/);
    await writeRecord(path,record,{writer:record.coordinator});
    await assert.rejects(writeRecord(path,record,{writer:record.coordinator}),/stale sequence/);
    const next = {...record,sequence:2,activity:'completed'};
    await writeRecord(path,next,{writer:record.coordinator,expectedSequence:1});
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),next);
    await assert.rejects(writeRecord(path,{...next,sequence:3,machine:'other'},{writer:record.coordinator,expectedSequence:2}),/identity/);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),next);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('revision observation includes staged, unstaged and untracked content but excludes task evidence', async () => {
  const { execFileSync } = await import('node:child_process');
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { observeRevision } = await import('../../records/task-record-store.mjs');
  const directory = await mkdtemp(join(tmpdir(),'task-revision-'));
  const git = (...args) => execFileSync('git',['-C',directory,...args]);
  try {
    git('init','-q');
    git('config','user.name','Fixture'); git('config','user.email','fixture@example.invalid');
    await writeFile(join(directory,'source'),'initial'); git('add','.'); git('commit','-qm','initial');
    const clean = await observeRevision(directory);
    assert.match(clean.worktreeDigest,/^sha256:[a-f0-9]{64}$/);
    await mkdir(join(directory,'nested'));
    await writeFile(join(directory,'outside'),'changed outside nested checkout');
    await assert.rejects(observeRevision(join(directory,'nested')),/repository root/);
    await rm(join(directory,'outside'));
    await mkdir(join(directory,'.herdr-tasks'));
    await writeFile(join(directory,'.herdr-tasks','task.json'),'evidence');
    assert.deepEqual(await observeRevision(directory),clean);
    await writeFile(join(directory,'source'),'staged'); git('add','source');
    const staged = await observeRevision(directory);
    await writeFile(join(directory,'source'),'unstaged');
    const unstaged = await observeRevision(directory);
    assert.notEqual(staged.worktreeDigest,unstaged.worktreeDigest);
    await writeFile(join(directory,'new'),'one');
    const untracked = await observeRevision(directory);
    await writeFile(join(directory,'new'),'two');
    assert.notEqual(untracked.worktreeDigest,(await observeRevision(directory)).worktreeDigest);
    await rm(join(directory,'source'));
    assert.notEqual(untracked.worktreeDigest,(await observeRevision(directory)).worktreeDigest);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('revision fields reject coercible nonstrings and invalid object ID lengths', async () => {
  const record = await fixture('active');
  for(const commit of [['a'.repeat(40)], 'a'.repeat(41), {}]) {
    assert.equal(parseRecord(JSON.stringify({...record,revision:{commit,worktreeDigest:'clean'}})).record,null);
  }
  assert.equal(parseRecord(JSON.stringify({...record,revision:{commit:'a'.repeat(40),worktreeDigest:['clean']}})).record,null);
});

test('record creation preserves existing malformed JSON values', async () => {
  const directory = await mkdtemp(join(tmpdir(),'task-record-malformed-'));
  try {
    const path = join(directory,'task.json');
    const record = await fixture('active');
    for (const source of ['null', 'false', '0', '""']) {
      await writeFile(path,source);
      await assert.rejects(writeRecord(path,record,{writer:record.coordinator}),/malformed/);
      assert.equal(await readFile(path,'utf8'),source);
    }
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('receipts become stale when Git hides tracked bytes or executable changes', async t => {
  const { execFileSync } = await import('node:child_process');
  const { chmod } = await import('node:fs/promises');
  const { observeRevision } = await import('../../records/task-record-store.mjs');
  for (const kind of ['assume-unchanged', 'skip-worktree', 'filemode', 'autocrlf', 'attributes']) {
    await t.test(kind, async () => {
      const directory = await mkdtemp(join(tmpdir(), 'revision-hidden-'));
      const git = (...args) => execFileSync('git', ['-C', directory, ...args]);
      try {
        git('init', '-q');
        git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
        git('config', 'commit.gpgsign', 'false'); git('config', 'core.autocrlf', 'false');
        await writeFile(join(directory, 'source.sh'), 'original\n');
        await chmod(join(directory, 'source.sh'), 0o644);
        if (kind === 'attributes') await writeFile(join(directory, '.gitattributes'), '*.sh text eol=lf\n');
        git('add', '.'); git('commit', '-qm', 'initial');
        if (kind === 'assume-unchanged' || kind === 'skip-worktree') git('update-index', `--${kind}`, 'source.sh');
        if (kind === 'filemode') git('config', 'core.filemode', 'false');
        if (kind === 'autocrlf') git('config', 'core.autocrlf', 'true');
        const revision = await observeRevision(directory);
        const record = await fixture('accepted');
        record.revision = revision; record.receipt.revision = revision;
        assert.equal(acceptanceStatus(record, observed(record)), 'accepted');
        if (kind === 'filemode') await chmod(join(directory, 'source.sh'), 0o755);
        else await writeFile(join(directory, 'source.sh'), ['attributes', 'autocrlf'].includes(kind) ? 'original\r\n' : 'changed\n');
        assert.equal(acceptanceStatus(record, { ...observed(record), ...await observeRevision(directory) }), 'stale');
      } finally { await rm(directory, { recursive: true, force: true }); }
    });
  }
});
