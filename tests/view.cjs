const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console});
for(const f of ['character-data.js','intro-data.js','scenarios.js','episodes.js','campaign-view.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').match(/const RELATIONS = \[[\s\S]*?\n\];/)[0],ctx);
vm.runInContext(fs.readFileSync(path.join(root,'campaign.js'),'utf8'),ctx);
const C=vm.runInContext('Campaign',ctx),V=vm.runInContext('SpiritCampaignView',ctx),plain=v=>JSON.parse(JSON.stringify(v));
const s=C.create(['Billy','Tony'],'separated',21),[a,b]=C.groups(s);
const ha=C.settle(s,a,'First base'),hb=C.settle(s,b,'Other base');
assert.deepEqual(plain(V.visibleShelters(s,a)),[ha.shelterId]);assert.deepEqual(plain(V.visibleShelters(s,b)),[hb.shelterId]);
// Meet, merge, then choose one common home: the previous base remains in history only.
b.locationId=a.locationId;for(const n of b.members){s.characters[n].locationId=a.locationId;s.characters[n].shelterId=null;}
const merged=C.merge(s,a.groupId,b.groupId);assert.equal(V.visibleShelters(s,merged).length,2,'separate active bases remain before choosing a shared home');
C.settle(s,merged,null,hb.shelterId);const before=JSON.stringify(s);
assert.deepEqual(plain(V.visibleShelters(s,merged)),[hb.shelterId]);assert.equal(JSON.stringify(s),before);
assert(s.shelters[ha.shelterId]);assert.equal(s.shelters[ha.shelterId].status,'abandoned');
assert(C.departMission(s,merged));assert.deepEqual(plain(V.visibleShelters(s,merged)),[hb.shelterId]);C.returnMission(s,merged);
C.abandon(s,merged);assert.equal(V.visibleShelters(s,merged).length,0,'abandoned bases do not fill the panel');
const r=C.create(['Billy','Tony'],'separated',3),g=C.groups(r)[0];C.recruit(r,g,'Violet');C.recruit(r,g,'Demarin');
const stateBefore=JSON.stringify(r),ordered=plain(V.relationshipOrder(r,'Billy'));
assert.deepEqual(ordered.slice(0,2),['Demarin','Violet'],'encountered people precede unknown people alphabetically');
assert(!V.met(r,'Billy','Rino'),'a pre-existing bond is not an encounter');
const remaining=ordered.slice(2);assert.deepEqual(remaining,[...remaining].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'})));
assert.equal(JSON.stringify(r),stateBefore,'opening relationships cannot alter game state');
assert(!plain(V.relationshipOrder(r,'Tony')).slice(0,2).includes('Violet'),'knowledge is specific to each player');
console.log('PASS: encountered-first alphabetical relationships, independent-group knowledge, selected/shared base visibility, missions and preserved shelter history.');
