const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console});
for(const f of ['character-data.js','scenarios.js','episodes.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').match(/const RELATIONS = \[[\s\S]*?\n\];/)[0],ctx);
for(const f of ['campaign.js','campaign-validation.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const C=vm.runInContext('Campaign',ctx),valid=vm.runInContext('validCampaignSnapshot',ctx),json=v=>JSON.stringify(v),clone=v=>JSON.parse(json(v));
const check=s=>{assert(valid(s),'campaign save must be valid: '+s.episode+':'+s.turn.round+':'+s.turn.groupId);const all=C.groups(s).flatMap(g=>g.members);assert.equal(new Set(all).size,all.length,'one physical group per character');};
function ready(players,pattern,seed=1){const s=C.create(players,pattern,seed);s.phase='story';return s;}
function jump(s,round,gid){s.turn={round,queue:C.groups(s).map(g=>g.groupId),queueIndex:0,groupId:gid||C.groups(s)[0].groupId,votes:[],result:null,sceneId:null};return C.scene(s);}
function resolve(s,id){let sc=C.scene(s),index=sc.choices.findIndex(c=>c.id===id||c.effect===id);assert(index>=0,'choice '+id+' exists');const voterCount=sc.voters.length;for(let i=0;i<voterCount;i++){assert(C.choose(s,index));if(i<voterCount-1)assert.equal(s.turn.result,null,'wait for all actual voters');}check(s);return s.turn.result;}

// Every start mode has real independent identities, locations and inventories.
for(const[players,pattern,count]of [[['Billy'],'separated',1],[['Billy','Tony'],'separated',2],[['Billy','Tony'],'together',1],[['Billy','Tony','Alex'],'separated',3],[['Billy','Tony','Alex'],'together',1],[['Billy','Tony','Alex'],'split',2]]){
 const s=ready(players,pattern);check(s);assert.equal(C.groups(s).length,count);assert.equal(C.groups(s).reduce((n,g)=>n+g.members.length,0),players.length);assert.equal(new Set(C.groups(s).map(g=>g.locationId)).size,count);
}
const single=ready(['Billy'],'separated');assert.equal(single.characters.Rino.groupId,null);assert.equal(single.characters.Rino.locationId,null);assert.equal(single.relations.Billy.Rino.met,false);
const search=ready(['Billy','Tony'],'separated');jump(search,0);resolve(search,'searchBond');jump(search,1);assert(C.scene(search).targets.includes('Rino'));assert(C.scene(search).text.some(x=>x.includes('Νόμιζα ότι σε έχασα')));assert.equal(search.characters.Rino.groupId,null,'recognition is not automatic recruitment');
let storyRescue=false;
for(let seed=1;seed<=30&&!storyRescue;seed++){const s=ready(['Billy','Tony'],'separated',seed),[b,t]=C.groups(s),before=json(t);jump(s,1);resolve(s,'saveJoin');assert.equal(json(t),before,'rescue choice cannot affect Tony');if(b.members.length===3)storyRescue=true;}
assert(storyRescue,'an actual rescue can recruit two people into Billy’s group only');

// Billy's recruits, resources, discovery and relations do not affect Tony.
const separated=ready(['Billy','Tony'],'separated',7),[billy,tony]=C.groups(separated);const tonyBefore=json(tony),tonyRelations=json(separated.relations.Tony||{});
for(const n of ['Demarin','Rino']){separated.characters[n].locationId=billy.locationId;C.recruit(separated,billy,n);}
assert.equal(json(tony),tonyBefore);assert.equal(json(separated.relations.Tony||{}),tonyRelations);assert.deepEqual(clone(billy.members),['Billy','Demarin','Rino']);assert.deepEqual(clone(tony.members),['Tony']);assert(separated.relations.Billy.Rino.met);
C.adjust(separated,'Billy','Demarin',9,12,'Βοήθησε στην προσωπική διαδρομή.');const restored=clone(separated);assert.notEqual(C.relation(restored,'Billy','Demarin').trust,C.relation(restored,'Tony','Demarin').trust);check(restored);

// Two real bases; mission occupants and return identity; no random replacement.
const hb=C.settle(separated,billy,'Farmhouse'),ht=C.settle(separated,tony,'Apartment');hb.security=73;ht.security=31;assert(C.departMission(separated,billy));assert.equal(Object.values(separated.characters).filter(c=>c.shelterId===hb.shelterId).length,1);assert.equal(tony.activeShelterId,ht.shelterId);assert(C.returnMission(separated,billy));assert.equal(billy.activeShelterId,hb.shelterId);assert.equal(hb.security,73);check(separated);

// Meetings alone do not merge; remote merging is refused; joint residence is explicit.
assert.equal(C.merge(separated,billy.groupId,tony.groupId),null);tony.locationId=billy.locationId;tony.members.forEach(n=>separated.characters[n].locationId=billy.locationId);tony.members.forEach(n=>separated.characters[n].shelterId=null);
const inventoryBefore=billy.inventory.food+tony.inventory.food,joined=C.merge(separated,billy.groupId,tony.groupId);assert(joined);assert.equal(joined.inventory.food,inventoryBefore);assert.equal(joined.activeShelterId,null);assert.equal(joined.shelterIds.length,2);assert.equal(C.groups(separated).length,1);check(separated);
C.settle(separated,joined,null,hb.shelterId);assert.equal(joined.activeShelterId,hb.shelterId);assert.equal(ht.status,'abandoned');const foodBefore=joined.inventory.food;const split=C.split(separated,joined,'p2');assert(split);assert.equal(C.groups(separated).length,2);assert.equal(joined.inventory.food+split.inventory.food,foodBefore);check(separated);
const away=ready(['Billy'],'separated');const ag=C.groups(away)[0];C.recruit(away,ag,'Rino');C.recruit(away,ag,'Demarin');const ah=C.settle(away,ag,'Safehouse');C.departMission(away,ag);const missionLocation=ag.locationId;C.abandon(away,ag,true);assert.equal(away.characters.Billy.locationId,missionLocation,'destroyed shelter cannot teleport the away party');assert.equal(C.returnMission(away,ag),false);assert.equal(ah.status,'destroyed');assert.equal(ah.fortification,0);check(away);
const rescueMission=ready(['Billy'],'separated');const rm=C.groups(rescueMission)[0],rh=C.settle(rescueMission,rm,'Original home');C.departMission(rescueMission,rm);C.recruit(rescueMission,rm,'Elisa');assert(rm.mission.participants.includes('Elisa'));C.returnMission(rescueMission,rm);assert.equal(rescueMission.characters.Elisa.shelterId,rh.shelterId);assert.equal(rescueMission.characters.Elisa.locationId,rh.locationId);check(rescueMission);
const recognition=ready(['Billy','Tony'],'separated');const [rg1,rg2]=C.groups(recognition);C.recruit(recognition,rg1,'Demarin');const home=C.settle(recognition,rg1,'Guarded base');recognition.locations.meeting={locationId:'meeting',name:'Agreed meeting',kind:'meeting'};for(const g of [rg1,rg2]){g.locationId='meeting';const name=C.playerNames(recognition,g)[0];recognition.characters[name].locationId='meeting';recognition.characters[name].shelterId=null;}const rg=C.merge(recognition,rg1.groupId,rg2.groupId);assert(!recognition.relations.Tony?.Demarin?.met,'distant guard must remain unknown');C.settle(recognition,rg,null,home.shelterId);assert(recognition.relations.Tony.Demarin.met,'common home creates an actual first meeting');check(recognition);

// Permanent injury and all bridge routes survive a round-trip save.
for(const choice of ['first','second','both','none']){const s=ready(['Billy','Tony'],'separated',31);const sc=jump(s,16);assert.equal(sc.targets.length,2);assert(sc.targets.every(n=>C.live(s,n)));const snapshot=clone(s),before=json(sc),seed=s.seed;assert.equal(json(C.scene(s)),before);assert.equal(s.seed,seed);resolve(s,choice);resolve(snapshot,choice);assert.equal(json(s),json(snapshot),'loading must preserve rescue outcomes');assert(s.pendingCinematic);assert.equal(C.advance(s),false,'cinema precedes next scene');C.dismissCinematic(s);assert(C.advance(s));check(s);}
let amputation;
for(let seed=1;seed<40&&!amputation;seed++){const s=ready(['Billy'],'separated',seed),g=C.groups(s)[0];C.recruit(s,g,'Rino');g.inventory.meds=10;jump(s,8);resolve(s,'amputate');if(s.characters.Rino.amputated)amputation=s;}
assert(amputation);amputation.phase='report';C.advanceEpisode(amputation);assert(amputation.characters.Rino.amputated);check(amputation);

// Full six-episode campaigns: varying decisions, all starts, voting and repeated save/load.
let campaigns=0,episodes=0,decisions=0,maxBytes=0;
for(const[count,pattern]of [[1,'separated'],[2,'separated'],[2,'together'],[3,'separated'],[3,'together'],[3,'split']]){
 for(let seed=1;seed<=20;seed++){
  let s=ready(['Billy','Tony','Alex'].slice(0,count),pattern,seed),previousDeaths=new Set();
  for(let guard=0;guard<1200;guard++){
   check(s);maxBytes=Math.max(maxBytes,json(s).length);
   for(const n of previousDeaths)assert.equal(s.characters[n].life,'dead','death is permanent');previousDeaths=new Set(Object.keys(s.characters).filter(n=>s.characters[n].life==='dead'));
   if(s.phase==='report'){episodes++;if(s.episode===6||!C.groups(s).length)break;assert(C.advanceEpisode(s));s.phase='story';continue;}
   if(s.pendingCinematic){C.dismissCinematic(s);continue;}
   if(s.turn.result){assert(C.advance(s));continue;}
   const sc=C.scene(s);assert(sc);const before=json(sc),rng=s.seed;assert.equal(json(C.scene(s)),before);assert.equal(s.seed,rng);s=clone(s);assert.equal(json(C.scene(s)),before);
   const selected=(seed+guard)%sc.choices.length;const old=s.decisions.length;assert(C.choose(s,selected));decisions+=s.decisions.length-old;
   if(guard===1199)throw Error('Campaign did not finish');
  }campaigns++;
 }
}
for(const mutate of [s=>s.groups.g1.members.push('Billy'),s=>s.characters.Billy.groupId='ghost',s=>s.relations.Billy.Rino.trust=999,s=>s.turn.votes=[{playerId:'ghost',index:0}],s=>s.shelters.bad={shelterId:'bad'}]){const s=ready(['Billy','Tony'],'separated');mutate(s);assert.equal(valid(s),false,'reject broken identity/state links');}
console.log(`PASS: ${campaigns} full campaigns, ${episodes} episodes, ${decisions} decisions; all 1/2/3 player patterns, group isolation/merge/split, shelters/missions, relationships, injuries and four rescue routes. Largest save: ${maxBytes} bytes.`);
if(process.env.CAMPAIGN_FIXTURE){const s=ready(['Billy','Tony'],'separated',7);C.recruit(s,C.groups(s)[0],'Rino');C.recruit(s,C.groups(s)[0],'Demarin');C.groups(s).forEach((g,i)=>C.settle(s,g,i?'Apartment':'Farmhouse'));jump(s,16);fs.writeFileSync(process.env.CAMPAIGN_FIXTURE,json(s));}
