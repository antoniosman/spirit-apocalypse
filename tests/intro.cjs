const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console});
for(const file of ['character-data.js','intro-data.js','scenarios.js','episodes.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').match(/const RELATIONS = \[[\s\S]*?\n\];/)[0],ctx);
for(const file of ['campaign.js','campaign-validation.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const C=vm.runInContext('Campaign',ctx),I=vm.runInContext('SpiritIntro',ctx),valid=vm.runInContext('validCampaignSnapshot',ctx),names=vm.runInContext('Object.keys(characterGenders)',ctx);
const json=JSON.stringify,clone=value=>JSON.parse(json(value));
function next(s){s.phase='report';assert(C.advanceEpisode(s));}
for(let count=1;count<=3;count++){
 const players=['Billy','Tony','Alex'].slice(0,count),s=C.create(players,'together',7),plan=I.plan(s);
 assert.equal(plan.start,54);assert.equal(plan.end,90);assert.equal(plan.total,36000);
 assert.equal(plan.shots.find(shot=>shot.type==='cast').at,11000,'first player enters at source 1:05');
 assert.deepEqual(clone(plan.shots.filter(shot=>shot.type==='cast').map(shot=>shot.name)),players);
 assert.equal(plan.shots.find(shot=>shot.type==='logo').ms,6500,'preserve title reveal');
 assert.equal(plan.shots.reduce((sum,shot)=>sum+shot.ms,0),36000);
 assert(plan.shots.every(shot=>shot.ms>0));
 assert.equal(I.shotAt(plan,10999),2);assert.equal(plan.shots[I.shotAt(plan,11000)].name,players[0]);
}
const s=C.create(['Billy','Tony','Alex'],'together',19),g=C.groups(s)[0];
const ep1=json(I.snapshot(s,1));C.recruit(s,g,'Rino');assert.equal(s.characters.Rino.joinedEpisode,1);
assert.equal(json(I.snapshot(s,1)),ep1,'recruit cannot rewrite episode-one credits');
next(s);assert(I.snapshot(s,2).actors.includes('Rino'));
const ep2=json(I.snapshot(s,2));C.recruit(s,C.groups(s)[0],'Demarin');
assert(!I.snapshot(s,2).actors.includes('Demarin'),'a new recruit starts next episode');
s.characters.Elisa.metEpisode=1;assert(!I.snapshot(s,2).actors.includes('Elisa'),'meeting alone is not recruitment');
C.remove(s,'Rino','dead','Test history');assert.equal(json(I.snapshot(s,2)),ep2,'later death cannot rewrite historical credits');
next(s);assert(I.snapshot(s,3).actors.includes('Demarin'));assert(!I.snapshot(s,3).actors.includes('Rino'));
assert(valid(s));const before=json(s);for(let episode=1;episode<=3;episode++){I.plan(s,episode);I.snapshot(s,episode);}assert.equal(json(s),before,'replay preparation is read-only');
const restored=clone(s);assert.equal(json(I.snapshot(restored,2)),ep2);assert(valid(restored));
const max=C.create(['Billy','Tony','Alex'],'together',2),mg=C.groups(max)[0];for(const name of names.filter(n=>!max.players.includes(n)))C.recruit(max,mg,name);next(max);
const plan=I.plan(max),groups=plan.shots.filter(shot=>shot.type==='cast-group');
assert.equal(plan.cast.actors.length,26);assert.equal(groups.flatMap(shot=>shot.names).length,23,'every recruited NPC gets a credit');
assert(groups.every(shot=>shot.names.length<=6&&shot.ms>=1800));assert.equal(plan.total,36000);
assert.equal(plan.shots.reduce((sum,shot)=>sum+shot.ms,0),36000);
const legacy=clone(s);delete legacy.introSnapshots;const old=json(legacy);assert.deepEqual(clone(I.snapshot(legacy,2).actors),legacy.players);assert.equal(I.snapshot(legacy,2).historical,false);assert.equal(json(legacy),old);
for(const mutate of [v=>v.introSnapshots[9]=v.introSnapshots[1],v=>v.introSnapshots[1].actors.push('Unknown'),v=>v.introSnapshots[2].actors.push('Rino'),v=>v.introSnapshots[1].actors.push('Rino')]){const broken=clone(s);mutate(broken);assert.equal(I.validSnapshots(broken),false);assert.equal(valid(broken),false);}
console.log('PASS: intro source 0:54–1:30, first player at 1:05, ordered 1–3 players, all 26 credits, next-episode recruitment, immutable replay and validated save history.');
