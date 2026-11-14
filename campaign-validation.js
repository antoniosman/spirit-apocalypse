/* Validate identity links and turn state before accepting an imported campaign. */
function validCampaignSnapshot(s){
  try{
    const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
    const names=Object.keys(characterGenders),metric=v=>Number.isFinite(v)&&v>=0&&v<=100;
    if(!obj(s)||s.version!==2||!['intro','story','report'].includes(s.phase)||!integer(s.episode,1,6)||!integer(s.seed,-2147483648,4294967295)||s.seed===0)return false;
    if(!Array.isArray(s.players)||s.players.length<1||s.players.length>3||new Set(s.players).size!==s.players.length||!s.players.every(n=>names.includes(n)))return false;
    if(!obj(s.characters)||names.some(n=>!obj(s.characters[n]))||Object.keys(s.characters).length!==names.length)return false;
    if(!obj(s.groups)||!obj(s.locations)||!obj(s.shelters)||!obj(s.relations)||!obj(s.flags)||!obj(s.scenes))return false;
    if(!Array.isArray(s.playerRecords)||s.playerRecords.length!==s.players.length||new Set(s.playerRecords.map(p=>p.playerId)).size!==s.players.length)return false;
    const ids=s.playerRecords.map(p=>p.playerId);
    if(!s.playerRecords.every((p,i)=>obj(p)&&p.playerId==='p'+(i+1)&&p.characterId===s.players[i]&&obj(s.groups[p.groupId])))return false;
    if(!Object.entries(s.locations).every(([id,l])=>obj(l)&&l.locationId===id&&typeof l.name==='string'&&typeof l.kind==='string'))return false;
    const assigned=new Set();
    for(const[id,g]of Object.entries(s.groups)){
      if(!obj(g)||g.groupId!==id||!Array.isArray(g.members)||new Set(g.members).size!==g.members.length||!g.members.every(n=>names.includes(n)))return false;
      if(!Array.isArray(g.playerIds)||new Set(g.playerIds).size!==g.playerIds.length||!g.playerIds.every(id=>ids.includes(id)))return false;
      if(!obj(g.inventory)||!['food','meds','materials'].every(k=>integer(g.inventory[k],0,999))||!metric(g.security)||!metric(g.danger)||!obj(g.flags))return false;
      if(!s.locations[g.locationId]||!Array.isArray(g.shelterIds)||!g.shelterIds.every(h=>s.shelters[h]))return false;
      if(!g.archived){
        for(const n of g.members){if(assigned.has(n)||s.characters[n].groupId!==id||s.characters[n].life!=='alive')return false;assigned.add(n);}
        if(!g.playerIds.every(pid=>{const p=s.playerRecords.find(p=>p.playerId===pid);return p.groupId===id&&(s.characters[p.characterId].life!=='alive'||g.members.includes(p.characterId));}))return false;
        if(g.activeShelterId&&(!s.shelters[g.activeShelterId]||s.shelters[g.activeShelterId].groupId!==id||s.shelters[g.activeShelterId].status!=='active'||!g.shelterIds.includes(g.activeShelterId)))return false;
      }else if(g.members.length||g.playerIds.length)return false;
      if(g.mission&&(!obj(g.mission)||!s.shelters[g.mission.originShelterId]||!Array.isArray(g.mission.participants)||!g.mission.participants.every(n=>names.includes(n))||!s.locations[g.mission.destinationId]))return false;
    }
    for(const[n,c]of Object.entries(s.characters)){
      if(c.characterId!==n||!['alive','dead','missing'].includes(c.life)||!Array.isArray(c.discoveredBy)||!c.discoveredBy.every(p=>s.players.includes(p)))return false;
      if(!['bitten','amputated','injured','discovered'].every(k=>typeof c[k]==='boolean'))return false;
      if(c.groupId&&(!s.groups[c.groupId]||!assigned.has(n)))return false;
      if(c.locationId&&!s.locations[c.locationId])return false;
      if(c.shelterId&&(!s.shelters[c.shelterId]||s.shelters[c.shelterId].locationId!==c.locationId||c.life!=='alive'))return false;
    }
    for(const[id,h]of Object.entries(s.shelters)){
      if(!obj(h)||h.shelterId!==id||!s.groups[h.groupId]||!s.locations[h.locationId]||typeof h.name!=='string'||!metric(h.security)||!metric(h.fortification)||!['active','abandoned','destroyed'].includes(h.status)||!Array.isArray(h.history)||!h.history.every(x=>typeof x==='string'))return false;
    }
    for(const[a,targets]of Object.entries(s.relations)){
      if(!names.includes(a)||!obj(targets))return false;
      for(const[b,r]of Object.entries(targets))if(!names.includes(b)||a===b||!obj(r)||!metric(r.affinity)||!metric(r.trust)||typeof r.met!=='boolean'||!Array.isArray(r.history)||!r.history.every(x=>typeof x==='string'))return false;
    }
    const sceneValid=sc=>obj(sc)&&typeof sc.sceneId==='string'&&!!s.groups[sc.groupId]&&typeof sc.title==='string'&&Array.isArray(sc.text)&&sc.text.every(x=>typeof x==='string')&&Array.isArray(sc.targets)&&sc.targets.every(n=>names.includes(n))&&Array.isArray(sc.voters)&&sc.voters.length>0&&new Set(sc.voters).size===sc.voters.length&&sc.voters.every(p=>ids.includes(p))&&ids.includes(sc.actorId)&&Array.isArray(sc.choices)&&sc.choices.length>0&&sc.choices.every(c=>obj(c)&&['id','name','hint','effect'].every(k=>typeof c[k]==='string'));
    if(!Object.values(s.scenes).every(sceneValid))return false;
    const t=s.turn;
    if(!obj(t)||!integer(t.round,0,18)||!Array.isArray(t.queue)||!t.queue.every(id=>s.groups[id])||!integer(t.queueIndex,0,t.queue.length)||!Array.isArray(t.votes))return false;
    if(t.sceneId&&!s.scenes[t.sceneId])return false;
    if(t.votes.length&&(!t.sceneId||t.votes.length>=s.scenes[t.sceneId].voters.length||!t.votes.every((v,i)=>obj(v)&&v.playerId===s.scenes[t.sceneId].voters[i]&&integer(v.index,0,s.scenes[t.sceneId].choices.length-1))))return false;
    const resultValid=r=>obj(r)&&typeof r.text==='string'&&typeof r.heading==='string'&&Array.isArray(r.deaths)&&r.deaths.every(n=>names.includes(n))&&Array.isArray(r.affected)&&r.affected.every(n=>names.includes(n));
    if(t.result&&!resultValid(t.result))return false;if(s.pendingCinematic&&!resultValid(s.pendingCinematic))return false;
    if(!Array.isArray(s.decisions)||!s.decisions.every(d=>obj(d)&&integer(d.episode,1,6)&&typeof d.choice==='string'&&typeof d.title==='string'&&typeof d.outcome==='string'))return false;
    if(!Array.isArray(s.usedScenarios)||!s.usedScenarios.every(n=>integer(n,1,100))||!Array.isArray(s.meetings)||!s.meetings.every(m=>obj(m)&&s.groups[m.a]&&s.groups[m.b]&&s.locations[m.locationId]))return false;
    const safe=(v,d)=>d<35&&(!(v&&typeof v==='object')||Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&safe(x,d+1)));
    return JSON.stringify(s).length<3000000&&safe(s,0);
  }catch(e){return false;}
}
