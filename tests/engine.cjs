const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const memory=new Map();
const node={innerHTML:'',textContent:'',addEventListener(){},classList:{add(){},remove(){}}};
const ctx=vm.createContext({console,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
  localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},
  document:{querySelector:()=>node,addEventListener(){},title:'',body:node},
  window:{addEventListener(){},scrollTo(){}},navigator:{},location:{protocol:'file:',hostname:''}});
for(const name of ['character-data.js','save-validation.js','scenarios.js','episodes.js','app.js','season.js']){
  let code=fs.readFileSync(path.join(root,name),'utf8');
  if(name==='season.js')code=code.replace(/enhanceHeader\(\);\s*render\(\);/,'globalThis.engine={nextEpisode,validSnapshot,normalize};showDeaths=function(){};');
  vm.runInContext(code,ctx,{filename:name});
}
const run=code=>vm.runInContext(code,ctx);
run('render=function(){};goTop=function(){};');
let decisions=0,episodes=0;
for(let players=1;players<=3;players++){
  for(let seed=1;seed<=100;seed++){
    run(`setup={count:${players},selected:ROSTER.slice(0,${players}).map(c=>c.name)};s=null;newRun();s.seed=${seed};s.phase='story';`);
    for(let guard=0;guard<500;guard++){
      const phase=run('s.phase');
      if(phase==='report'){
        episodes++;
        assert(run('engine.validSnapshot(JSON.parse(JSON.stringify(s)))'),'completed state must load');
        if(run('s.episode===6'))break;
        run("engine.nextEpisode();s.phase='story';");continue;
      }
      if(run('!!s.result')){run('nextScene()');continue;}
      if(process.env.FIXTURE_PATH&&players===3&&seed===1&&run('s.episode===1&&s.step===7&&!s.activeScenario')){
        run('scene();save();');fs.writeFileSync(process.env.FIXTURE_PATH,run('JSON.stringify(s,null,2)'));
      }
      const before=run('JSON.stringify(scene())');
      const stable=run('s.seed');
      for(let i=0;i<4;i++)assert.equal(run('JSON.stringify(scene())'),before,'scene must not reroll');
      assert.equal(run('s.seed'),stable,'reading scene must not consume RNG');
      run('save();s=JSON.parse(localStorage.getItem(KEY));engine.normalize();');
      assert.equal(run('JSON.stringify(scene())'),before,'save/load must preserve scene');
      if(!run('engine.validSnapshot(s)')){fs.writeFileSync(path.join(process.cwd(),'invalid-state.json'),run('JSON.stringify(s,null,2)'));throw new Error(`Invalid active state: players=${players}, seed=${seed}, guard=${guard}`);}
      const index=(seed+guard)%run('scene().choices.length');
      const old=run('s.decisions.length');
      run(`choose(${index})`);
      if(players>1&&run('s.phase')==='story'&&!run('s.result')){
        assert.equal(run('s.decisions.length'),old,'first vote cannot resolve group choice');
      }
      for(let voter=1;voter<players&&run('s.phase')==='story'&&!run('s.result');voter++)run(`choose(${index})`);
      decisions+=run('s.decisions.length')-old;
      assert(run('Object.keys(s.status).every(n=>ROSTER.some(c=>c.name===n))'),'no invented characters');
      if(guard===499)throw new Error('Run failed to finish');
    }
  }
}
run("setup={count:1,selected:['Alex']};s=null;newRun();s.phase='story';scene();");
for(const mutation of ["bad.players=['Alex','Alex']","bad.resources.food='three'","bad.seed=0","bad.step=1.5","bad.flags.evil='<img src=x onerror=alert(1)>'","bad.status.Ghost='group'","delete bad.votes","bad.decisions=[{}]"]){
  run('globalThis.bad=JSON.parse(JSON.stringify(s));'+mutation);
  assert.equal(run('engine.validSnapshot(bad)'),false,'reject '+mutation);
}
console.log(`PASS: 300 seeded playthroughs, ${episodes} episodes, ${decisions} decisions; stable scenes/save-load, voting and invalid imports.`);
