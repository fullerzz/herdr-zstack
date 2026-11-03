import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./main.js', import.meta.url), 'utf8');
function setup({panels = ['files', 'changes'], extraPanels = [], children = []} = {}) {
  const body = {id:'panel-body', active:'files', children:[{id:'files'}, {id:'changes'}, ...children]};
  const panel = {id:'panel', hidden:true, children:[body]};
  const root = {children:[panel]};
  const storage = new Map(), calls = [];
  const space = {id:'one', active:true, tabs:[]};
  const node = (kind, path) => {
    const el = {items:[], styles:{}, kind, path};
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
  const Tabs = new Function('View','div','svg','image','h_flex','spaces','panes','run','openOverlay','theme','window','shared','layout','settings','localStorage','props', source.replace(/^import .*;\n/gm,'').replace('export default class','class')+'\nreturn Tabs;')(
    class {},node,path=>node('svg',path),path=>node('image',path),node,()=>[space],()=>[],run,()=>{},()=>({}),()=>({platform:'macos'}),()=>panels,()=>root,()=>({zoom:1}),{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},()=>({extraPanels}));
  const instance = new Tabs(); instance.init();
  const find = (el,id) => el?.styles?.id?.[0] === id ? el : el?.items?.map(child=>find(child,id)).find(Boolean);
  const click = id => find(instance.render(),`panel-${id}`).styles.on_click[0]();
  return {instance,body,panel,space,click,find,storage,calls};
}

test('space changes restore an open panel and closed state independently', () => {
  const p = setup();
  p.click('changes'); p.instance.render();
  p.space.id='two'; p.instance.render(); assert.equal(p.panel.hidden,true);
  p.instance.render();
  p.space.id='one'; p.instance.render();
  assert.equal(p.body.active,'changes'); assert.equal(p.panel.hidden,false);
  p.click('changes'); p.instance.render();
  p.space.id='two'; p.instance.render();
  p.space.id='one'; p.instance.render(); assert.equal(p.panel.hidden,true);
});

test('a leftover task-evidence layout child gets no button', () => {
  const p = setup({children:[{id:'task-evidence'}]});
  assert.equal(p.find(p.instance.render(),'panel-task-evidence'),undefined);
});

test('a configured integration opens, collapses, switches, and restores per space', () => {
  const p = setup({extraPanels:[{id:'threads', label:'Threads', icon:'art/turtle.svg', iconType:'image'}], children:[{id:'threads'}]});
  const button = p.find(p.instance.render(),'panel-threads');
  assert.ok(button, 'configured integration has a button');
  assert.ok(button.items.includes('Threads'));
  assert.ok(button.items.some(item=>item.kind==='image' && item.path==='art/turtle.svg'));
  p.click('threads');
  assert.equal(p.body.active,'threads'); assert.equal(p.panel.hidden,false);
  p.instance.render(); p.space.id='two'; p.instance.render();
  assert.equal(p.panel.hidden,true);
  p.instance.render(); p.space.id='one'; p.instance.render();
  assert.equal(p.body.active,'threads'); assert.equal(p.panel.hidden,false);
  p.click('threads'); assert.equal(p.panel.hidden,true);
  p.click('files'); assert.equal(p.body.active,'files'); assert.equal(p.panel.hidden,false);
  p.click('threads'); p.click('changes'); assert.equal(p.body.active,'changes');
});

test('integration buttons require existing children and valid distinct configuration', () => {
  const p = setup({panels:[], children:[{id:'threads'}, {id:'notes'}], extraPanels:[
    null, {}, {id:'', label:'Empty'}, {id:'threads', label:3},
    {id:'threads', label:'Bad icon', icon:5}, {id:'threads', label:'Bad renderer', iconType:'html'},
    {id:'missing', label:'Missing'}, {id:'files', label:'Override'},
    {id:'changes', label:'Override'},
    {id:'threads', label:'Threads', icon:'art/turtle.svg'}, {id:'threads', label:'Duplicate'},
    {id:'notes', label:'Notes'},
  ]});
  const tree = p.instance.render();
  const threads = p.find(tree,'panel-threads');
  assert.ok(threads, 'valid integration survives invalid entries');
  assert.ok(threads.items.includes('Threads'));
  assert.ok(threads.items.some(item=>item.kind==='svg' && item.path==='art/turtle.svg'));
  const notes = p.find(tree,'panel-notes');
  assert.ok(notes, 'an icon is optional');
  assert.equal(p.find(tree,'panel-missing'),undefined);
  assert.equal(p.find(tree,'panel-files'),undefined);
  assert.equal(p.find(tree,'panel-changes'),undefined);
  assert.equal(tree.items.filter(item=>item.styles?.id?.[0]==='panel-threads').length,1);
  for (const extraPanels of [null, {}, 'threads']) assert.doesNotThrow(()=>setup({extraPanels}).instance.render());
});
