/* Episode credits are historical snapshots, not a view of today's party. */
const SpiritIntro = (function(){
  'use strict';
  const AUDIO='assets/audio/intro-music-apocalypse.mp3',START=54,END=90,DURATION=90,FIRST_CREDIT=11;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const known=n=>Object.prototype.hasOwnProperty.call(characterGenders,n);
  function eligible(state){
    if(state.version===2){
      const players=state.players.filter(n=>state.characters[n]?.life==='alive');
      const cast=state.episode===1?[]:Object.keys(state.characters).filter(n=>!state.players.includes(n)&&state.characters[n].life==='alive'&&state.characters[n].groupId&&!state.groups[state.characters[n].groupId]?.archived&&(!state.characters[n].joinedEpisode||state.characters[n].joinedEpisode<state.episode));
      return {players,actors:players.concat(cast)};
    }
    const players=state.players.filter(n=>state.status[n]!=='dead');
    const cast=(state.episode||1)===1?[]:Object.keys(state.status).filter(n=>!players.includes(n)&&['group','wounded','bitten'].includes(state.status[n]));
    return {players,actors:players.concat(cast)};
  }
  function capture(state){
    const episode=state.episode||1;state.introSnapshots=state.introSnapshots||{};
    if(!state.introSnapshots[episode])state.introSnapshots[episode]={episode,...eligible(state)};
    return copy(state.introSnapshots[episode]);
  }
  function snapshot(state,episode=state.episode||1){
    if(!Number.isInteger(episode)||episode<1||episode>(state.episode||1))throw Error('Unavailable episode');
    if(state.introSnapshots?.[episode])return {...copy(state.introSnapshots[episode]),historical:true};
    // Old saves have no reliable opening-era NPC roster. Never invent one from
    // later discoveries, deaths or today's group composition.
    const players=state.players.filter(known);
    return {episode,players:players.slice(),actors:players.slice(),historical:episode===1};
  }
  function plan(state,episode=state.episode||1,duration=DURATION){
    const cast=snapshot(state,episode),end=Math.min(END,duration),total=(end-START)*1000;
    if(!Number.isFinite(total)||total<24000)throw Error('Intro audio is too short');
    const library=['railway-platform.webp','flooded-underpass.webp','radio-tower.webp','city-dawn.webp','clinic-dusk.webp','forest-road.webp'];
    // Rotate the establishing shots per episode without consuming the game's RNG.
    const offset=(episode-1)%library.length;
    const scenic=library.map((_,i)=>'assets/cinematic/'+library[(i+offset)%library.length]);
    const shots=[{type:'presents',ms:3500},{type:'landscape',ms:3500,image:scenic[0],super:'',line:''},{type:'landscape',ms:4000,image:scenic[1],super:'',line:''}];
    cast.players.forEach((name,i)=>shots.push({type:'cast',ms:3000,name,castIndex:i,credit:'STARRING',relation:''}));
    const supporting=cast.actors.filter(n=>!cast.players.includes(n));
    const tail=8300,used=shots.reduce((n,shot)=>n+shot.ms,0),available=total-used-tail;
    if(supporting.length){
      // One portrait per shot, even for a full cast. Music stays 0:54–1:30.
      const frame=Math.min(3000,available/supporting.length);
      supporting.forEach((name,i)=>shots.push({type:'cast',ms:frame,name,castIndex:cast.players.length+i,credit:'STARRING',relation:''}));
    }
    const padding=total-shots.reduce((n,shot)=>n+shot.ms,0)-tail;
    if(padding>.001){const count=Math.max(1,Math.ceil(padding/4200));for(let i=0;i<count;i++)shots.push({type:'landscape',ms:padding/count,image:scenic[i+2],super:'',line:''});}
    shots.push({type:'logo',ms:6500},{type:'episode',ms:1800,episode});
    let cursor=0;shots.forEach(shot=>{shot.at=cursor;cursor+=shot.ms;});
    return {episode,audio:AUDIO,start:START,end,duration,total,firstCredit:FIRST_CREDIT,cast,shots};
  }
  function shotAt(plan,elapsed){let index=plan.shots.length-1;for(let i=0;i<plan.shots.length;i++){if(elapsed<plan.shots[i].at+plan.shots[i].ms){index=i;break;}}return index;}
  function validSnapshots(state){
    if(state.introSnapshots===undefined)return true;
    const all=state.introSnapshots;if(!Array.isArray(state.players)||!all||typeof all!=='object'||Array.isArray(all)||Object.keys(all).length>6)return false;
    return Object.entries(all).every(([key,value])=>{const episode=Number(key);return Number.isInteger(episode)&&String(episode)===key&&episode>=1&&episode<=(state.episode||1)&&value&&value.episode===episode&&Array.isArray(value.players)&&value.players.length>=1&&value.players.length<=3&&value.players.every(n=>state.players.includes(n))&&new Set(value.players).size===value.players.length&&Array.isArray(value.actors)&&value.actors.length<=26&&value.actors.every(known)&&new Set(value.actors).size===value.actors.length&&value.players.every((n,i)=>value.actors[i]===n)&&(episode!==1||value.actors.length===value.players.length);});
  }
  return {AUDIO,START,END,DURATION,FIRST_CREDIT,capture,snapshot,plan,shotAt,validSnapshots};
})();
