import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDropLayout } from '../mods/drag-pane/drop-layout.js';

test('Drop overlay preserves window geometry and remote pane identities without live terminals', () => {
  const layout = {id:'root',type:'row',children:[
    {id:'sidebar',type:'block',size:{px:240},content:{mod:'spaces'}},
    {id:'workspace',type:'column',gap:8,children:[
      {id:'tabs',type:'block',size:{px:46},content:{mod:'drag-tabs'}},
      {id:'main',type:'block',content:{tab:'active'}}]}]};
  const tree={id:'split',type:'row',children:[
    {id:'p1',size:{weight:2},content:{terminal:'t1'}},
    {id:'p2',size:{weight:1},content:{terminal:'t2'}}]};
  const result=buildDropLayout(layout,tree,{source:'remote/tab',sourcePane:'remote/p1'},'remote');
  assert.deepEqual(result.children[0].size,{px:240});
  const workspace=result.children[1];
  assert.equal(workspace.children[0].content.props.kind,'tab');
  const split=workspace.children[1].children[0];
  assert.equal(split.gap,8);
  assert.equal(split.children[1].content.props.targetPane,'remote/p2');
  assert.equal(split.children[1].content.props.targetTerminal,'remote/t2');
  assert.deepEqual(split.children[0].size,{weight:2});
  const visit=node=>{assert.equal(node.content?.terminal,undefined);for(const value of Object.values(node))assert.notEqual(value,undefined);(node.children??[]).forEach(visit);};
  visit(result);
});
