/* Shared by autosave and manual JSON import. No DOM dependencies. */
function validGameSnapshot(raw){
  const names=['Alex','Billy','Catherine','Demarin','Elisa','Ester','Eva','Evaggelia','Evelyn','Hope','Ian','Irene','Jasmine','Luna','Paul','Pauline','Phillip','Rino','Sargenie','Smaragda','Sorina','Tony','Vicky','Vincent','Violet','Zoe'];
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(!object(raw)||raw.version!==1||!Array.isArray(raw.players)||raw.players.length<1||raw.players.length>3)return false;
  if(new Set(raw.players).size!==raw.players.length||!raw.players.every(n=>names.includes(n)))return false;
  if(!Number.isInteger(raw.step)||!number(raw.step,0,8)||!['story','report','intro'].includes(raw.phase))return false;
  if(!Number.isInteger(raw.seed)||!number(raw.seed,-2147483648,4294967295)||raw.seed===0)return false;
  if(raw.episode!==undefined&&(!Number.isInteger(raw.episode)||!number(raw.episode,1,6)))return false;
  if(!object(raw.status)||!Object.entries(raw.status).every(([n,v])=>names.includes(n)&&['group','dead','missing','bitten','wounded'].includes(v)))return false;
  if(!raw.players.every(n=>raw.status[n]))return false;
  if(!object(raw.resources)||!number(raw.resources.food,0,6)||!number(raw.resources.meds,0,6)||!number(raw.resources.security,0,5)||!number(raw.danger,1,6))return false;
  if(!object(raw.trust)||!Object.entries(raw.trust).every(([n,v])=>names.includes(n)&&number(v,0,100)))return false;
  if(!object(raw.flags)||!Array.isArray(raw.decisions)||!raw.decisions.every(d=>object(d)&&typeof d.choice==='string'))return false;
  if(!Array.isArray(raw.votes)||raw.votes.length>=raw.players.length||!raw.votes.every(v=>Number.isInteger(v)&&number(v,0,9)))return false;
  if(!Array.isArray(raw.rescueTargets)||raw.rescueTargets.length>2||!raw.rescueTargets.every(n=>names.includes(n)))return false;
  if(raw.notices!==undefined&&(!Array.isArray(raw.notices)||!raw.notices.every(v=>typeof v==='string')))return false;
  if(raw.result!==null&&raw.result!==undefined&&(!object(raw.result)||typeof raw.result.text!=='string'||typeof raw.result.heading!=='string'))return false;
  const cachedScene=v=>object(v)&&Array.isArray(v.text)&&v.text.every(x=>typeof x==='string')&&
    (!v.dialogue||(object(v.dialogue)&&typeof v.dialogue.who==='string'&&typeof v.dialogue.text==='string'))&&
    Array.isArray(v.choices)&&v.choices.length>0&&v.choices.every(c=>object(c)&&['id','name','hint'].every(k=>typeof c[k]==='string'));
  if(raw.sceneCache!==undefined&&(!object(raw.sceneCache)||!Object.values(raw.sceneCache).every(cachedScene)))return false;
  for(const key of ['foundFamily','accused','exiled','isolated','bridgeUnknown']){
    if(raw.flags[key]!==undefined&&(!Array.isArray(raw.flags[key])||!raw.flags[key].every(n=>names.includes(n))))return false;
  }
  if(raw.flags.grief!==undefined&&(!Array.isArray(raw.flags.grief)||!raw.flags.grief.every(v=>object(v)&&names.includes(v.witness)&&names.includes(v.lost))))return false;
  if(raw.flags.rescuePairs!==undefined&&(!object(raw.flags.rescuePairs)||!Object.values(raw.flags.rescuePairs).every(v=>Array.isArray(v)&&v.length===2&&v[0]!==v[1]&&v.every(n=>names.includes(n)))))return false;
  if(raw.injected!==undefined&&!object(raw.injected))return false;
  if(raw.usedScenarios!==undefined&&(!Array.isArray(raw.usedScenarios)||!raw.usedScenarios.every(Number.isInteger)))return false;
  if(raw.activeScenario!=null&&(!Number.isInteger(raw.activeScenario)||raw.activeScenario<1||raw.activeScenario>100))return false;
  // Saves contain authored emphasis, never scripts, styles or attributes.
  const safe=(value,depth)=>{
    if(depth>30)return false;
    if(typeof value==='string')return !/<|&#(?:x0*3c|0*60);?/i.test(value.replace(/<\/?(?:strong|b|em|i)>|<br\s*\/?\s*>/gi,''));
    if(value&&typeof value==='object')return Object.entries(value).every(([key,v])=>!['__proto__','prototype','constructor'].includes(key)&&safe(v,depth+1));
    return true;
  };
  try{return JSON.stringify(raw).length<=800000&&safe(raw,0);}catch(e){return false;}
}
