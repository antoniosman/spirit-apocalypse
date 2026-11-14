/* Deterministic campaign model. Player, character, group, location and shelter
   identities are independent. The UI and saves consume the same state. */
const Campaign = (function(){
  'use strict';
  const names=()=>Object.keys(characterGenders);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
  const live=(s,n)=>s.characters[n]&&s.characters[n].life==='alive';
  function roll(s){let x=s.seed;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x;return(x>>>0)/4294967296;}
  const pick=(s,a)=>a.length?a[Math.floor(roll(s)*a.length)]:null;
  function shuffle(s,a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(roll(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const groups=s=>Object.values(s.groups).filter(g=>!g.archived&&g.members.some(n=>live(s,n)));
  const playableGroups=s=>groups(s).filter(g=>g.playerIds.some(id=>live(s,s.playerRecords.find(p=>p.playerId===id).characterId)));
  const playerNames=(s,g)=>g.playerIds.map(id=>s.playerRecords.find(p=>p.playerId===id).characterId).filter(n=>live(s,n));
  const present=(s,g)=>g.members.filter(n=>live(s,n)&&s.characters[n].locationId===g.locationId);
  const npcs=(s,g)=>present(s,g).filter(n=>!s.players.includes(n));
  function activeGroup(s){return s.groups[s.turn.groupId]&&!s.groups[s.turn.groupId].archived?s.groups[s.turn.groupId]:groups(s)[0];}
  function activePlayer(s){const sc=scene(s);const id=sc.voters[s.turn.votes.length]||sc.voters[0];return s.playerRecords.find(p=>p.playerId===id);}
  function label(s,g){return g.playerIds.map(id=>s.playerRecords.find(p=>p.playerId===id).characterId.toUpperCase()).join(' & ')+"'S GROUP";}
  function location(s,id){return s.locations[id]?.name||'Άγνωστη τοποθεσία';}
  function link(a,b){return RELATIONS.find(r=>(r[0]===a&&r[1]===b)||(r[1]===a&&r[0]===b));}
  function relation(s,a,b,met=false){
    s.relations[a]=s.relations[a]||{};
    if(!s.relations[a][b]){const bond=link(a,b);s.relations[a][b]={affinity:bond?82:42,trust:bond?76:38,met:false,bond:bond?bond[2]:null,history:bond?['Προϋπάρχων δεσμός. Η τοποθεσία δεν είναι γνωστή.']:[]};}
    const r=s.relations[a][b];if(met&&!r.met){r.met=true;r.history.push('Συνάντηση στο Επεισόδιο '+s.episode+'.');}return r;
  }
  function adjust(s,a,b,affinity,trust,reason){const r=relation(s,a,b,true);r.affinity=clamp(r.affinity+affinity);r.trust=clamp(r.trust+trust);if(reason)r.history.push(reason);}
  function meet(s,g,people){
    const witnesses=present(s,g);
    for(const n of people){const c=s.characters[n];if(!c||c.life!=='alive'||c.locationId!==g.locationId)continue;c.discovered=true;c.metEpisode=c.metEpisode||s.episode;
      for(const p of playerNames(s,g)){if(!c.discoveredBy.includes(p))c.discoveredBy.push(p);}
      for(const a of witnesses){if(a===n)continue;relation(s,a,n,true);relation(s,n,a,true);}
    }
  }
  function create(players,pattern='random',seed=Date.now()>>>0){
    if(players.length<1||players.length>3||new Set(players).size!==players.length||players.some(n=>!names().includes(n)))throw Error('Invalid playable cast');
    const s={version:2,players:players.slice(),playerRecords:players.map((n,i)=>({playerId:'p'+(i+1),characterId:n,groupId:null})),characters:{},groups:{},locations:{},shelters:{},relations:{},episode:1,phase:'intro',seed:seed||1307,nextGroupId:1,nextShelterId:1,decisions:[],notices:[],usedScenarios:[],scenes:{},meetings:[],flags:{},turn:{round:0,queue:[],queueIndex:0,groupId:null,votes:[],result:null,sceneId:null},pendingCinematic:null};
    for(const n of names())s.characters[n]={characterId:n,life:'alive',groupId:null,locationId:null,shelterId:null,discovered:players.includes(n),discoveredBy:[],metEpisode:players.includes(n)?1:null,bitten:false,amputated:false,injured:false,reservedFor:null};
    if(players.length===1)pattern='separated';else if(pattern==='random')pattern=pick(s,players.length===2?['separated','separated','together']:['separated','together','split']);
    if(!['separated','together','split'].includes(pattern))pattern='separated';s.startPattern=pattern;
    const partitions=pattern==='together'?[s.playerRecords]:pattern==='split'&&players.length===3?[s.playerRecords.slice(0,2),s.playerRecords.slice(2)]:s.playerRecords.map(p=>[p]);
    const starts=shuffle(s,[['Διαμέρισμα','home'],['Παλιό πρατήριο','station'],['Μικρό κατάστημα','shop'],['Ακινητοποιημένο αυτοκίνητο','car'],['Στάση λεωφορείου','street']]);
    partitions.forEach((part,i)=>{
      const id='g'+s.nextGroupId++,loc='start-'+id;s.locations[loc]={locationId:loc,name:starts[i][0],kind:starts[i][1]};
      const g={groupId:id,playerIds:part.map(p=>p.playerId),members:part.map(p=>p.characterId),locationId:loc,activeShelterId:null,shelterIds:[],inventory:{food:3,meds:2,materials:2},security:25,danger:20,flags:{},mission:null,archived:false};s.groups[id]=g;
      part.forEach(p=>{p.groupId=id;const c=s.characters[p.characterId];c.groupId=id;c.locationId=loc;c.discoveredBy=g.members.slice();});
      meet(s,g,g.members);
    });
    for(const [a,b]of RELATIONS){relation(s,a,b);relation(s,b,a);}
    resetQueue(s);SpiritIntro.capture(s);return s;
  }
  function resetQueue(s){s.turn.queue=playableGroups(s).map(g=>g.groupId);s.turn.queueIndex=0;s.turn.groupId=s.turn.queue[0]||null;s.turn.votes=[];s.turn.result=null;s.turn.sceneId=null;}
  function recruit(s,g,n,reason='Η ομάδα προσέφερε προστασία.'){
    const c=s.characters[n];if(!c||c.life!=='alive'||(c.groupId&&c.groupId!==g.groupId))return false;
    c.locationId=g.locationId;meet(s,g,[n]);c.groupId=g.groupId;c.reservedFor=null;c.shelterId=g.activeShelterId&&s.shelters[g.activeShelterId].locationId===g.locationId?g.activeShelterId:null;
    if(!g.members.includes(n))g.members.push(n);
    if(!s.players.includes(n)&&!c.joinedEpisode)c.joinedEpisode=s.episode;
    if(g.mission&&!g.mission.participants.includes(n))g.mission.participants.push(n);
    for(const p of playerNames(s,g)){adjust(s,n,p,13,17,reason);adjust(s,p,n,8,9,'Αποδοχή νέου μέλους.');}return true;
  }
  function remove(s,n,life,reason){
    const c=s.characters[n];if(!c||c.life==='dead')return false;if(life==='dead'&&s.players.includes(n)&&s.episode<6)return false;
    const g=s.groups[c.groupId];if(g)g.members=g.members.filter(x=>x!==n);c.life=life;c.groupId=null;c.shelterId=null;c.reservedFor=null;s.notices.push(n+' — '+reason);
    if(g)for(const p of playerNames(s,g)){if(p!==n){adjust(s,p,n,-5,-4,reason);if(link(p,n))g.flags.grief={lost:n,witness:p};}}
    return true;
  }
  function reserve(s,g,count){
    const available=names().filter(n=>!s.players.includes(n)&&live(s,n)&&!s.characters[n].groupId&&(!s.characters[n].reservedFor||s.characters[n].reservedFor===g.groupId)&&(!s.characters[n].locationId||s.characters[n].locationId===g.locationId));
    let pool=shuffle(s,available);if(g.flags.searchFor&&pool.includes(g.flags.searchFor))pool=[g.flags.searchFor,...pool.filter(n=>n!==g.flags.searchFor)];
    const chosen=pool.slice(0,count);chosen.forEach(n=>{s.characters[n].locationId=g.locationId;s.characters[n].reservedFor=g.groupId;});meet(s,g,chosen);return chosen;
  }
  function settle(s,g,title,existingId=null){
    let home=existingId&&s.shelters[existingId];
    if(home&&home.status==='destroyed')return null;
    if(!home){const id='h'+s.nextShelterId++,loc='shelter-'+id;s.locations[loc]={locationId:loc,name:title,kind:'shelter'};home={shelterId:id,groupId:g.groupId,name:title,locationId:loc,security:38,fortification:25,status:'active',history:['Εγκατάσταση στο Επεισόδιο '+s.episode+'.']};s.shelters[id]=home;g.shelterIds.push(id);}
    for(const h of g.shelterIds){if(h!==home.shelterId&&s.shelters[h].status==='active'){s.shelters[h].status='abandoned';s.shelters[h].history.push('Η ομάδα επέλεξε άλλη μόνιμη βάση.');}}
    home.groupId=g.groupId;home.status='active';home.history.push('Η ομάδα εγκαταστάθηκε εδώ.');g.activeShelterId=home.shelterId;g.locationId=home.locationId;
    g.members.filter(n=>live(s,n)).forEach(n=>{s.characters[n].locationId=home.locationId;s.characters[n].shelterId=home.shelterId;});g.mission=null;meet(s,g,g.members);return home;
  }
  function abandon(s,g,destroy=false){
    const home=s.shelters[g.activeShelterId];if(!home)return;
    home.status=destroy?'destroyed':'abandoned';home.history.push(destroy?'Καταστράφηκε από την επίθεση.':'Εγκαταλείφθηκε με απόφαση της ομάδας.');
    if(destroy){home.security=0;home.fortification=0;}
    const loc='evacuation-'+g.groupId+'-'+s.episode+'-'+s.turn.round;s.locations[loc]={locationId:loc,name:'Δρόμος εκκένωσης',kind:'street'};
    g.members.filter(n=>s.characters[n].locationId===home.locationId).forEach(n=>{s.characters[n].shelterId=null;s.characters[n].locationId=loc;});
    if(g.locationId===home.locationId)g.locationId=loc;g.activeShelterId=null;
  }
  function departMission(s,g,companion=undefined){
    const home=s.shelters[g.activeShelterId];if(!home||home.status!=='active'||g.mission)return false;
    const participants=playerNames(s,g).filter(n=>live(s,n));const ally=companion===undefined?npcs(s,g)[0]:npcs(s,g).find(n=>n===companion);if(ally)participants.push(ally);
    const loc='mission-'+g.groupId+'-'+s.episode+'-'+s.turn.round;s.locations[loc]={locationId:loc,name:'Αποθήκες κοντά σε '+home.name,kind:'mission'};
    g.mission={originShelterId:home.shelterId,participants,destinationId:loc};g.locationId=loc;participants.forEach(n=>{s.characters[n].locationId=loc;s.characters[n].shelterId=null;});return true;
  }
  function returnMission(s,g){
    if(!g.mission)return false;const mission=g.mission,home=s.shelters[mission.originShelterId];g.mission=null;
    if(home&&home.status==='active'){g.locationId=home.locationId;g.activeShelterId=home.shelterId;mission.participants.filter(n=>live(s,n)&&s.characters[n].groupId===g.groupId).forEach(n=>{s.characters[n].locationId=home.locationId;s.characters[n].shelterId=home.shelterId;});meet(s,g,present(s,g));home.history.push('Επιστροφή εξόρμησης στο Επεισόδιο '+s.episode+'.');return true;}return false;
  }
  function merge(s,aId,bId){
    const a=s.groups[aId],b=s.groups[bId];if(!a||!b||a.archived||b.archived||a.groupId===b.groupId||a.locationId!==b.locationId)return null;
    const id='g'+s.nextGroupId++,g={groupId:id,playerIds:s.playerRecords.filter(p=>a.playerIds.includes(p.playerId)||b.playerIds.includes(p.playerId)).map(p=>p.playerId),members:[...new Set([...a.members,...b.members])],locationId:a.locationId,activeShelterId:null,shelterIds:[...new Set([...a.shelterIds,...b.shelterIds])],inventory:{food:a.inventory.food+b.inventory.food,meds:a.inventory.meds+b.inventory.meds,materials:a.inventory.materials+b.inventory.materials},security:Math.round((a.security+b.security)/2),danger:Math.max(a.danger,b.danger),flags:{mergedFrom:[aId,bId],grief:a.flags.grief||b.flags.grief||null},mission:null,archived:false};
    s.groups[id]=g;for(const old of[a,b]){old.archived=true;old.members=[];old.playerIds=[];}
    s.playerRecords.filter(p=>g.playerIds.includes(p.playerId)).forEach(p=>p.groupId=id);g.members.forEach(n=>s.characters[n].groupId=id);g.shelterIds.forEach(h=>s.shelters[h].groupId=id);meet(s,g,g.members);return g;
  }
  function split(s,g,playerId){
    if(g.playerIds.length<2||!g.playerIds.includes(playerId)||g.mission)return null;
    const p=s.playerRecords.find(p=>p.playerId===playerId),id='g'+s.nextGroupId++;
    const following=npcs(s,g).filter(n=>relation(s,n,p.characterId).trust>=55).slice(0,1),members=[p.characterId,...following];
    const inventory={};for(const k of['food','meds','materials']){inventory[k]=Math.floor(g.inventory[k]/g.playerIds.length);g.inventory[k]-=inventory[k];}
    const loc='split-'+id;s.locations[loc]={locationId:loc,name:'Ανατολικός δρόμος · χωριστή διαδρομή',kind:'street'};
    const next={groupId:id,playerIds:[playerId],members,locationId:loc,activeShelterId:null,shelterIds:[],inventory,security:Math.round(g.security/2),danger:g.danger,flags:{splitFrom:g.groupId},mission:null,archived:false};s.groups[id]=next;
    g.playerIds=g.playerIds.filter(x=>x!==playerId);g.members=g.members.filter(n=>!members.includes(n));p.groupId=id;members.forEach(n=>{Object.assign(s.characters[n],{groupId:id,locationId:loc,shelterId:null});});return next;
  }
  function scheduleMeeting(s,g,target,accept=false){
    let meeting=s.meetings.find(m=>m.episode===s.episode&&[m.a,m.b].includes(g.groupId)&&[m.a,m.b].includes(target.groupId));
    if(!meeting){meeting={a:g.groupId,b:target.groupId,episode:s.episode,locationId:'rendezvous-'+s.episode+'-'+s.meetings.length,status:'offered'};s.locations[meeting.locationId]={locationId:meeting.locationId,name:'Παλαιός υδατόπυργος · συμφωνημένο σημείο',kind:'meeting'};s.meetings.push(meeting);}
    if(accept)meeting.status='accepted';g.locationId=meeting.locationId;presentMembersTo(s,g,meeting.locationId);return meeting;
  }
  function presentMembersTo(s,g,loc){for(const n of g.members){if(s.players.includes(n)||!s.characters[n].shelterId){s.characters[n].locationId=loc;s.characters[n].shelterId=null;}}}
  function support(s,g){const a=npcs(s,g);const wounds=present(s,g).reduce((v,n)=>v+(s.characters[n].amputated?.025:0)+(s.characters[n].injured?.025:0),0);if(!a.length)return -wounds;return a.reduce((sum,n)=>sum+playerNames(s,g).reduce((v,p)=>v+relation(s,n,p).trust,0)/g.playerIds.length,0)/a.length/500-wounds;}
  const option=(id,name,hint='',effect=id)=>({id,name,hint,effect});
  function travelForScene(s,g,sc,name){
    const origin=g.locationId,travellers=present(s,g),id='visit-'+sc.sceneId.replace(/:/g,'-');
    s.locations[id]={locationId:id,name:name+' · διαδρομή '+playerNames(s,g).join(' & '),kind:'encounter'};
    sc.returnLocationId=origin;sc.travelLocationId=id;g.locationId=id;
    travellers.forEach(n=>{s.characters[n].locationId=id;s.characters[n].shelterId=null;});
  }
  function buildScene(s,g){
    const r=s.turn.round,ep=s.episode,available=playerNames(s,g),lead=available[r%available.length],actor=s.playerRecords.find(p=>p.characterId===lead);
    if(r===16){
      const routeKey='finalRoute'+ep;
      if(!g.flags[routeKey]){
        const travellers=present(s,g),loc='crossing-'+ep+'-'+g.groupId;
        s.locations[loc]={locationId:loc,name:'Κατεστραμμένη διάβαση · διαδρομή '+playerNames(s,g).join(' & '),kind:'crossing'};
        g.flags[routeKey]={from:g.locationId,to:loc,participants:travellers.slice()};g.locationId=loc;
        travellers.forEach(n=>{s.characters[n].locationId=loc;s.characters[n].shelterId=null;});
      }
    }
    const sc={sceneId:ep+':'+r+':'+g.groupId,groupId:g.groupId,title:'Όσοι μένουν',text:[],choices:[],targets:[],major:false,personal:false,voters:g.playerIds.filter(id=>live(s,s.playerRecords.find(p=>p.playerId===id).characterId)),actorId:actor.playerId,locationId:g.locationId,kind:'story'};
    if(ep===1&&r===0){const place=location(s,g.locationId);sc.title='Η τελευταία φυσιολογική στιγμή';sc.personal=true;
      sc.text=[subjectName(lead)+' βρίσκεται στο '+place+'. Το κινητό γεμίζει αναπάντητες κλήσεις. Στον δρόμο ένας τραυματίας σηκώνεται χωρίς να νιώθει τον πόνο.',g.playerIds.length===1?'Δεν έχεις ομάδα. Κάθε φωνή έξω από την πόρτα μπορεί να είναι ευκαιρία ή κίνδυνος.':'Μόνο '+playerNames(s,g).join(' και ')+' βρίσκονται εδώ. Οι άλλες ομάδες παραμένουν σε διαφορετικές τοποθεσίες.'];
      sc.choices=[option('supplies','Γέμισε το σακίδιο','Τρόφιμα και φάρμακα πριν φύγεις.'),option('searchBond','Αναζήτησε τους δικούς σου','Μια κλήση δεν αποκαλύπτει την τοποθεσία τους.'),option('observe','Έλεγξε τη διαδρομή διαφυγής','Κέρδισε χρόνο και ασφάλεια.')];
    }else if(ep===1&&r===1){sc.targets=reserve(s,g,2);sc.title='Φωνές πίσω από το μέταλλο';sc.major=true;sc.kind='encounter';
      sc.text=['Στην έξοδο του τετραγώνου, '+(sc.targets.length?sc.targets.join(' και '):'άγνωστοι επιζώντες')+' έχουν παγιδευτεί πίσω από μια στραβωμένη πόρτα. Τους συναντάς τώρα για πρώτη φορά.','Η βοήθεια δεν είναι συμφωνία κοινής ζωής. Αν ανοίξεις δρόμο, θα πρέπει ακόμη να τους προσφέρεις θέση και να δεχτούν.'];
      sc.choices=[option('saveJoin','Σώσε τους και πρόσφερε θέση στην ομάδα','Ρίσκο για όσους βρίσκονται εδώ.'),option('helpOnly','Άνοιξε πέρασμα χωρίς δέσμευση','Βοήθεια χωρίς αυτόματη ένταξη.'),option('leaveEncounter','Συνέχισε τη διαδρομή','Οι φωνές θα μείνουν στη μνήμη σου.')];
    }else if(ep===1&&r===2){sc.targets=(g.flags.encounterSurvivors||[]).filter(n=>live(s,n)&&!s.characters[n].groupId);sc.title=sc.targets.length?'Θα περπατήσουμε μαζί;':'Το πρώτο όριο';
      sc.text=[sc.targets.length?sc.targets.join(' και ')+' περιμένουν στην ασφαλή πλευρά. Δεν έχουν δεχτεί ακόμη να σας ακολουθήσουν.':'Η διαδρομή στενεύει. Αποφασίζεις πόσα είσαι διατεθειμένος να υποσχεθείς στους ανθρώπους που βρίσκονται εδώ.', 'Η εμπιστοσύνη καταγράφεται προσωπικά. Η απόφασή σου δεν αλλάζει τις σχέσεις άλλης ομάδας.'];sc.personal=true;
      sc.choices=sc.targets.length?[option('invite','Πρόσφερε προστασία και κοινή πορεία'),option('share','Μοιράσου τρόφιμα και άφησέ τους να επιλέξουν'),option('evade','Απομακρύνσου χωρίς υπόσχεση')]:[option('listen','Άκουσε τους ανθρώπους δίπλα σου'),option('supplies','Έλεγξε τις εγκαταλελειμμένες τσάντες'),option('guard','Οργάνωσε ασφαλή έξοδο')];
    }else if(r===3&&!g.activeShelterId){sc.title='Μια πόρτα που μπορεί να κλείσει';sc.kind='settle';
      sc.text=['Το να περάσεις μια νύχτα κάπου δεν αρκεί για να το πεις σπίτι. Χρειάζεται απόφαση εγκατάστασης.','Διακρίνεις δύο πιθανά καταφύγια. Η επιλογή θα παραμείνει στο χάρτη, ακόμη κι όταν φύγετε για προμήθειες.'];sc.choices=[option('settleFarm','Εγκαταστάσου στην παλιά αγροικία','Χώρος για περισσότερους, περισσότερες είσοδοι.'),option('settleFlat','Κράτησε το ψηλό διαμέρισμα','Λιγότερος χώρος, ευκολότερη επιτήρηση.'),option('evade','Μείνε στον δρόμο','Χωρίς μόνιμη βάση προς το παρόν.')];
    }else if((r===4||r===6)&&!g.mission){sc.title=r===6?'Ποιοι θα βγουν έξω;':'Η πρώτη βάρδια';sc.kind='shelter';sc.text=[g.activeShelterId?'Η βάση παραμένει στο '+s.shelters[g.activeShelterId].name+'. Τα τρόφιμα δεν θα φτάσουν για πάντα.':'Δεν διαθέτεις ακόμη μόνιμη βάση. Μπορείς να βρεις έναν χώρο ή να συνεχίσεις την πορεία.','Μια εξόρμηση αφήνει κάποιους στη σκοπιά. Ο πληθυσμός της βάσης διαφέρει από τα συνολικά μέλη της ομάδας.'];
      sc.choices=g.activeShelterId?[option('fortify','Οχύρωσε τις εισόδους','Χρησιμοποιεί υλικά.'),option('mission','Στείλε εξόρμηση προμηθειών','Οι παίκτες και ένας σύμμαχος βγαίνουν. Οι υπόλοιποι μένουν.'),option('rest','Ανάπαυση και περίθαλψη','Χρόνος για τραυματίες.'),option('store','Τακτοποίησε αποθέματα και σκοπιά','Προστασία των εφοδίων.')]:[option('settleFarm','Διάλεξε την αγροικία ως βάση'),option('supplies','Ψάξε προμήθειες στη διαδρομή'),option('guard','Μείνε σε επιφυλακή')];
    }else if((r===6||r===7)&&g.mission){sc.title='Ο δρόμος της επιστροφής';sc.kind='mission';sc.text=['Οι αποθήκες έχουν ακόμη σφραγισμένα κιβώτια. Οι σκιές κινούνται ανάμεσα στα φορτηγά.','Η ίδια βάση περιμένει: '+s.shelters[g.mission.originShelterId].name+'. Κανένα νέο καταφύγιο δεν αντικαθιστά την επιστροφή.'];sc.choices=[option('missionRisk','Πάρε όσα περισσότερα μπορείς','Μεγαλύτερη έκθεση.'),option('missionCareful','Πάρε τα απαραίτητα και γύρισε','Μικρότερο κέρδος.'),option('missionReturn','Γύρισε αμέσως στη βάση')];
    }else if(r===8){const local=npcs(s,g);sc.targets=local.length?[pick(s,local.filter(n=>!s.characters[n].amputated))].filter(Boolean):reserve(s,g,1);const n=sc.targets[0];
      if(n){s.characters[n].bitten=true;sc.title='Το δάγκωμα κάτω από το μανίκι';sc.major=true;sc.kind='bite';sc.text=[subjectName(n)+' τραβά το μανίκι. Ένα βαθύ δάγκωμα στο χέρι κάνει την ομάδα να σωπάσει.','Ο ακρωτηριασμός μπορεί να αποτύχει. Η απομόνωση διατηρεί τον άνθρωπο ζωντανό και αγνοούμενο, χωρίς να ισοδυναμεί με θάνατο.'];sc.choices=[option('amputate','Επιχείρησε ακρωτηριασμό','Χρειάζεσαι ιατρικά υλικά. Μόνιμη απώλεια άκρου.'),option('isolate','Απομόνωσε με νερό και ασύρματο'),option('hideBite','Κρύψε το δάγκωμα','Ο κίνδυνος παραμένει μέσα στην ιστορία.'),option('execute','Σταμάτησε τη μόλυνση με θανατηφόρα επιλογή','Μη αναστρέψιμο.')];}
      else{sc.title='Το άδειο ιατρείο';sc.text=['Στο εγκαταλελειμμένο ιατρείο δεν βρίσκεις άλλο πρόσωπο. Βρίσκεις όμως επιδέσμους και μια λίστα με σημεία διανομής.'];sc.choices=[option('heal','Φρόντισε τις πληγές'),option('supplies','Κράτησε ιατρικά υλικά')];}
    }else if(r===9){sc.title='Όσα δεν λέγονται μπροστά σε όλους';sc.personal=true;sc.text=[npcs(s,g).length?'Στη χαμηλή φωνή μιας ιδιωτικής συζήτησης, κάποιος περιμένει να ακούσει τι πραγματικά πιστεύεις.':'Στις σημειώσεις του κινητού γράφεις ποιον φοβάσαι ότι έχασες. Καμία καινούργια φωνή δεν απαντά.',g.flags.grief?'Το όνομα '+g.flags.grief.lost+' παραμένει πληγή για '+g.flags.grief.witness+'.':'Η συμπάθεια και η εμπιστοσύνη δεν αλλάζουν με τον ίδιο τρόπο.'];sc.choices=[option('listen','Άκουσε χωρίς να διακόψεις'),option('truth','Πες τη δύσκολη αλήθεια'),option('privacy','Κράτησε κάποιες πληροφορίες για σένα')];if(g.playerIds.length>1){sc.major=true;sc.title='Θα μείνουμε μαζί;';sc.targets=present(s,g).slice(0,2);sc.choices.push(option('split','Ακολούθησε χωριστή διαδρομή','Ξεχωριστή ομάδα με δικά της εφόδια.'));}
    }else if(r===10&&groups(s).length>1){sc.title='Μια συχνότητα, διαφορετικοί δρόμοι';sc.kind='meetingOffer';const incoming=s.meetings.find(m=>m.episode===ep&&m.b===g.groupId&&m.status==='offered');const target=incoming?s.groups[incoming.a]:groups(s).find(x=>x.groupId!==g.groupId);sc.otherGroupId=target.groupId;
      sc.text=['Ο ασύρματος πιάνει '+playerNames(s,target).join(' και ')+'. Η φωνή φτάνει, η ομάδα δεν έχει φτάσει.',incoming?'Υπάρχει πρόταση για συνάντηση στον παλιό υδατόπυργο. Η αποδοχή σημαίνει πραγματική μετακίνηση.':'Μπορείς να προτείνεις σημείο συνάντησης. Η άλλη ομάδα θα αποφασίσει αν θα έρθει.'];sc.choices=[option(incoming?'acceptMeeting':'offerMeeting',incoming?'Πήγαινε στη συμφωνημένη συνάντηση':'Πρότεινε συνάντηση και πήγαινε στο σημείο'),option('radioOnly','Μοιράσου πληροφορίες, κράτησε χωριστή πορεία'),option('silent','Μην αποκαλύψεις τη θέση σου')];
    }else if(r===11&&groups(s).some(x=>x.groupId!==g.groupId&&x.locationId===g.locationId)){const other=groups(s).find(x=>x.groupId!==g.groupId&&x.locationId===g.locationId);sc.otherGroupId=other.groupId;sc.voters=[...g.playerIds,...other.playerIds].filter(id=>live(s,s.playerRecords.find(p=>p.playerId===id).characterId));sc.title='Μπροστά στα ίδια μάτια';sc.major=true;sc.kind='merge';meet(s,g,present(s,other));meet(s,other,present(s,g));sc.text=['Μόνο τώρα '+playerNames(s,g).join(' και ')+' συναντούν '+playerNames(s,other).join(' και ')+'. Βρίσκονται στο ίδιο πραγματικό σημείο.','Μπορείτε να ενώσετε ομάδα και εφόδια. Τα καταφύγια θα παραμείνουν ξεχωριστές τοποθεσίες μέχρι να αποφασίσετε πού θα ζήσετε.'];sc.choices=[option('merge','Ένωση ομάδας και κοινή διαχείριση εφοδίων'),option('cooperate','Συνεργασία με ανεξάρτητες ομάδες'),option('separate','Χωριστοί δρόμοι από εδώ και πέρα')];
    }else if(r===12&&g.flags.mergedFrom&&!g.activeShelterId){sc.title='Πού θα μείνουμε μαζί;';sc.kind='jointHome';sc.major=true;const homes=g.shelterIds.filter(h=>s.shelters[h].status!=='destroyed');sc.text=['Το κοινό roster δεν σημαίνει αυτόματα κοινή κατοικία. Οι παλιές βάσεις έχουν ακόμη το δικό τους ιστορικό.', 'Αν μετακομίσετε μαζί, θα ορίσετε ρητά τη νέα κοινή βάση.'];sc.choices=homes.map(h=>option('home:'+h,'Κοινή εγκατάσταση: '+s.shelters[h].name));sc.choices.push(option('keepBases','Κρατήστε τις δύο βάσεις','Προσωρινή πορεία με χωριστές τοποθεσίες.'),option('settleFarm','Επιλέξτε νέα κοινή αγροικία'));
    }else if(r===12&&g.activeShelterId&&g.locationId!==s.shelters[g.activeShelterId].locationId){sc.title='Η βάση περιμένει';sc.text=['Η συνάντηση τελείωσε. Η βάση σου παραμένει στο '+s.shelters[g.activeShelterId].name+'.','Χρειάζεται πραγματική επιστροφή για κοινή διαμονή με όσους έμειναν στη σκοπιά.'];sc.choices=[option('home:'+g.activeShelterId,'Πάρε τον δρόμο επιστροφής στη βάση'),option('evacuate','Εγκατάλειψε τη βάση και συνέχισε στον δρόμο')];
    }else if(r===13&&g.flags.hiddenBite&&live(s,g.flags.hiddenBite)&&s.characters[g.flags.hiddenBite].bitten){sc.title='Το μυστικό ανέβασε πυρετό';sc.kind='bite';sc.major=true;sc.targets=[g.flags.hiddenBite];sc.text=[subjectName(sc.targets[0])+' δεν μπορεί πια να κρύψει τον πυρετό. Το δάγκωμα που αποφάσισες να αποκρύψεις επέστρεψε στην ιστορία.','Όσοι είδαν τη σιωπή σου περιμένουν εξήγηση. Η προηγούμενη επιλογή άλλαξε αυτή τη νύχτα.'];sc.choices=[option('amputate','Επιχείρησε τώρα την επέμβαση'),option('isolate','Απομόνωσε πριν εξαπλωθεί ο κίνδυνος'),option('execute','Πάρε τη θανατηφόρα απόφαση')];
    }else if(r===14&&g.activeShelterId){const home=s.shelters[g.activeShelterId];sc.title='Η πόρτα υποχωρεί';sc.kind='siege';sc.major=true;sc.targets=present(s,g).slice(0,2);sc.text=['Οι μολυσμένοι φτάνουν στο '+home.name+'. Η προηγούμενη οχύρωση και οι σκοπιές έχουν τώρα πραγματική σημασία.','Μια έξοδος παραμένει ανοιχτή. Κάθε σχέδιο σώζει κάτι διαφορετικό.'];sc.choices=[option('defend','DEFEND — υπερασπίσου τη βάση'),option('evacuate','EVACUATE — οριστική εκκένωση'),option('saveSupplies','SAVE SUPPLIES — σώσε τα εφόδια'),option('distract','DISTRACT HORDE — αντιπερισπασμός')];
    }else if(r===15&&!g.activeShelterId){sc.title='Μετά τη φυγή';sc.text=['Η παλιά βάση παραμένει στο ιστορικό. Αν δεν καταστράφηκε, μπορείς να επιστρέψεις, αλλά όχι να σβήσεις όσα συνέβησαν.'];sc.choices=[...g.shelterIds.filter(h=>s.shelters[h].status==='abandoned').map(h=>option('home:'+h,'Επανεγκατάσταση: '+s.shelters[h].name)),option('settleFlat','Επίλεξε νέο διαμέρισμα'),option('evade','Συνέχισε χωρίς βάση')];
    }else if(r===16){sc.major=true;if(ep===6){sc.kind='finale';sc.title='Το τελευταίο πέρασμα';sc.targets=present(s,g).slice(0,2);sc.text=['Η τελευταία έξοδος ανοίγει μόνο για λίγα δευτερόλεπτα. Όσοι βρίσκονται σε άλλη ομάδα δεν εμφανίζονται ξαφνικά εδώ.','Οι ζωντανοί σύμμαχοι, τα τραύματα, τα καταφύγια και οι παλιές επιλογές καθορίζουν ποιος μπορεί να βοηθήσει.'];sc.choices=[option('finalTogether','Περάστε μαζί'),option('finalSacrifice','Κράτησε τον μηχανισμό για τους άλλους'),option('finalEscape','Προστάτευσε πρώτα τη δική σου διαφυγή'),option('finalTrap','Στήσε την τελευταία παγίδα')];}
      else{sc.kind='rescue';sc.targets=shuffle(s,npcs(s,g).filter(n=>!s.characters[n].bitten)).slice(0,2);sc.targets.push(...reserve(s,g,2-sc.targets.length));sc.title='Δύο φωνές στην άκρη';
        if(sc.targets.length===2){sc.text=[sc.targets.join(' και ')+' παγιδεύονται σε αντίθετες πλευρές του περάσματος κοντά στη δική σας διαδρομή.','Η ιστορία τους υπάρχει ήδη από τη συνάντηση. Η διάσωση μπορεί να αφήσει θανάτους, τραύματα, αγνοούμενους ή επιζώντες.'];sc.choices=[option('first','SAVE '+sc.targets[0].toUpperCase()),option('second','SAVE '+sc.targets[1].toUpperCase()),option('both','TRY TO SAVE BOTH','Μεγάλο ρίσκο, καμία εγγύηση.'),option('none',"DON’T INTERVENE",'Αποχώρηση χωρίς βεβαιότητα για τη μοίρα τους.')];}
        else{sc.major=false;sc.kind='story';sc.text=['Το πέρασμα είναι άδειο. Όσοι μπορούσαν να φτάσουν εδώ έχουν ήδη χαθεί ή βρίσκονται αλλού. Δεν εμφανίζονται καινούργια πρόσωπα από το πουθενά.'];sc.choices=[option('guard','Ασφάλισε τη διαδρομή'),option('evade','Φύγε πριν κλείσει')];}}
    }else if(r===17){sc.title='Λίγο πριν το ξημέρωμα';sc.kind='closing';sc.text=['Καταγράφεις όσους επέστρεψαν, όσους χάθηκαν και τις βάσεις που παραμένουν όρθιες.','Οι άλλες ομάδες έχουν τη δική τους καταγραφή. Το επόμενο επεισόδιο θα συνεχίσει από αυτή την κατάσταση.'];sc.choices=[option('close','Κράτησε την καταγραφή της ομάδας')];
    }else if(ep>1&&r<8){const beat=SEASON_BEATS[ep]?.[r];if(beat){sc.title=beat[1];sc.text=['Ακολουθείτε τη διαδρομή προς '+beat[0]+'. Η βάση παραμένει στο ιστορικό σας.',beat[2],beat[3]];travelForScene(s,g,sc,beat[1]);sc.choices=beat[6].map(a=>option(a[0],a[1],a[2],a[3]));if(sc.choices.some(c=>['execute','exile','fight','pair','isolate','heal'].includes(c.effect)||c.effect.startsWith('final'))){sc.major=true;sc.targets=npcs(s,g).slice(0,2);}
      if(sc.choices.some(c=>c.effect==='pair')){sc.targets.push(...reserve(s,g,2-sc.targets.length));if(sc.targets.length===2)sc.kind='rescue';}
      if(sc.choices.some(c=>['heal','isolate','execute'].includes(c.effect))&&!sc.targets.length){sc.targets=reserve(s,g,1);if(sc.targets[0])s.characters[sc.targets[0]].injured=true;}
    }}
    if(!sc.choices.length){const eligible=e=>e.minEpisode<=ep&&(!['bond','betray'].includes(e.kind)||npcs(s,g).length)&&(e.kind!=='shelter'||(g.activeShelterId&&g.locationId===s.shelters[g.activeShelterId].locationId))&&(e.kind!=='supply'||g.inventory.food<12||g.inventory.meds<8)&&(e.kind!=='rescue'||names().some(n=>!s.players.includes(n)&&live(s,n)&&!s.characters[n].groupId&&!s.characters[n].reservedFor&&!s.characters[n].locationId));let pool=SURVIVAL_SCENARIOS.filter(e=>eligible(e)&&!s.usedScenarios.includes(e.id));if(!pool.length)pool=SURVIVAL_SCENARIOS.filter(eligible);const ev=pick(s,pool);if(ev){s.usedScenarios.push(ev.id);sc.eventId=ev.id;sc.title=ev.title;sc.text=[ev.body,'Η απόφαση αφορά μόνο όσους βρίσκονται σε αυτή την ομάδα και σε αυτή την τοποθεσία.'];sc.kind='event';if(!['bond','betray','radio','moral','shelter'].includes(ev.kind)){travelForScene(s,g,sc,ev.title);sc.text.unshift('Μια σύντομη έξοδος στη διαδρομή. Το καταφύγιο παραμένει η βάση επιστροφής, εφόσον είναι διαθέσιμο.');}const map={supply:['supplies','guard','evade'],rescue:['inviteEvent','observe','evade'],horde:['sneak','distract','fight'],rival:['trade','truth','fight'],radio:['radioOnly','investigate','silent'],moral:['share','guard','investigate'],bond:['listen','truth','privacy'],secret:['investigate','supplies','evade'],shelter:['fortify','supplies','evade'],betray:['investigate','truth','exile']};const labels={supplies:'Ψάξε προμήθειες',guard:'Προστάτευσε την ομάδα',evade:'Απομακρύνσου',inviteEvent:'Βοήθησε και πρότεινε κοινή πορεία',observe:'Παρατήρησε από απόσταση',sneak:'Πέρασε αθόρυβα',distract:'Φτιάξε αντιπερισπασμό',fight:'Δώσε μάχη',trade:'Αντάλλαξε τρόφιμα',truth:'Μίλησε ειλικρινά',radioOnly:'Απάντησε χωρίς να δώσεις θέση',investigate:'Ερεύνησε τα ίχνη',silent:'Κράτησε σιωπή',share:'Μοιράσου τρόφιμα',listen:'Άκουσε προσεκτικά',privacy:'Κράτησε ιδιωτικές πληροφορίες',fortify:'Οχύρωσε το καταφύγιο',exile:'Διώξε το ύποπτο μέλος'};sc.choices=(map[ev.kind]||map.supply).map(id=>option(id,labels[id]));if(ev.kind==='rescue'){sc.major=true;sc.kind='encounter';sc.targets=reserve(s,g,1);}}}
    if(sc.kind==='shelter'&&g.activeShelterId&&g.locationId!==s.shelters[g.activeShelterId].locationId&&!g.mission){
      sc.text.push('Βρίσκεστε μακριά από τη βάση. Η επιστροφή χρειάζεται πραγματική μετακίνηση.');
      sc.choices=[option('home:'+g.activeShelterId,'Επίστρεψε στην υπάρχουσα βάση'),option('supplies','Ψάξε προμήθειες στη σημερινή διαδρομή'),option('evacuate','Εγκατάλειψε οριστικά την παλιά βάση')];
    }
    if(sc.kind==='shelter'&&!g.mission&&g.activeShelterId&&g.locationId===s.shelters[g.activeShelterId].locationId){
      sc.choices=sc.choices.filter(c=>c.id!=='mission');
      sc.choices.push(option('mission:none','Εξόρμηση μόνο με τους παίκτες','Οι σύμμαχοι κρατούν τη βάση.'));
      for(const n of npcs(s,g).slice(0,4))sc.choices.push(option('mission:'+n,'Εξόρμηση με '+n,'Η κατάσταση και η εμπιστοσύνη επηρεάζουν τη βοήθεια.'));
    }
    if(sc.choices.some(c=>c.id==='evacuate')){sc.major=true;sc.targets=present(s,g).slice(0,2);}
    if(sc.kind==='encounter'||sc.kind==='rescue'||sc.kind==='bite')for(const n of sc.targets){const bond=link(lead,n);if(bond)sc.text.push(subjectName(n)+' αναγνωρίζει '+lead+'. «Νόμιζα ότι σε έχασα». Ο δεσμός τους — '+bond[2].toLowerCase()+' — κάνει την απόφαση προσωπική.');}
    if(sc.kind==='bite'&&sc.targets[0]&&!s.characters[sc.targets[0]].groupId)sc.choices.forEach(c=>{if(c.id==='hideBite')c.name='Πρόσφερε θέση και κρύψε το δάγκωμα';if(c.id==='amputate')c.name='Επιχείρησε ακρωτηριασμό και πρόσφερε προστασία';});
    if(r===16)sc.text.unshift('Ακολουθείτε τον δρόμο μέχρι τη διάβαση. Όσοι έμειναν σε μακρινή βάση παραμένουν εκεί.');
    if(sc.personal)sc.voters=[actor.playerId];sc.locationId=g.locationId;return sc;
  }
  function scene(s){
    const g=activeGroup(s);if(!g)return null;
    if(s.turn.result&&s.turn.sceneId)return s.scenes[s.turn.sceneId];
    const key=s.episode+':'+s.turn.round+':'+g.groupId;
    if(!s.scenes[key])s.scenes[key]=buildScene(s,g);s.turn.sceneId=key;return s.scenes[key];
  }
  function social(s,g,actor,affinity,trust,reason){for(const n of npcs(s,g)){adjust(s,n,actor,affinity,trust,reason);adjust(s,actor,n,Math.round(affinity*.6),Math.round(trust*.4),reason);}}
  function effect(s,g,sc,c){
    const actor=s.playerRecords.find(p=>p.playerId===sc.actorId).characterId,id=c.effect==='pair'?c.id:(c.effect||c.id),targets=sc.targets.slice(),beforeDead=names().filter(n=>s.characters[n].life==='dead');let text='',affected=targets.slice();
    const spend=(key,n)=>{const enough=g.inventory[key]>=n;g.inventory[key]=Math.max(0,g.inventory[key]-n);return enough;};
    const risk=(p,reason)=>{const n=pick(s,npcs(s,g));if(n&&roll(s)<p){remove(s,n,'dead',reason);affected.push(n);return ' '+subjectName(n)+' δεν επέστρεψε.';}return '';};
    if(id==='supplies'||id==='supply'){g.inventory.food+=2;g.inventory.meds++;g.inventory.materials++;g.danger+=8;text='Βρίσκεις τρόφιμα, επιδέσμους και χρήσιμα υλικά. Η αναζήτηση αφορά τα αποθέματα της δικής σου ομάδας.';}
    else if(id==='searchBond'){const bond=RELATIONS.find(r=>r.includes(actor));g.flags.searchFor=bond?(bond[0]===actor?bond[1]:bond[0]):null;text='Η κλήση δεν δίνει συντεταγμένες. Κρατάς όμως ένα παλιό σημείο συνάντησης και αποφασίζεις να ψάξεις. Κανένας δεν προστίθεται στην ομάδα.';}
    else if(['saveJoin','helpOnly'].includes(id)){const success=roll(s)<.81+support(s,g);g.flags.encounterSurvivors=[];if(success){for(const n of targets){g.flags.encounterSurvivors.push(n);adjust(s,n,actor,18,22,'Επέστρεψε για να με σώσει.');if(id==='saveJoin'&&roll(s)<.92)recruit(s,g,n);else s.characters[n].reservedFor=null;}text='Το μέταλλο υποχωρεί. '+targets.join(' και ')+' περνούν στην ασφαλή πλευρά. '+(id==='saveJoin'?'Όσοι δέχτηκαν την πρότασή σου εμφανίζονται πλέον στη δική σου ομάδα.':'Η διάσωση δεν τους κάνει αυτόματα μέλη.');}else{const lost=targets[0];if(lost)remove(s,lost,roll(s)<.45?'dead':'missing','Η πόρτα υποχώρησε στη διάσωση.');if(targets[1]){s.characters[targets[1]].injured=true;g.flags.encounterSurvivors.push(targets[1]);}text='Η πόρτα πέφτει νωρίτερα. Η διάσωση αποτυγχάνει εν μέρει και η απώλεια δεν αναιρείται.';}g.danger+=10;}
    else if(id==='leaveEncounter'){targets.forEach(n=>{s.characters[n].life='missing';s.characters[n].reservedFor=null;});text='Οι φωνές μένουν πίσω. Καταγράφονται ως αγνοούμενοι, χωρίς επιβεβαιωμένο θάνατο.';}
    else if(['invite','inviteEvent','recruit'].includes(id)){if(!targets.length)targets.push(...reserve(s,g,1));for(const n of targets){const willing=relation(s,n,actor).trust+g.inventory.food*3;if(roll(s)<Math.min(.95,.40+willing/130)){recruit(s,g,n);text+=subjectName(n)+' δέχεται να ακολουθήσει. ';}else{s.characters[n].reservedFor=null;text+=subjectName(n)+' ευχαριστεί για τη βοήθεια, αλλά επιλέγει άλλο δρόμο. ';}}if(!targets.length)text='Δεν βρίσκεις άλλο διαθέσιμο πρόσωπο σε αυτό το σημείο.';}
    else if(id==='settleFarm'||id==='settleFlat'||id.startsWith('home:')){const home=settle(s,g,id==='settleFlat'?'Ψηλό διαμέρισμα · '+playerNames(s,g)[0]:'Παλιά αγροικία · '+playerNames(s,g)[0],id.startsWith('home:')?id.slice(5):null);text=home?'Η ομάδα εγκαθίσταται στο '+home.name+'. Η βάση, οι οχυρώσεις και οι επιστροφές της θα παραμείνουν στο ιστορικό.':'Η βάση δεν είναι πλέον διαθέσιμη.';}
    else if(id==='keepBases'){for(const h of g.shelterIds){s.shelters[h].status='active';}g.flags.keptBases=true;text='Κρατάτε και τις δύο τοποθεσίες. Οι άνθρωποι που έμειναν εκεί παραμένουν εκεί. Θα χρειαστεί ρητή επιλογή βάσης για κοινή εγκατάσταση.';}
    else if(id==='fortify'){const h=s.shelters[g.activeShelterId];const enough=spend('materials',1);if(h&&enough){h.fortification=clamp(h.fortification+22);h.security=clamp(h.security+12);h.history.push('Ενίσχυση εισόδων.');text='Οι είσοδοι ενισχύονται. Η ίδια βάση θα έχει καλύτερη άμυνα στην επόμενη επίθεση.';}else{text=h?'Χωρίς διαθέσιμα υλικά κάνετε μόνο μια μικρή επισκευή.':'Οχυρώνετε ένα προσωρινό πέρασμα, χωρίς να δημιουργείται μόνιμη βάση.';g.security+=5;}}
    else if(id==='mission'||id.startsWith('mission:')){text=departMission(s,g,id==='mission'?undefined:id.slice(8))?'Η εξόρμηση ξεκινά με τα πρόσωπα που επέλεξες. Οι υπόλοιποι μένουν στην υπάρχουσα βάση, με δικό τους πληθυσμό και ιστορικό.':'Δεν μπορεί να ξεκινήσει εξόρμηση χωρίς διαθέσιμη βάση.';}
    else if(id.startsWith('mission')){if(id!=='missionReturn'){g.inventory.food+=id==='missionRisk'?4:2;g.inventory.meds++;if(id==='missionRisk')text+=risk(.16,'Χάθηκε στην εξόρμηση.');}text=(returnMission(s,g)?'Επιστρέφετε στην ίδια ενεργή βάση.':'Ο δρόμος επιστροφής δεν οδηγεί πια σε διαθέσιμη βάση.')+text;}
    else if(id==='amputate'){const n=targets[0],enough=spend('meds',2);if(n&&enough&&roll(s)<.52+support(s,g)+g.security/500){s.characters[n].amputated=true;s.characters[n].injured=true;s.characters[n].bitten=false;if(!s.characters[n].groupId)recruit(s,g,n);adjust(s,n,actor,20,15,'Η επέμβαση μου έσωσε τη ζωή, αλλά έχασα το χέρι μου.');text=subjectName(n)+' επιβιώνει. Το χέρι χάθηκε οριστικά. Η αλλαγή θα ακολουθεί κάθε επόμενο επεισόδιο και επηρεάζει αποστολές και περίθαλψη.';}else{if(n)remove(s,n,'dead','Δεν άντεξε την επέμβαση.');text='Η επέμβαση δεν αρκεί. Η αιμορραγία σταματά μόνο όταν η καρδιά έχει ήδη σωπάσει.';}}
    else if(id==='isolate'){const n=targets[0];if(n)remove(s,n,'missing','Απομονώθηκε με ασύρματο. Η ζωή του δεν έχει επιβεβαιωθεί.');text='Η πόρτα κλείνει με νερό και ασύρματο στην άλλη πλευρά. Η απομόνωση καταγράφεται ως αγνοούμενος, χωρίς βεβαιότητα θανάτου.';}
    else if(id==='hideBite'){const n=targets[0];if(n&&!s.characters[n].groupId)recruit(s,g,n);g.danger+=25;g.flags.hiddenBite=n;text='Το μανίκι κλείνει. Το δάγκωμα παραμένει πραγματικό και αυξάνει την απειλή στο καταφύγιο.';}
    else if(id==='execute'){const n=targets[0]||pick(s,npcs(s,g));if(n){affected.push(n);remove(s,n,'dead','Θανατηφόρα απόφαση της ομάδας.');}social(s,g,actor,-18,-20,'Αντίδραση στη θανατηφόρα απόφαση.');text='Η απόφαση είναι οριστική. Οι επιζώντες δεν μπορούν να προσποιηθούν ότι δεν την είδαν.';}
    else if(id==='offerMeeting'||id==='acceptMeeting'){const target=s.groups[sc.otherGroupId];scheduleMeeting(s,g,target,id==='acceptMeeting');text=id==='acceptMeeting'?'Αποδέχεστε την πρόταση και μετακινείστε στο συμφωνημένο σημείο. Δεν υπάρχει ακόμη κοινή ομάδα.':'Η πρόταση εκπέμπεται. Πηγαίνετε στο σημείο, αλλά δεν γνωρίζετε αν η άλλη ομάδα θα δεχτεί.';}
    else if(id==='merge'){const merged=merge(s,g.groupId,sc.otherGroupId);text=merged?'Οι ομάδες ενώνονται με κοινή απόφαση και κοινά εφόδια. Τα παλιά καταφύγια παραμένουν στο ιστορικό μέχρι να επιλέξετε πού θα ζήσετε μαζί.':'Δεν μπορεί να γίνει ένωση ομάδων που δεν βρίσκονται στο ίδιο σημείο.';}
    else if(id==='cooperate'||id==='separate'||id==='radioOnly'){g.flags.radioContact=true;text='Ανταλλάσσετε όσα συμφωνήσατε. Τα μέλη, οι βάσεις και τα αποθέματα παραμένουν ανεξάρτητα.';}
    else if(id==='split'){const next=split(s,g,sc.actorId);text=next?'Η χωριστή πορεία αρχίζει. Η νέα ομάδα παίρνει το μερίδιο εφοδίων της, χωρίς να αντιγράφονται άνθρωποι ή αποθέματα.':'Αυτή η ομάδα βρίσκεται ήδη σε ανεξάρτητη πορεία.';}
    else if(['defend','evacuate','saveSupplies','distract'].includes(id)){const home=s.shelters[g.activeShelterId];if(id==='evacuate'){abandon(s,g);text='Εκκενώνετε οριστικά. Η βάση παραμένει εγκαταλελειμμένη στον χάρτη.';}else if(id==='saveSupplies'){g.inventory.food+=2;g.inventory.materials++;abandon(s,g,true);text='Μεταφέρετε τα κιβώτια καθώς η φωτιά καταπίνει τη βάση. Η καταστροφή είναι μόνιμη.';}else{const enough=id!=='distract'||spend('food',1);const success=home&&roll(s)<clamp(.30+home.fortification/180+home.security/240+support(s,g)+(enough?.1:0),.08,.94);if(success){home.fortification=clamp(home.fortification-18);home.security=clamp(home.security-12);home.history.push('Η βάση άντεξε την επίθεση.');text='Η βάση αντέχει, με ορατές ζημιές. Η επόμενη επισκευή θα ξεκινήσει από αυτές τις τιμές.';}else{abandon(s,g,true);text='Η άμυνα υποχωρεί. Η βάση καταστρέφεται και η ομάδα αναγκάζεται να αναζητήσει νέο καταφύγιο.'+risk(.23,'Χάθηκε στην πτώση του καταφυγίου.');}}}
    else if(['first','second','both','none','pair'].includes(id)){const pair=targets.length===2?targets:shuffle(s,npcs(s,g)).slice(0,2);const saved=[];for(let i=0;i<pair.length;i++){const n=pair[i],selected=id==='both'||(id==='first'&&i===0)||(id==='second'&&i===1);let outcome=roll(s);if(selected&&outcome<clamp(.52+g.security/230+support(s,g)-(id==='both'?.20:0),.15,.92)){recruit(s,g,n,'Με τράβηξε από το πέρασμα.');saved.push(n);text+=subjectName(n)+' σώζεται. ';}else if(outcome<.26){remove(s,n,'dead','Χάθηκε στο πέρασμα.');text+=subjectName(n)+' πεθαίνει στο πέρασμα. ';}else if(outcome<.68){remove(s,n,'missing','Χάθηκε πίσω από τον καπνό.');text+=subjectName(n)+' χάνεται πίσω από τον καπνό. ';}else{s.characters[n].injured=true;if(selected)recruit(s,g,n);else{g.members=g.members.filter(x=>x!==n);s.characters[n].groupId=null;s.characters[n].shelterId=null;s.characters[n].reservedFor=null;}text+=subjectName(n)+' επιβιώνει με τραύμα'+(selected?' και επιστρέφει. ':' αλλά απομακρύνεται. ');}}g.flags.rescued=(g.flags.rescued||[]).concat(saved);for(const n of pair)for(const p of playerNames(s,g)){if(link(p,n)&&!saved.includes(n)){adjust(s,p,n,-18,-22,'Το δίλημμα της διάσωσης άφησε βαθιά απώλεια.');g.flags.grief={lost:n,witness:p};text+=' Η σχέση '+p+' — '+n+' κάνει την απόφαση προσωπική.';}}}
    else if(id.startsWith('final')){const prep=g.security/350+support(s,g)+g.inventory.meds/150+(g.activeShelterId?.08:0);const riskLevel=id==='finalSacrifice'?.72:id==='finalEscape'?.18:.38;const lead=actor;if(roll(s)<clamp(riskLevel-prep,.06,.85)){remove(s,lead,'dead','Έπεσε στην τελική απόφαση.');affected.push(lead);text=subjectName(lead)+' κρατά τη θέση μέχρι να κλείσει το πέρασμα. Δεν επιστρέφει.';}else{text=subjectName(lead)+' περνά ζωντανά από τη Γραμμή. Οι προηγούμενες προετοιμασίες απέκτησαν νόημα.';}if(id==='finalEscape')text+=risk(.44,'Έμεινε πίσω στην τελική απόδραση.');g.flags.ending=id;}
    else if(id==='heal'||id==='rest'){const enough=g.inventory.meds>0;if(enough)spend('meds',1);present(s,g).concat(targets).forEach(n=>{if(enough)s.characters[n].injured=false;});social(s,g,actor,7,5,'Προσέφερε χρόνο για φροντίδα.');text='Η ομάδα φροντίζει όσους έχουν τραυματιστεί. Ένας ακρωτηριασμός παραμένει μόνιμος· η περίθαλψη δεν αποκαθιστά το χαμένο άκρο.';}
    else if(id==='reunite'){const n=pick(s,names().filter(n=>s.characters[n].life==='missing'&&s.characters[n].discoveredBy.some(p=>playerNames(s,g).includes(p))));if(n&&roll(s)<.66){s.characters[n].life='alive';s.characters[n].locationId=g.locationId;recruit(s,g,n,'Η ομάδα ακολούθησε το ίχνος μου.');affected.push(n);text=subjectName(n)+' επιστρέφει μετά από την αναζήτηση. Ήταν αγνοούμενος άνθρωπος, χωρίς επιβεβαιωμένο θάνατο.';}else{text='Ακολουθείτε τα σημάδια, αλλά κανένας αγνοούμενος δεν επιστρέφει από αυτή την αναζήτηση.';}}
    else if(id==='guard'||id==='store'){g.security+=10;const h=s.shelters[g.activeShelterId];if(h&&g.locationId===h.locationId){h.security=clamp(h.security+12);h.history.push('Οργάνωση σκοπιάς και αποθεμάτων.');}text='Η σκοπιά προστατεύει τη διαδρομή και, όταν βρίσκεστε στη βάση, ενισχύει την πραγματική ασφάλειά της.';}
    else if(id==='exile'||id==='isolateOther'){const n=targets[0]||pick(s,npcs(s,g));if(n){affected.push(n);remove(s,n,'missing','Απομακρύνθηκε από την ομάδα.');}text='Το πρόσωπο που απομακρύνθηκε παραμένει αγνοούμενο. Η ιστορία δεν το θεωρεί νεκρό.';}
    else if(id==='trade'||id==='share'){const enough=spend('food',1);social(s,g,actor,enough?10:0,enough?7:-2,'Η απόφαση για μοίρασμα τροφής.');text=enough?'Δίνεις από τα πραγματικά αποθέματα της ομάδας. Όσοι σε είδαν θυμούνται.':'Δεν υπάρχει αρκετό φαγητό. Η πρόθεση δεν γεμίζει άδεια χέρια.';}
    else if(id==='fight'){g.danger+=18;g.security-=6;text='Η σύγκρουση ανοίγει πέρασμα με μεγάλο κόστος.'+risk(.24,'Σκοτώθηκε σε σύγκρουση.');}
    else if(id==='listen'||id==='bond'||id==='protect'){social(s,g,actor,13,7,'Άκουσε χωρίς να διακόψει.');text='Η συζήτηση αλλάζει το πώς σε βλέπουν όσοι βρίσκονταν εδώ. Η εμπιστοσύνη άλλου παίκτη δεν αντιγράφεται.';}
    else if(id==='truth'){social(s,g,actor,3,13,'Μίλησε ειλικρινά για τον κίνδυνο.');g.flags.evidence=(g.flags.evidence||0)+1;text='Η αλήθεια φέρνει εμπιστοσύνη, χωρίς να σημαίνει ότι όλοι αισθάνονται πιο κοντά σου.';}
    else if(id==='privacy'){social(s,g,actor,-3,-7,'Κράτησε πληροφορίες για τον εαυτό του.');text='Η ιδιωτική πληροφορία παραμένει στη δική σου πλευρά της ιστορίας.';}
    else if(id==='investigate'){g.flags.evidence=(g.flags.evidence||0)+1;g.security+=5;text='Καταγράφεις στοιχεία για τη δική σου διαδρομή. Η πληροφορία θα επηρεάσει επόμενα διλήμματα.';}
    else if(id==='close'){text='Η καταγραφή κλείνει με πραγματικά μέλη, πληγές, βάσεις και επιλογές.';}
    else{g.security+=6;g.danger-=6;text='Διαλέγεις προσεκτική πορεία. Η κατάσταση των άλλων ομάδων δεν αλλάζει.';}
    if(g.flags.hiddenBite&&live(s,g.flags.hiddenBite)&&sc.kind==='siege')g.danger+=15;
    for(const k of Object.keys(g.inventory))g.inventory[k]=clamp(g.inventory[k],0,999);g.security=clamp(g.security);g.danger=clamp(g.danger);
    for(const n of npcs(s,g)){if(relation(s,n,actor).trust<15&&roll(s)<.4){remove(s,n,'missing','Έφυγε επειδή χάθηκε η εμπιστοσύνη.');text+=' '+subjectName(n)+' επιλέγει να φύγει από την ομάδα.';}}
    if(sc.returnLocationId&&!g.archived){const returning=present(s,g);g.locationId=sc.returnLocationId;const home=s.shelters[g.activeShelterId];returning.forEach(n=>{s.characters[n].locationId=g.locationId;s.characters[n].shelterId=home&&home.status==='active'&&home.locationId===g.locationId?home.shelterId:null;});}
    const deaths=names().filter(n=>s.characters[n].life==='dead'&&!beforeDead.includes(n));return {heading:deaths.length?'ΜΙΑ ΖΩΗ ΧΑΘΗΚΕ':sc.major?'Η ΑΠΟΦΑΣΗ ΑΦΗΣΕ ΣΗΜΑΔΙ':'Η ΙΣΤΟΡΙΑ ΣΥΝΕΧΙΖΕΤΑΙ',text,affected:[...new Set(affected.concat(deaths))],deaths,major:sc.major,choice:c.name};
  }
  function choose(s,index){
    if(s.phase!=='story'||s.turn.result||s.pendingCinematic)return false;const sc=scene(s),c=sc?.choices[index];if(!c||!Number.isInteger(index))return false;
    const voter=sc.voters[s.turn.votes.length];if(!voter)return false;s.turn.votes.push({playerId:voter,index});if(s.turn.votes.length<sc.voters.length)return true;
    const counts={};s.turn.votes.forEach(v=>counts[v.index]=(counts[v.index]||0)+1);const best=Math.max(...Object.values(counts)),winners=Object.keys(counts).filter(k=>counts[k]===best).map(Number),winner=pick(s,winners);const decisionGroupLabel=label(s,s.groups[sc.groupId]);const result=effect(s,s.groups[sc.groupId],sc,sc.choices[winner]);
    s.decisions.push({episode:s.episode,round:s.turn.round,groupId:sc.groupId,groupLabel:decisionGroupLabel,locationId:sc.locationId,actorId:sc.actorId,votes:copy(s.turn.votes),title:sc.title,choice:sc.choices[winner].name,outcome:result.text,major:sc.major,targets:sc.targets.slice()});s.turn.result=result;s.turn.votes=[];
    if(sc.major||result.deaths.length)s.pendingCinematic=copy(result);return true;
  }
  function dismissCinematic(s){s.pendingCinematic=null;}
  function advance(s){
    if(s.phase!=='story'||!s.turn.result||s.pendingCinematic)return false;s.turn.result=null;s.turn.votes=[];s.turn.sceneId=null;s.turn.queueIndex++;
    while(s.turn.queueIndex<s.turn.queue.length&&!playableGroups(s).some(g=>g.groupId===s.turn.queue[s.turn.queueIndex]))s.turn.queueIndex++;
    if(s.turn.queueIndex>=s.turn.queue.length){s.turn.round++;if(s.turn.round>=18||!playableGroups(s).length){s.phase='report';return true;}resetQueue(s);}else{s.turn.groupId=s.turn.queue[s.turn.queueIndex];}return true;
  }
  function advanceEpisode(s){if(s.phase!=='report'||s.episode>=6)return false;s.episode++;s.phase='intro';s.turn.round=0;s.pendingCinematic=null;resetQueue(s);SpiritIntro.capture(s);return true;}
  function introActors(s){return SpiritIntro.snapshot(s).actors;}
  return {create,copy,roll,pick,groups,activeGroup,activePlayer,playerNames,present,npcs,label,location,scene,choose,advance,advanceEpisode,dismissCinematic,meet,recruit,remove,settle,abandon,departMission,returnMission,merge,split,relation,adjust,introActors,live};
})();
