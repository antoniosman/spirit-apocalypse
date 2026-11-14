/* Scoped installation and update UI. iOS provides a manual Add to Home Screen flow. */
(function(){
  'use strict';
  let deferredPrompt=null,installed=false,registration=null,reloading=false,checking=false,pendingUpdate=false,lastCheck=0;
  let hadController=!!navigator.serviceWorker?.controller;
  const standalone=window.matchMedia('(display-mode: standalone)');
  const button=document.querySelector('#game-install');
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isInstalled=()=>installed||standalone.matches||navigator.standalone===true;
  function refresh(){
    if(!button)return;
    button.hidden=isInstalled();
    button.textContent=deferredPrompt?'⬇ ΕΓΚΑΤΑΣΤΑΣΗ':'⬇ INSTALL APP';
    button.setAttribute('aria-label','Εγκατάσταση The Spirit Apocalypse');
  }
  function help(){
    if(document.querySelector('#install-help'))return;
    const layer=document.createElement('dialog');layer.className='install-help';layer.id='install-help';
    const secure=window.isSecureContext;
    const steps=!secure?'<p>Για εγκατάσταση, άνοιξε το παιχνίδι από τον online σύνδεσμό του.</p>':ios?
      '<ol><li>Άνοιξε το παιχνίδι στο <strong>Safari</strong>.</li><li>Πάτησε <strong>Κοινή χρήση ↑</strong>.</li><li>Επίλεξε <strong>Προσθήκη στην οθόνη αφετηρίας</strong> και μετά <strong>Προσθήκη</strong>.</li></ol>':
      '<ol><li>Άνοιξε το παιχνίδι σε <strong>Chrome ή Edge</strong>.</li><li>Από το μενού ⋮ επίλεξε <strong>Εγκατάσταση εφαρμογής</strong> ή <strong>Προσθήκη στην αρχική οθόνη</strong>, αν είναι διαθέσιμο.</li></ol><p>Αν το άνοιξες μέσα από άλλη εφαρμογή, επίλεξε πρώτα άνοιγμα στον browser.</p>';
    layer.innerHTML='<div class="install-panel"><img class="install-icon" src="icons/app-192.png" alt=""/><div class="eyebrow">THE SPIRIT APOCALYPSE</div><h2 id="install-title">ΠΑΙΞΕ ΣΑΝ ΕΦΑΡΜΟΓΗ</h2>'+steps+'<button class="btn primary" id="install-close">ΚΑΤΑΛΑΒΑ</button></div>';
    layer.setAttribute('aria-labelledby','install-title');document.body.append(layer);layer.showModal();
    layer.querySelector('#install-close').onclick=()=>layer.close();
    layer.addEventListener('close',()=>{layer.remove();button.focus();});
    layer.addEventListener('click',e=>{if(e.target===layer)layer.close();});
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;refresh();});
  window.addEventListener('appinstalled',()=>{installed=true;deferredPrompt=null;refresh();announce('Το παιχνίδι εγκαταστάθηκε!');});
  standalone.addEventListener('change',refresh);
  button.addEventListener('click',async()=>{
    if(isInstalled())return;
    if(!deferredPrompt){help();return;}
    const prompt=deferredPrompt;deferredPrompt=null;refresh();
    try{await prompt.prompt();await prompt.userChoice;}catch(e){help();}
  });
  const status=document.createElement('span');status.className='pwa-status';status.setAttribute('role','status');
  document.querySelector('.header-right').append(status);
  function updateStatus(){
    status.textContent=registration&&registration.active?(navigator.onLine?'OFFLINE READY':'OFFLINE MODE'):(navigator.onLine?'PREPARING OFFLINE…':'OFFLINE UNAVAILABLE');
  }
  window.addEventListener('online',updateStatus);window.addEventListener('offline',updateStatus);
  const update=document.createElement('button');update.id='game-update';update.className='top-control';update.textContent='↻';
  update.title='Έλεγχος για ενημέρωση';update.setAttribute('aria-label','Έλεγχος για ενημέρωση');
  document.querySelector('.header-right').append(update);
  function prepareResume(){
    if(s&&!save())return false;
    try{
      if(document.querySelector('.setup'))sessionStorage.setItem('apocalypse-update-setup',JSON.stringify(setup));
      sessionStorage.setItem('apocalypse-updated','yes');
    }catch(e){}
    return true;
  }
  function applyUpdate(){
    if(!pendingUpdate||!registration?.waiting||document.hidden||opening||document.querySelector('#death-cinema,#save-dialog,#install-help,#campaign-confirm,#relationships-dialog,#intro-replay-menu'))return;
    if(!prepareResume())return;
    pendingUpdate=false;update.disabled=true;
    announce('Η νέα έκδοση είναι έτοιμη. Η πρόοδός σου αποθηκεύτηκε.');
    registration.waiting.postMessage({type:'SKIP_WAITING'});
  }
  function offerUpdate(){pendingUpdate=true;applyUpdate();}
  function watchWorker(worker){
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();
      if(worker.state==='redundant')status.textContent='OFFLINE UNAVAILABLE';
    });
  }
  async function checkForUpdate(manual=false){
    if(checking||!registration)return;
    if(!navigator.onLine){if(manual)announce('Συνδέσου στο internet για έλεγχο ενημερώσεων.');return;}
    if(!manual&&Date.now()-lastCheck<60000)return;
    checking=true;lastCheck=Date.now();update.disabled=true;
    try{
      // This request deliberately bypasses the offline shell.
      const response=await fetch('./version.json?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
      const published=response.ok?await response.json():null;
      await registration.update();
      if(registration.waiting)offerUpdate();
      else if(registration.installing)watchWorker(registration.installing);
      else if(published&&published.build!==APP_RELEASE.build){
        registration=await navigator.serviceWorker.register('./sw.js?v='+encodeURIComponent(published.build),{updateViaCache:'none'});
        watchWorker(registration.installing);
        if(registration.waiting)offerUpdate();
      }else if(manual)announce('Έχεις την τελευταία έκδοση!');
    }catch(e){if(manual)announce('Δεν ολοκληρώθηκε ο έλεγχος. Δοκίμασε ξανά.');}
    finally{checking=false;update.disabled=false;}
  }
  update.onclick=()=>checkForUpdate(true);
  window.addEventListener('online',()=>checkForUpdate());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyUpdate();checkForUpdate();}});
  if('serviceWorker' in navigator&&window.isSecureContext&&location.protocol!=='file:'){
    window.addEventListener('load',async()=>{
      try{
        registration=await navigator.serviceWorker.register('./sw.js?v='+APP_RELEASE.build,{updateViaCache:'none'});
        if(registration.waiting)offerUpdate();
        registration.addEventListener('updatefound',()=>{
          watchWorker(registration.installing);
        });
        await navigator.serviceWorker.ready;updateStatus();checkForUpdate();
      }catch(e){status.textContent='OFFLINE UNAVAILABLE';}
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadController&&!reloading){
        if(!prepareResume())return;
        reloading=true;location.reload();
      }else{hadController=true;updateStatus();}
    });
    updateStatus();
    setInterval(()=>checkForUpdate(),15*60*1000);
    setInterval(applyUpdate,1500);
  }else{status.textContent='ONLINE ONLY';update.hidden=true;}
  try{
    const resume=sessionStorage.getItem('apocalypse-update-setup');
    if(resume){sessionStorage.removeItem('apocalypse-update-setup');setup=JSON.parse(resume);renderSetup();}
    if(sessionStorage.getItem('apocalypse-updated')){sessionStorage.removeItem('apocalypse-updated');announce('Η ενημέρωση ολοκληρώθηκε. Συνέχισε την ιστορία σου.');}
  }catch(e){}
  refresh();
})();
