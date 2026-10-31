import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, dispatchDecision, pausePlan, acceptanceReceipt } from './worker-lifecycle.mjs';
const revision = {commit:'a'.repeat(40),worktreeDigest:'clean'};
const saved = {taskId:'pilot',coordinator:'parent',machine:'local',checkout:'/scratch',worker:{core:'epoch-1',terminal:'local/t1',occupant:'session-1'},revision};
const observed = {...saved,worker:{...saved.worker},reachable:true,state:'live',status:'done',...revision};
test('layout/app closure does not change a surviving binding or accept a badge',()=> {
  assert.equal(reconcile(saved,observed).state,'bound');
  assert.equal(reconcile(saved,{...observed,windowOpen:false}).state,'bound');
  assert.throws(()=>acceptanceReceipt(saved,observed,[]),/checks/);
});
test('lost core, reused shell, stale session and remote failure cannot resume',()=> {
  for (const worker of [{...saved.worker,core:'epoch-2'},{...saved.worker,occupant:'shell-2'},{...saved.worker,occupant:null},null])
    assert.equal(reconcile(saved,{...observed,worker}).state,'unbound');
  assert.equal(reconcile(saved,{...observed,reachable:false}).state,'unavailable');
});
test('checkout or dirty revision changes invalidate verification',()=> {
  assert.equal(reconcile(saved,{...observed,checkout:'/other'}).state,'unbound');
  assert.equal(reconcile(saved,{...observed,worktreeDigest:`sha256:${'b'.repeat(64)}`}).verification,'stale');
});
test('launch failure and ambiguous delivery never dispatch twice',()=> {
  assert.equal(dispatchDecision({attempted:false}), 'launch-once');
  for (const firstMessage of [true,false,undefined]) assert.equal(dispatchDecision({attempted:true,firstMessage}),'reconcile-only');
});
test('pause targets only the exact live owned occupant and always records pickup action',()=> {
  assert.deepEqual(pausePlan(saved,observed).interrupt,['local/t1']);
  assert.deepEqual(pausePlan(saved,{...observed,worker:{...saved.worker,occupant:'shell'}}).interrupt,[]);
  assert.match(pausePlan(saved,observed).nextAction,/Reconcile/);
});
test('acceptance needs coordinator checks, evidence and unchanged frozen revision',()=> {
  const checks=[{command:'node --test',exitCode:0,evidence:'/scratch/check.log'}];
  assert.equal(acceptanceReceipt(saved,observed,checks).decision,'accepted');
  assert.throws(()=>acceptanceReceipt(saved,{...observed,commit:'b'.repeat(40)},checks),/revision/);
  assert.throws(()=>acceptanceReceipt(saved,observed,[{...checks[0],exitCode:1}]),/checks/);
});
test('unknown host state cannot accept or target an interrupt',()=> {
  for(const state of [undefined,'unknown','disconnected']) {
    const unknown={...observed,state};
    assert.equal(reconcile(saved,unknown).state,'unbound');
    assert.deepEqual(pausePlan(saved,unknown).interrupt,[]);
    assert.throws(()=>acceptanceReceipt(saved,unknown,[{command:'check',exitCode:0,evidence:'check.log'}]),/binding/);
  }
});
test('record acceptance refuses a changed before/after snapshot',async()=> {
  const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {recordAcceptance}=await import('./worker-lifecycle.mjs');
  const dir=await mkdtemp(join(tmpdir(),'hc-record-'));
  const path=join(dir,'record.json');
  const record={...saved,schemaVersion:1,sequence:1,owner:'worker',scope:'one file',brief:'/brief',handoff:'/handoff',activity:'active',artifacts:[],receipt:null};
  try {
    await writeFile(path,JSON.stringify(record));
    const inputs={writer:'parent',observed,before:revision,after:revision,checks:[{command:'check',exitCode:0,evidence:'/check.log'}]};
    await assert.rejects(recordAcceptance(path,{...inputs,before:{...revision,commit:'b'.repeat(40)}}),/snapshot/);
    assert.equal(JSON.parse(await readFile(path)).sequence,1);
    assert.equal((await recordAcceptance(path,inputs)).receipt.decision,'accepted');
    assert.equal(JSON.parse(await readFile(path)).sequence,2);
  } finally {await rm(dir,{recursive:true,force:true});}
});
