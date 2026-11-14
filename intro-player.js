/* The media clock owns the edit: buffering never advances credits ahead of audio. */
(function(){
  'use strict';
  const oldStop=stopOpening,oldShot=renderOpeningShot;
  const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function paint(shot){
    if(shot.type==='cast-group'){
      const viewport=document.querySelector('#cinema-viewport');
      viewport.innerHTML='<div class="intro-shot cinema-support"><div class="cinema-support-grid" data-count="'+shot.names.length+'">'+shot.names.map(name=>'<div class="cinema-support-person">'+image(name)+'<span>STARRING</span><h2>'+escape(name)+'</h2></div>').join('')+'</div></div>';
    }else if(shot.type==='episode'){
      document.querySelector('#cinema-viewport').innerHTML='<div class="intro-shot cinema-episode-card"><div class="cinema-episode-bg"></div><span>SEASON ONE</span><strong></strong><h2></h2><p></p><div class="cinema-start-signal">YOUR STORY BEGINS NOW ···</div></div>';
    }else oldShot(shot);
    if(shot.type==='episode'){
      const card=document.querySelector('.cinema-episode-card');
      card.querySelector('strong').textContent='EPISODE '+String(opening.episode).padStart(2,'0');
      card.querySelector('h2').textContent=opening.episode===1?'DAY ZERO':opening.episode===6?'THE LAST DAY':'THE NEXT CHAPTER';
      card.querySelector('p').textContent=EPISODES[opening.episode-1];
    }
  }
  stopOpening=function(continueStory){
    if(!opening?.mediaDriven){oldStop(continueStory);return;}
    const current=opening;opening=null;cancelAnimationFrame(current.frame);current.audio.pause();current.audio.removeAttribute('src');current.audio.load();
    document.querySelector('#cinema-overlay')?.remove();document.body.classList.remove('cinema-lock');
    current.inertNodes.forEach(([node,previous])=>{node.inert=previous;});
    if(continueStory&&!current.replay&&s){s.phase='story';save();render();goTop();}
    else if(continueStory&&current.replay){if(current.resumeAmbient)window.SpiritSeason?.startAmbient();current.returnFocus?.focus();}
  };
  function start({source=s,episode=source?.episode||1,replay=false}={}){
    if(!source?.players?.length)return;
    stopOpening(false);window.SpiritSeason?.stopAmbient();
    const overlay=document.createElement('section');overlay.id='cinema-overlay';overlay.className='cinema-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Intro επεισοδίου '+episode);overlay.innerHTML=openingMark();
    const hud=overlay.querySelector('.cinema-hud>div');hud.innerHTML='<span class="red-dot">●</span> S01 // EP'+String(episode).padStart(2,'0');
    overlay.querySelector('.cinema-bottomline span:last-child').textContent='INTRO THEME';
    overlay.insertAdjacentHTML('beforeend','<button type="button" class="cinema-audio-start" hidden>▶ ΕΝΑΡΞΗ ΜΟΥΣΙΚΗΣ</button>');
    const returnFocus=document.activeElement,resumeAmbient=!!app.querySelector('.camp-game,.game')&&s?.phase==='story';
    const audio=new Audio(SpiritIntro.AUDIO+'#t='+SpiritIntro.START+','+SpiritIntro.END);audio.preload='auto';audio.volume=.85;audio.muted=!soundtrackEnabled;audio.loop=false;
    const current={mediaDriven:true,audio,replay,episode,source,plan:SpiritIntro.plan(source,episode),frame:null,shown:-1,returnFocus,resumeAmbient};opening=current;
    current.inertNodes=[app,document.querySelector('.global-header'),document.querySelector('.global-footer')].filter(Boolean).map(node=>{const previous=node.inert;node.inert=true;return [node,previous];});
    document.body.append(overlay);document.body.classList.add('cinema-lock');
    const begin=overlay.querySelector('.cinema-audio-start');
    function requestPlay(){try{if(audio.currentTime<SpiritIntro.START)audio.currentTime=SpiritIntro.START;}catch(e){}audio.play().then(()=>{if(opening===current)begin.hidden=true;}).catch(()=>{if(opening===current){begin.textContent='▶ ΕΝΑΡΞΗ ΜΟΥΣΙΚΗΣ';begin.hidden=false;}});}
    audio.addEventListener('loadedmetadata',()=>{
      if(opening!==current)return;
      try{current.plan=SpiritIntro.plan(source,episode,audio.duration);if(audio.currentTime<SpiritIntro.START)audio.currentTime=SpiritIntro.START;}catch(e){begin.textContent='Ο ΗΧΟΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΘΕΣΙΜΟΣ · ΔΟΚΙΜΑΣΕ ΞΑΝΑ';begin.hidden=false;}
    });
    audio.addEventListener('ended',()=>{if(opening===current)stopOpening(true);});
    function checkEnd(){if(opening===current&&audio.currentTime>=current.plan.end-.001)stopOpening(true);}
    audio.addEventListener('timeupdate',checkEnd);audio.addEventListener('pause',checkEnd);
    audio.addEventListener('error',()=>{if(opening===current){begin.textContent='↻ ΔΟΚΙΜΑΣΕ ΞΑΝΑ ΤΟΝ ΗΧΟ';begin.hidden=false;}});
    begin.onclick=()=>{if(audio.error)audio.load();requestPlay();};
    overlay.addEventListener('click',e=>{const button=e.target.closest('[data-cinema]');if(!button)return;if(button.dataset.cinema==='skip')stopOpening(true);if(button.dataset.cinema==='sound'){soundtrackEnabled=!soundtrackEnabled;safeSet('spirit-apocalypse-sound',soundtrackEnabled?'on':'off');audio.muted=!soundtrackEnabled;button.textContent=soundtrackEnabled?'♫ SOUND ON':'♫ SOUND OFF';const header=document.querySelector('#game-sound');if(header)header.textContent=soundtrackEnabled?'♫ ON':'♫ OFF';}});
    function tick(){if(opening!==current)return;if(audio.currentTime>=current.plan.end){stopOpening(true);return;}const elapsed=Math.max(0,(audio.currentTime-SpiritIntro.START)*1000),index=SpiritIntro.shotAt(current.plan,elapsed);if(index!==current.shown){current.shown=index;paint(current.plan.shots[index]);}const bar=document.querySelector('#cinema-progress-fill');if(bar)bar.style.width=Math.min(100,elapsed/current.plan.total*100)+'%';current.frame=requestAnimationFrame(tick);}
    requestPlay();tick();overlay.querySelector('[data-cinema="skip"]').focus();
  }
  playOpening=function(){start();};
  openingShots=function(){return SpiritIntro.plan(s).shots;};
  function openReplay(source=s){
    if(!source?.players?.length||opening)return;
    document.querySelector('#intro-replay-menu')?.remove();
    const dialog=document.createElement('dialog');dialog.id='intro-replay-menu';dialog.className='camp-dialog';dialog.setAttribute('aria-labelledby','replay-title');
    dialog.innerHTML='<div class="save-top"><div><div class="eyebrow">'+escape(source.players.join(' · '))+'</div><h2 id="replay-title">REPLAY INTRO</h2></div><button type="button" class="save-x" data-close aria-label="Κλείσιμο">✕</button></div><p>Διάλεξε επεισόδιο από αυτό το save. Η πρόοδος και οι επιλογές σου θα μείνουν όπως είναι.</p><label class="camp-select">ΕΠΕΙΣΟΔΙΟ <select id="replay-episode">'+Array.from({length:source.episode||1},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===(source.episode||1)?'selected':'')+'>0'+(i+1)+' — '+escape(EPISODES[i])+'</option>').join('')+'</select></label><p class="intro-history-note"></p><button type="button" class="btn primary intro-replay-play">▶ ΠΡΟΒΟΛΗ INTRO</button>';
    const select=dialog.querySelector('#replay-episode'),note=dialog.querySelector('.intro-history-note');
    function update(){note.textContent=SpiritIntro.snapshot(source,Number(select.value)).historical?'':'Σε αυτό το παλιό save δεν είχαν κρατηθεί τα αρχικά credits του επεισοδίου. Προβάλλονται μόνο οι επιλεγμένοι πρωταγωνιστές.';}select.onchange=update;update();
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('.intro-replay-play').onclick=()=>{const episode=Number(select.value);dialog.remove();start({source,episode,replay:true});};document.body.append(dialog);dialog.showModal();
  }
  window.SpiritIntroUI={openReplay,start};
  const button=document.createElement('button');button.type='button';button.id='game-replay';button.className='top-control';button.textContent='▶ INTRO';button.setAttribute('aria-label','Replay Intro από το save');button.onclick=()=>openReplay();document.querySelector('.header-right').append(button);
  function refresh(){button.disabled=!s?.players?.length;}
  const observer=new MutationObserver(refresh);observer.observe(app,{childList:true,subtree:true});refresh();
})();
