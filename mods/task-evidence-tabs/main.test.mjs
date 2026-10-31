import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./main.js', import.meta.url), 'utf8');
function setup({panels = ['files', 'changes'], task = true} = {}) {
  const body = {id:'panel-body', active:'files', children:[{id:'files'}, {id:'changes'}, ...(task ? [{id:'task-evidence'}] : [])]};
  const panel = {id:'panel', hidden:true, children:[body]};
  const root = {children:[panel]};
  const storage = new Map(), calls = [];
  const space = {id:'one', active:true, tabs:[]};
  const node = () => {
    const el = {items:[], styles:{}};
    const builder = new Proxy(el, {get(target, name) {
      if(name in target) return target[name];
      return (...args) => {
        if(name === 'child') el.items.push(args[0]);
        else if(name === 'children') el.items.push(...args[0]);
        else if(name === 'when') {if(args[0]) args[1](builder);}
        else el.styles[name] = args;
        return builder;
      };
    }});
    return builder;
  };
  const run = (command, args) => {
    calls.push([command,args]);
    if(command === 'layout.select') body.active = args.child;
    if(command === 'layout.show') panel.hidden = false;
    if(command === 'layout.hide') panel.hidden = true;
  };
  const Tabs = new Function('View','div','svg','image','h_flex','spaces','panes','run','openOverlay','theme','window','shared','layout','settings','localStorage', source.replace(/^import .*;\n/gm,'').replace('export default class','class')+'\nreturn Tabs;')(
    class {},node,node,node,node,()=>[space],()=>[],run,()=>{},()=>({}),()=>({platform:'macos'}),()=>panels,()=>root,()=>({zoom:1}),{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
  const instance = new Tabs(); instance.init();
  const find = (el,id) => el?.styles?.id?.[0] === id ? el : el?.items?.map(child=>find(child,id)).find(Boolean);
  const click = id => find(instance.render(),`panel-${id}`).styles.on_click[0]();
  return {instance,body,panel,space,click,find,storage,calls};
}

test('Task & Evidence shares the native panel: open, close, switch, and reopen', () => {
  const p = setup();
  p.click('task-evidence');
  assert.equal(p.body.active,'task-evidence'); assert.equal(p.panel.hidden,false);
  p.click('task-evidence'); assert.equal(p.panel.hidden,true);
  p.click('files'); assert.equal(p.body.active,'files'); assert.equal(p.panel.hidden,false);
  p.click('task-evidence'); p.click('changes');
  assert.equal(p.body.active,'changes'); assert.equal(p.panel.hidden,false);
  p.click('task-evidence'); assert.equal(p.body.active,'task-evidence');
});

test('space changes restore Task & Evidence and closed state independently', () => {
  const p = setup();
  p.click('task-evidence'); p.instance.render();
  p.space.id='two'; p.instance.render(); assert.equal(p.panel.hidden,true);
  p.instance.render();
  p.space.id='one'; p.instance.render();
  assert.equal(p.body.active,'task-evidence'); assert.equal(p.panel.hidden,false);
  p.click('task-evidence'); p.instance.render();
  p.space.id='two'; p.instance.render();
  p.space.id='one'; p.instance.render(); assert.equal(p.panel.hidden,true);
});

test('button follows layout availability without changing Files and Changes preferences', () => {
  const p = setup({panels:[]});
  const tree = p.instance.render();
  assert.ok(p.find(tree,'panel-task-evidence'));
  assert.equal(p.find(tree,'panel-files'),undefined);
  assert.equal(p.find(tree,'panel-changes'),undefined);
  const noTask = setup({task:false});
  assert.equal(noTask.find(noTask.instance.render(),'panel-task-evidence'),undefined);
});
