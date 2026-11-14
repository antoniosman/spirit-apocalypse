/* The Spirit Apocalypse – six-episode branching season engine.
   No network calls, no external game services, no licensed music assets. */
(function(){
"use strict";
const originalScene = scene;
const originalEffect = sceneEffect;
const originalChoose = choose;
const originalRenderStory = renderStory;
const originalRenderHome = renderHome;
const originalRenderSetup = renderSetup;
const originalRenderReport = renderReport;
const originalRenderOpeningShot = renderOpeningShot;
const originalOpeningShots = openingShots;
const originalRender = render;
const originalNewRun = newRun;
const SCORE_AMBIENT = "assets/audio/spirit-apocalypse-survival-ambient.mp3";
const SCORE_DEATH = "assets/audio/spirit-apocalypse-death-sting.mp3";
const SCENE_COUNT = 9;
const INJECT_AFTER = [0,1,2,4,6];

let ambient = null;
let deathTimer = null;
let deathAudio = null;
let deathQueue = [];
let saveDialogOpen = false;
const SAVE_SLOTS = 3;

function html(v){return String(v??"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function eventLog(message){if(!s.notices)s.notices=[];s.notices.push(message);}
function normalize(){
  if(s&&s.version===2)return;
  if(!s||!s.players||!s.players.length)return;
  s.episode=s.episode||1;
  s.usedScenarios=s.usedScenarios||[];
  s.eventCount=s.eventCount||0;
  s.injected=s.injected||{};
  s.flags=s.flags||{};
  s.resources=s.resources||{food:3,meds:2,security:1};
  s.notices=s.notices||[];
  s.decisions=s.decisions||[];
  s.status=s.status||{};
  s.trust=s.trust||{};
  s.lastReportDeaths=s.lastReportDeaths||0;
  s.episodeStartDeaths=s.episodeStartDeaths||0;
  s.episodeStartChoices=s.episodeStartChoices||0;
}
normalize();

function clampGame(){
  s.resources.food=Math.max(0,Math.min(6,s.resources.food||0));
  s.resources.meds=Math.max(0,Math.min(6,s.resources.meds||0));
  s.resources.security=Math.max(0,Math.min(5,s.resources.security||0));
  s.danger=Math.max(1,Math.min(6,s.danger||1));
}
function randomSurvivor(){
  const potential=ROSTER.map(function(c){return c.name;}).filter(function(n){return !s.status[n]&&!s.players.includes(n);});
  if(!potential.length)return null;
  const family=s.players.flatMap(function(n){return links(n).map(function(l){return l.name;});})
    .filter(function(n){return potential.includes(n);});
  return (family.length&&chance(.34)?pick(family):pick(potential));
}
function relationshipEncounter(name){
  const bonded=s.players.flatMap(function(p){return links(p).filter(function(l){return l.name===name;}).map(function(l){return {player:p,bond:l.label};});});
  if(!bonded.length)return "";
  const item=bonded[0];
  trust(name,12);
  s.flags.foundFamily=s.flags.foundFamily||[];
  if(!s.flags.foundFamily.includes(name))s.flags.foundFamily.push(name);
  return " Μόνο όταν πλησιάζει, καταλαβαίνεις την αλήθεια: "+name+" και "+item.player+" — "+item.bond.toLowerCase()+". Η αναγνώριση τούς κόβει την ανάσα. «Νόμιζα ότι σε έχασα», ψιθυρίζει "+name+".";
}
function recruitCandidate(){
  const name=randomSurvivor();
  if(!name)return {name:null,message:"Δεν βρίσκεις κανέναν καινούργιο επιζώντα."};
  addAlly(name);trust(name,15);
  return {name:name,message:name+" διστάζει, κοιτάζει την έξοδο και τελικά επιλέγει να περπατήσει μαζί σου."+relationshipEncounter(name)};
}
function victim(){
  return pick(others().filter(function(n){return s.status[n]!=="bitten";}));
}
function lethalRisk(p,reason){
  const n=victim();
  if(n&&chance(p)){
    kill(n,reason);
    allTrust(-10);
    return " Η φωνή του ανθρώπου που έτρεχε δίπλα σου σταματά απότομα. "+n+" δεν κατάφερε να ξεφύγει. Η απώλεια αλλάζει την ομάδα οριστικά.";
  }
  return "";
}
function knownVoice(){
  const n=pick(others());
  return n||"ΑΓΝΩΣΤΗ ΦΩΝΗ";
}
function scenarioForEpisode(){
  let pool=SURVIVAL_SCENARIOS.filter(function(e){
    return e.minEpisode<=s.episode&&!s.usedScenarios.includes(e.id)
      && (e.kind!=="betray"||others().length>0);
  });
  if(!pool.length){s.usedScenarios=[];pool=SURVIVAL_SCENARIOS.filter(function(e){return e.minEpisode<=s.episode;});}
  const chosen=pick(pool);
  if(chosen){s.usedScenarios.push(chosen.id);s.eventCount++;}
  return chosen?chosen.id:null;
}
function eventById(id){return SURVIVAL_SCENARIOS.find(function(e){return e.id===id;});}
const EVENT_CHOICES={
  supply:[["take","Ψάξε σχολαστικά για προμήθειες","Μεγαλύτερο κέρδος, μεγαλύτερο ρίσκο."],["careful","Κινήσου προσεκτικά","Μικρότερο κέρδος, μεγαλύτερη ασφάλεια."],["pass","Μην αγγίξεις τίποτα","Δεν προδίδεις τη θέση σου."]],
  rescue:[["save","Βοήθησε τον άγνωστο","Μπορεί να αποκτήσεις σύμμαχο."],["observe","Μίλησε από απόσταση","Έλεγξε πρώτα τις προθέσεις του."],["pass","Μην εμπλακείς","Μένεις ασφαλής, αλλά απομακρύνεσαι."]],
  horde:[["sneak","Πέρασε αθόρυβα","Αν αποτύχεις, θα παγιδευτείτε."],["distract","Φτιάξε αντιπερισπασμό","Χάνεις εφόδια, μειώνεις την απειλή."],["fight","Δώσε μάχη","Υψηλό ρίσκο για την ομάδα."]],
  rival:[["trade","Διαπραγματεύσου","Θυσιάζεις πόρους για να περάσεις."],["reason","Ζήτησε να μιλήσετε","Η εμπιστοσύνη σου μπορεί να βοηθήσει."],["fight","Αντιστάσου","Η ομάδα μπορεί να πληρώσει ακριβά."]],
  radio:[["reply","Απάντησε στο μήνυμα","Πιθανός νέος σύμμαχος ή παγίδα."],["trace","Κατάγραψε και εντόπισε το σήμα","Στοιχεία για το μυστήριο."],["silent","Κλείσε τον ασύρματο","Λιγότερος κίνδυνος εντοπισμού."]],
  moral:[["help","Δώσε προτεραιότητα στους αδύναμους","Κερδίζεις εμπιστοσύνη με ρίσκο."],["team","Προστάτευσε πρώτα την ομάδα","Μικρότερο άμεσο κόστος."],["think","Αναζήτησε τρίτη λύση","Το αποτέλεσμα εξαρτάται από τα εφόδια." ]],
  bond:[["listen","Άκουσε και δείξε κατανόηση","Περισσότερη εμπιστοσύνη."],["lead","Μίλησε ειλικρινά στην ομάδα","Μια δύσκολη αλήθεια μπορεί να βοηθήσει."],["avoid","Άφησε το θέμα για αργότερα","Διατηρείς την ψυχραιμία σου."]],
  secret:[["inspect","Ερεύνησε το στοιχείο","Μπορεί να αλλάξει την τελευταία ταινία της σεζόν."],["collect","Πάρε ό,τι χρήσιμο βρεις","Εφόδια και πιθανός κίνδυνος."],["leave","Φύγε χωρίς να αφήσεις ίχνη","Η αλήθεια μπορεί να μείνει κρυφή."]],
  shelter:[["barricade","Οχύρωσε τον χώρο","Προστασία πριν τη νύχτα."],["search","Ερεύνησε όλα τα δωμάτια","Μπορεί να υπάρχει κάτι κρυμμένο."],["move","Βρες άλλο καταφύγιο","Αποφεύγεις πιθανή παγίδα."]],
  betray:[["confront","Αντιμετώπισε τον ύποπτο","Ο θυμός μπορεί να φέρει θάνατο."],["investigate","Αναζήτησε αποδείξεις","Μειώνει τον κίνδυνο άδικης κατηγορίας."],["forgive","Δώσε δεύτερη ευκαιρία","Κάποιοι αλλάζουν. Κάποιοι όχι."]]
};
function scenarioScene(){
  const ev=eventById(s.activeScenario);
  if(!ev){s.activeScenario=null;return originalScene();}
  const voice=others().length?knownVoice():"ΕΣΩΤΕΡΙΚΗ ΦΩΝΗ";
  let context=ev.body;
  if(ev.kind==="bond"&&others().length===0)context+=" Δεν υπάρχει ακόμη κανείς δίπλα σου, μόνο παλιά μηνύματα και αναμνήσεις.";
  if(ev.kind==="betray"&&others().length)context+=" Μέσα στην ομάδα οι ματιές γίνονται βαριές· "+subjectName(voice,true)+" δεν μπορεί να απομακρύνει την καχυποψία.";
  return {
    text:["<strong>"+ev.title+"</strong>. "+context,
      "Κάθε δευτερόλεπτο είναι επιλογή. Ό,τι συμβεί εδώ θα συνεχίσει να επηρεάζει την πορεία προς την τελευταία ημέρα."],
    dialogue:{who:voice.toUpperCase(),text:ev.kind==="bond"?"Κάποιες φορές το να μείνεις άνθρωπος είναι δυσκολότερο από το να μείνεις ζωντανός.":"Έχουμε ελάχιστο χρόνο. Τι κάνουμε;"},
    choices:EVENT_CHOICES[ev.kind].map(function(row){return {id:"event_"+row[0],name:row[1],hint:row[2]};})
  };
}
function scenarioEffect(id){
  const ev=eventById(s.activeScenario);
  const option=id.slice(6);
  const report={heading:"ΤΟ "+ev.title.toUpperCase()+" ΑΛΛΑΞΕ ΤΗΝ ΙΣΤΟΡΙΑ",text:"",warning:false};
  const kind=ev.kind;
  if(kind==="supply"){
    if(option==="take"){s.resources.food+=2;s.resources.meds+=chance(.55)?1:0;s.danger++;report.text="Επιστρέφεις με εφόδια, αλλά θραύσματα γυαλιού και μια απότομη κραυγή προδίδουν τη θέση σου."+lethalRisk(.10,"Χάθηκε σε αναζήτηση εφοδίων.");}
    else if(option==="careful"){s.resources.food++;report.text="Μαζεύεις όσα μπορείς χωρίς να αναστατώσεις τον χώρο. Το σακίδιο βαραίνει λιγότερο από τον φόβο.";}
    else{report.text="Αφήνεις τις προμήθειες. Λίγα λεπτά αργότερα ακούγονται πυροβολισμοί από εκεί που ήσουν.";}
  }else if(kind==="rescue"){
    if(option==="save"){const r=recruitCandidate();s.danger++;report.text="Ξαναγυρίζεις προς την πηγή της φωνής. "+r.message+" Το ρίσκο σάς αφήνει εκτεθειμένους."+lethalRisk(.08,"Σκοτώθηκε κατά τη διάσωση αγνώστου.");}
    else if(option==="observe"){if(chance(.58)){const r=recruitCandidate();report.text="Πρώτα ανταλλάσσετε συνθηματικά και ύστερα ανοίγεις πέρασμα. "+r.message;}else{report.text="Περιμένεις απόσταση ασφαλείας. Η φιγούρα απομακρύνεται χωρίς να σε πλησιάσει.";} }
    else {allTrust(-4);report.text="Απομακρύνεσαι. Η φωνή πίσω σου σβήνει και κανείς δεν μπορεί να σου πει αν έκανες το σωστό.";}
  }else if(kind==="horde"){
    if(option==="sneak"){s.danger++;report.text=chance(.70)?"Περνάτε χωρίς να σας αντιληφθούν. Τα βήματα των νεκρών συνεχίζουν πίσω σας.":"Ένα μεταλλικό αντικείμενο πέφτει και οι μολυσμένοι σας εντοπίζουν. Φεύγετε με την ανάσα κομμένη."+lethalRisk(.16,"Παγιδεύτηκε από ορδή μολυσμένων.");}
    else if(option==="distract"){s.resources.food--;s.danger=Math.max(1,s.danger-1);report.text="Πετάς ένα μεταλλικό δοχείο γεμάτο προμήθειες μακριά. Το πλήθος αλλάζει κατεύθυνση.";}
    else{s.danger+=2;report.text="Η σύγκρουση κρατά ελάχιστα δευτερόλεπτα. Η ομάδα ξεφεύγει βαριά τραυματισμένη."+lethalRisk(.38,"Χάθηκε στη σύγκρουση με ορδή.");}
  }else if(kind==="rival"){
    if(option==="trade"){s.resources.food--;report.text="Η συμφωνία ολοκληρώνεται με παγωμένα βλέμματα. Δεν ξέρεις πόσο θα ισχύσει.";}
    else if(option==="reason"){if(chance(.54+(s.resources.security*.04))){allTrust(6);report.text="Η κουβέντα αποκλιμακώνεται. Ίσως οι άνθρωποι να μην έγιναν ακόμη όλοι εχθροί.";}else{s.danger++;report.text="Οι φρουροί δεν πείθονται. Σε σπρώχνουν πίσω με τα όπλα υψωμένα.";}}
    else{s.danger+=2;report.text="Το πρώτο χτύπημα φέρνει σφαίρες και καπνό. Η ομάδα περνά αλλά κάποιος μπορεί να μη γύρισε."+lethalRisk(.35,"Σκοτώθηκε από αντίπαλους επιζώντες.");}
  }else if(kind==="radio"){
    if(option==="reply"){s.flags.radioContacts=(s.flags.radioContacts||0)+1;s.danger+=chance(.38)?1:0;report.text="Μια άγνωστη συχνότητα καταγράφει τη φωνή σου. Η απάντηση ίσως έρθει όταν τη χρειαστείς περισσότερο.";}
    else if(option==="trace"){s.flags.evidence=(s.flags.evidence||0)+1;report.text="Καταγράφεις συντεταγμένες και αποσπάσματα. Η πληροφορία μοιάζει ασήμαντη τώρα, όμως τα κομμάτια αρχίζουν να ενώνουν.";}
    else{s.resources.security++;report.text="Χαμηλώνεις το ραδιόφωνο. Το στίγμα σας παραμένει κρυφό.";}
  }else if(kind==="moral"){
    if(option==="help"){allTrust(13);s.resources.food--;s.danger++;report.text="Η πράξη σου σώζει έναν άγνωστο από την εγκατάλειψη. Η ομάδα βλέπει πως δεν έχεις ξεχάσει ποιος ήσουν."+lethalRisk(.09,"Σκοτώθηκε βοηθώντας αμάχους.");}
    else if(option==="team"){allTrust(-5);s.resources.security++;report.text="Κρατάς την ομάδα ενωμένη, αλλά μερικοί αποφεύγουν για ώρες το βλέμμα σου.";}
    else{const success=chance(.44+s.resources.security*.09);report.text=success?"Βρίσκεις μια λύση που δεν προϋποθέτει να εγκαταλείψεις κανέναν.": "Ο χρόνος τελειώνει πριν πραγματοποιήσεις το σχέδιο. Μια πόρτα κλείνει χωρίς απάντηση.";allTrust(success?9:-3);}
  }else if(kind==="bond"){
    if(option==="listen"){allTrust(13);report.text="Δεν προσπαθείς να βρεις την τέλεια κουβέντα. Μένεις και ακούς. Αν υπάρχει ακόμη ομάδα, αυτό γίνεται η αρχή νέας εμπιστοσύνης.";}
    else if(option==="lead"){allTrust(7);report.text="Μιλάς για όσα έγιναν χωρίς να κρύψεις τους φόβους σου. Η αλήθεια ακούγεται πιο σταθερή από οποιαδήποτε υπόσχεση.";}
    else{allTrust(-4);report.text="Η σιωπή αποφεύγει τη σύγκρουση απόψε. Δεν την εξαφανίζει.";}
  }else if(kind==="secret"){
    if(option==="inspect"){s.flags.evidence=(s.flags.evidence||0)+1;s.danger++;report.text="Φωτογραφίζεις τις λεπτομέρειες και ανακαλύπτεις σύνδεση με παλιό σήμα έκτακτης ανάγκης. Έχεις ακόμη μία απόδειξη.";}
    else if(option==="collect"){s.resources.meds+=chance(.6)?1:0;s.resources.food++;report.text="Παίρνεις προμήθειες και αφήνεις τα έγγραφα. Ίσως μια μέρα να αναρωτηθείς τι έλεγαν.";}
    else{report.text="Απομακρύνεσαι. Τα ίχνη θα μείνουν εκεί, αλλά όχι απαραίτητα για πολύ.";}
  }else if(kind==="shelter"){
    if(option==="barricade"){s.resources.security++;allTrust(4);report.text="Οχυρώνετε κάθε είσοδο. Για μία νύχτα μπορείτε να κοιμηθείτε με μισάνοιχτα μάτια.";}
    else if(option==="search"){s.resources.food++;report.text="Στο πίσω δωμάτιο βρίσκεις προμήθειες και σημειώσεις κάποιου που είχε ζήσει εδώ πριν την καταστροφή.";s.flags.evidence=(s.flags.evidence||0)+1;}
    else{s.danger=Math.max(1,s.danger-1);report.text="Συνεχίζετε μέσα στο κρύο, αλλά το κτίριο χάνεται πίσω σας χωρίς να σας έχει ακολουθήσει κανείς.";}
  }else{
    const suspect=pick(others());
    if(option==="confront"){allTrust(-7);s.danger++;report.text="Ο καβγάς ξεσπά μπροστά σε όλους. "+(suspect||"Ο άγνωστος")+" δηλώνει ότι δεν ξέρει τίποτα."+lethalRisk(.16,"Σκοτώθηκε μέσα σε ανθρώπινη διαμάχη.");}
    else if(option==="investigate"){s.flags.evidence=(s.flags.evidence||0)+1;report.text="Ακολουθείς τα σημάδια αντί να πιστέψεις τις πρώτες κατηγορίες. Τα νέα στοιχεία αντιφάσκουν με κάποιες μαρτυρίες.";}
    else{allTrust(7);report.text="Δίνεις άλλη μία ευκαιρία, γνωρίζοντας πως η συγχώρεση μπορεί να γίνει είτε ελπίδα είτε λάθος.";}
  }
  if(dead().length>(s._preEffectDeaths||0))report.warning=true;
  clampGame();
  return report;
}
function beatScene(){
  const item=SEASON_BEATS[s.episode]&&SEASON_BEATS[s.episode][s.step];
  if(!item){
    return {text:["Ο δρόμος πίσω σου εξαφανίζεται μέσα στην ομίχλη. Όσοι επέζησαν ετοιμάζονται για την επόμενη νύχτα.","Οι αποφάσεις σου δεν θα σβήσουν με το τέλος ενός επεισοδίου."],
      dialogue:{who:"SPIRIT UNIVERSE",text:"Η ιστορία συνεχίζεται."},
      choices:[{id:"finish",name:"Δες τις συνέπειες του επεισοδίου",hint:"Επιζώντες, απώλειες και εμπιστοσύνη."}]};
  }
  let text=[item[2],item[3]];
  if(s.episode===3&&s.step===3&&s.flags.betrayalVictim){
    text=["Το πρόσωπο που είχες κάποτε σώσει, <strong>"+s.flags.betrayalVictim+"</strong>, βρίσκεται χωρίς ζωή κοντά στο ποτάμι. Δεν ήταν επίθεση ζόμπι.",item[3]+ " Η ομάδα απαιτεί να αποφασίσεις τι θα γίνει με τον άνθρωπο που κατηγορούν."];
  }
  if(s.episode===4&&s.step===0&&missing().length){
    text[0]="Στο βάθος εμφανίζεται ανθρώπινη φιγούρα. Μπορεί να είναι ένας από τους αγνοούμενους: "+missing().join(", ")+". Έχεις όμως δει πολλούς νεκρούς να περπατούν.";
  }
  if(s.episode===6&&s.step===7){
    text[1]+=" <strong>Οι προηγούμενες επιλογές σου — "+s.decisions.length+" αποφάσεις, "+(s.flags.evidence||0)+" στοιχεία — καθορίζουν τις πιθανότητες.</strong>";
  }
  // Explicit continuity beats retain names and consequences across the series.
  const grief=s.flags.grief||[];
  if(grief.length&&s.episode>=2&&(s.step===2||s.step===6)){
    const last=grief[grief.length-1];
    if(inGroup().includes(last.witness))text.push(last.witness+" σωπαίνει στο άκουσμα μιας δυνατής φωνής. Το όνομα "+last.lost+" παραμένει πληγή. «Δεν έχω ξεχάσει τι έγινε εκείνο το βράδυ», ψιθυρίζει.");
  }
  const families=(s.flags.foundFamily||[]).filter(function(n){return inGroup().includes(n);});
  if(families.length&&s.episode>=2&&s.step===5){
    const n=families[0],bond=s.players.map(function(p){return {p:p,r:relation(p,n)};}).find(function(x){return x.r;});
    if(bond)text.push(n+" μένει δίπλα σε "+bond.p+". Η σχέση τους — "+bond.r[2].toLowerCase()+" — αποκτά άλλο νόημα τώρα που κάθε ξημέρωμα είναι δανεικό.");
  }
  if((s.flags.accused||[]).length&&s.episode>=3&&s.step===0){
    const accused=s.flags.accused.slice(-1)[0];
    if(inGroup().includes(accused))text.push(accused+" εξακολουθεί να θυμάται την κατηγορία. «Δεν αποδείξατε τίποτα», λέει με ψυχρή φωνή.");
  }
  if(item[6].some(function(a){return a[3]==="pair";})){
    s.flags.rescuePairs=s.flags.rescuePairs||{};
    const key=s.episode+":"+s.step;
    if(!s.flags.rescuePairs[key]){
      const known=others().slice(0,2);
      const unknown=ROSTER.map(function(c){return c.name;}).filter(function(n){return !s.status[n];});
      s.flags.rescuePairs[key]=known.concat(unknown.slice(0,2-known.length));
    }
    const pair=s.flags.rescuePairs[key];
    text.push("<strong>"+pair[0]+"</strong> και <strong>"+pair[1]+"</strong> χρειάζονται τη βοήθειά σου.");
  }
  let choices=item[6].map(function(a){return {id:a[0],name:a[1],hint:a[2],effect:a[3]};});
  if(s.episode===3&&s.step===3&&s.flags.betrayalVictim){
    choices=[
      {id:"arrest",name:"Διώξε από την ομάδα τον κατηγορούμενο",hint:"Η τιμωρία έχει κόστος, ακόμη και χωρίς βεβαιότητα.",effect:"exile"},
      {id:"revenge",name:"Εκδικήσου για τον θάνατο",hint:"Μια απόφαση που κανείς δεν θα ξεχάσει.",effect:"fight"},
      {id:"court",name:"Ζήτησε αποδείξεις πριν αποφασίσεις",hint:"Η δικαιοσύνη δεν είναι η ίδια με την εκδίκηση.",effect:"investigate"}
    ];
  }
  return {text:text,dialogue:{who:item[4],text:item[5]},choices:choices};
}
function scenarioOrBeat(){
  if(s.activeScenario)return scenarioScene();
  if(s.episode>1)return beatScene();
  if(s.step===1&&others().length===0){
    const sc=originalScene();
    sc.text=[""+(s.players.length===1?"Στον παλιό σταθμό τραμ καταφέρνεις να φτάσεις "+genderWord(s.players[0],"μόνος","μόνη"):"Στον παλιό σταθμό τραμ καταφέρνετε να φτάσετε μαζί")+". Πίσω από την περίφραξη βλέπεις ανθρώπους να προσπαθούν να βρουν έξοδο.",
      "Από τα διπλανά στενά ακούγεται κραυγή. Μπορείς να βοηθήσεις τους αγνώστους, να οργανώσεις μια ασφαλή γωνιά ή να φύγεις πριν σε περικυκλώσουν.",
      "Δεν υπάρχει ακόμη ομάδα. Αυτό που θα κάνεις τώρα μπορεί να είναι η αρχή της."];
    sc.dialogue={who:"ΑΓΝΩΣΤΟΣ ΠΙΣΩ ΑΠΟ ΤΗΝ ΠΕΡΙΦΡΑΞΗ",text:"Σε παρακαλώ! Έχεις κλειδί; Είμαστε ακόμη ζωντανοί!"};
    return sc;
  }
  if(s.step===3&&others().length===0){
    return {text:["Μέσα σε άδειο κέντρο υγείας συναντάς άνθρωπο με φρέσκο δάγκωμα. Δεν ξέρεις το όνομά του. Κρατά ένα πανί στο χέρι και σου ζητά βοήθεια.",
      "Δεν έχεις ακόμη φτιάξει ομάδα. Ακόμη κι έτσι, πρέπει να αποφασίσεις αν θα τον εμπιστευτείς."],
      dialogue:{who:"ΑΓΝΩΣΤΟΣ ΤΡΑΥΜΑΤΙΑΣ",text:"Δεν έχω μετατραπεί. Κοίτα με. Σε παρακαλώ, μη φύγεις."},
      choices:[{id:"soloHeal",name:"Προσπάθησε να τον περιθάλψεις",hint:"Χρειάζεσαι φάρμακα και λίγη τύχη."},
        {id:"soloTalk",name:"Μίλησε μαζί του από απόσταση",hint:"Μάθε περισσότερα για το δάγκωμα."},
        {id:"soloLeave",name:"Φύγε από το κέντρο υγείας",hint:"Δεν θέτεις τον εαυτό σου σε κίνδυνο."}]};
  }
  if(s.step===5&&others().length===0){
    return {text:["Μένεις για λίγο "+genderWord(s.players[0],"μόνος","μόνη")+", ακούγοντας τα παράσιτα μιας παλιάς συσκευής. Στον τοίχο γράφει: <strong>ΑΝ ΔΙΑΒΑΖΕΙΣ ΑΥΤΟ, ΕΙΜΑΙ ΑΚΟΜΗ ΕΔΩ.</strong>",
      "Δεν υπάρχει κάποιος κοντά σου να μοιραστεί τον φόβο. Μπορείς όμως να αποφασίσεις πώς θα συνεχίσεις."],
      dialogue:{who:"ΗΧΟΓΡΑΦΗΜΕΝΟ ΜΗΝΥΜΑ",text:"Αν κάποιος το βρει... πείτε τους ότι δεν τα παράτησα."},
      choices:[{id:"suppliesCheck",name:"Έλεγξε το κρυφό ντουλάπι",hint:"Μπορεί να βρεις προμήθειες."},
        {id:"watch",name:"Ανάλαβε τη σκοπιά",hint:"Προετοιμάσου για τις επόμενες ώρες."}]};
  }
  if(s.step===7&&s.rescueTargets.length<2){
    const known=others();
    const pool=ROSTER.map(function(x){return x.name;}).filter(function(n){return !s.status[n]&&!s.players.includes(n);});
    s.rescueTargets=shuffle(known).slice(0,2);
    s.rescueTargets=s.rescueTargets.concat(shuffle(pool).slice(0,2-s.rescueTargets.length));
    s.flags.bridgeUnknown=s.rescueTargets.filter(function(n){return !s.status[n];});
  }
  const sc=originalScene();
  if(s.step===7&&s.flags.bridgeUnknown&&s.flags.bridgeUnknown.length){
    sc.text[0]="Δύο άνθρωποι παγιδεύονται στο πέρασμα καθώς η γέφυρα αρχίζει να διαλύεται. "+s.flags.bridgeUnknown.join(" και ")+" είναι ανάμεσα στις φωνές που ακούς πρώτη φορά.";
    sc.text[1]="Μόνο τώρα βλέπεις ποιοι είναι και πού βρίσκονται. Μπορείς να επιχειρήσεις να τους σώσεις, αλλά δεν έχεις καμία εγγύηση πως θα επιβιώσετε.";
  }
  return sc;
}
// Resolve random scene details once, then persist the exact scene and RNG state.
scene = function(){
  s.sceneCache=s.sceneCache||{};
  const key=(s.episode||1)+":"+s.step+":"+(s.activeScenario||"story");
  if(!s.sceneCache[key]){s.sceneCache[key]=scenarioOrBeat();save();}
  return JSON.parse(JSON.stringify(s.sceneCache[key]));
};

function effectAlone(id){
  let text="";
  if(id==="soloHeal"){
    s.resources.meds=Math.max(0,s.resources.meds-1);
    if(chance(.55+s.resources.meds*.08)){
      const r=recruitCandidate();text="Περνάς ώρα προσπαθώντας να σταματήσεις την αιμορραγία. "+r.message+" Το τραύμα παραμένει επικίνδυνο.";
    }else{text="Ο άγνωστος χάνει τις αισθήσεις του. Δεν καταφέρνεις να σταματήσεις την αιμορραγία. Φεύγεις μέσα στη σιωπή.";}
  }else if(id==="soloTalk"){s.flags.evidence=(s.flags.evidence||0)+1;text="Σου περιγράφει τις πρώτες ώρες μετά την επίθεση και μια ελάχιστα γνωστή αποθήκη φαρμάκων. Κρατάς το στοιχείο.";}
  else {s.danger=Math.max(1,s.danger-1);text="Αφήνεις πίσω το κέντρο υγείας. Πίσω από το παράθυρο ο άνθρωπος συνεχίζει να σε κοιτά, ώσπου χάνεται στο σκοτάδι.";}
  clampGame();
  return {heading:"ΤΟ ΤΙΜΗΜΑ ΤΗΣ ΠΡΩΤΗΣ ΣΥΝΑΝΤΗΣΗΣ",text:text,warning:false};
}
function applyBeatAction(effect,choice){
  const result={heading:"ΜΙΑ ΑΚΟΜΗ ΑΠΟΦΑΣΗ ΑΛΛΑΞΕ ΤΑ ΠΑΝΤΑ",text:"",warning:false};
  const ep=s.episode,step=s.step;
  let text="";
  if(effect==="trade"){s.resources.food-=2;allTrust(4);text="Η συμφωνία κλείνει. Η πύλη ανοίγει μόνο όσο χρειάζεται για να περάσεις, ενώ κάποιος μετρά τα εφόδιά σου.";}
  else if(effect==="bond"){allTrust(10);s.resources.security+=chance(.34)?1:0;text="Οι άνθρωποι ακούνε όσα έχεις να πεις. Όσοι σε εμπιστεύονται δίνουν ένα βήμα περισσότερο στην κοινή σας προσπάθεια.";}
  else if(effect==="truth"){allTrust(chance(.7)?9:-7);s.flags.evidence=(s.flags.evidence||0)+1;text="Αποφασίζεις να πεις όλη την αλήθεια. Κάποιοι σε κοιτούν ανακουφισμένοι, άλλοι αρχίζουν να αναρωτιούνται τι άλλο έμεινε κρυφό.";}
  else if(effect==="sneak"){
    s.danger++;if(chance(.67+s.resources.security*.035)){s.resources.security++;text="Περνάς αθόρυβα τη σκοπιά και βρίσκεις το στενό μονοπάτι που κανείς δεν φρουρεί.";}
    else{text="Ένα σύρμα σπάει και ακούγεται συναγερμός. Τρέχετε μέσα από σπασμένα τζάμια."+lethalRisk(.2,"Χάθηκε στην προσπάθεια κρυφής διαφυγής.");}
  }else if(effect==="recruit"){const r=recruitCandidate();s.danger++;text="Μένεις πίσω όταν οι περισσότεροι θα έφευγαν. "+r.message+lethalRisk(.10,"Σκοτώθηκε προστατεύοντας νέο επιζώντα.");}
  else if(effect==="investigate"){s.flags.evidence=(s.flags.evidence||0)+1;const note=s.flags.evidence; text="Παρατηρείς όσα όλοι προσπέρασαν. Κρατάς μια ακόμη λεπτομέρεια στην καταγραφή σου (στοιχεία: "+note+"). Στο τέλος ίσως ενωθούν όλα.";}
  else if(effect==="evade"){s.danger=Math.max(1,s.danger-1);s.resources.food=Math.max(0,s.resources.food-(chance(.3)?1:0));allTrust(-2);text="Αποφεύγεις τον άμεσο κίνδυνο. Κάποιοι το θεωρούν σύνεση, κάποιοι φυγή από την ευθύνη.";}
  else if(effect==="supply"){s.resources.food+=2;s.resources.meds+=chance(.4)?1:0;s.danger++;text="Επιστρέφεις με χρήσιμες προμήθειες και μια μικρή αίσθηση νίκης. Οι ήχοι πίσω σου δεν θυμίζουν νικητές."+lethalRisk(.10,"Σκοτώθηκε κατά την αναζήτηση προμηθειών.");}
  else if(effect==="heal"){
    const target=pick(others());s.resources.meds--;const success=chance(.42+s.resources.meds*.08+(s.flags.evidence||0)*.012);
    if(target&&success){s.status[target]="wounded";trust(target,17);text="Ξοδεύεις το τελευταίο αποστειρωμένο υλικό. "+target+" κρατιέται στη ζωή και θυμάται ότι δεν "+genderWord(target,"τον","την")+" εγκατέλειψες.";}
    else if(target&&s.resources.meds<0){s.resources.meds=0;text="Χωρίς αρκετά φάρμακα η θεραπεία αποτυγχάνει. "+target+" παραμένει σε κρίσιμη κατάσταση.";s.status[target]="wounded";}
    else if(target&&!success&&chance(.30)){kill(target,"Η μόλυνση εξαπλώθηκε παρά τη θεραπεία.");text="Η προσπάθεια δεν αρκεί. "+target+" πεθαίνει ενώ κάποιος κρατά το χέρι "+genderWord(target,"του","της")+".";}
    else {text="Ο τραυματίας αντέχει το πρώτο βράδυ. Χωρίς εξετάσεις δεν μπορεί κανείς να υποσχεθεί την επόμενη.";}
  }else if(effect==="isolate"){
    const target=pick(others());
    if(target){s.status[target]="missing";trust(target,-20);s.flags.isolated=(s.flags.isolated||[]).concat([target]);text=target+" μένει σε ξεχωριστό χώρο. Δεν έχει πεθάνει, αλλά δεν είναι πια μαζί σας. Η απόφαση θα επιστρέψει.";}
    else {s.resources.security++;text="Σφραγίζεις το σημείο καραντίνας. Κανείς δεν ξέρει αν έκανες το σωστό.";}
  }else if(effect==="execute"){
    const target=victim();
    if(target){kill(target,"Εκτελέστηκε από την ομάδα υπό φόβο μόλυνσης.");allTrust(-20);text="Ο ήχος της απόφασης δεν σβήνει εύκολα. "+target+" δεν θα ξαναμιλήσει. Κάποιοι στρέφουν αλλού το βλέμμα.";}
    else {s.danger=Math.max(1,s.danger-1);text="Σταματάς την απειλή, όμως η σιωπή που ακολουθεί σε στοιχειώνει.";}
  }else if(effect==="fight"){
    s.danger+=2;s.resources.security=Math.max(0,s.resources.security-1);text="Η σύγκρουση είναι γρήγορη και τρομακτική. Όταν σταματά ο θόρυβος, μετράς πρώτα τους ζωντανούς."+lethalRisk(.34-(s.resources.security*.025),"Σκοτώθηκε σε σύγκρουση επιζώντων.");allTrust(-7);
  }else if(effect==="guard"){s.resources.security+=2;s.danger=Math.max(1,s.danger-1);allTrust(3);text="Χτίζεις άμυνα με ό,τι υπάρχει διαθέσιμο. Για λίγο, ο κόσμος έχει ξανά μια πόρτα που κλείνει.";}
  else if(effect==="radio"){s.flags.radioContacts=(s.flags.radioContacts||0)+1;s.danger+=chance(.3)?1:0;text="Στέλνεις σήμα και περιμένεις. Μια άγνωστη φωνή απαντά με συνθηματικό που μπορεί να αποδειχθεί πολύτιμο.";}
  else if(effect==="protect"){allTrust(5);s.resources.security++;text="Μπαίνεις ανάμεσα σε δύο θυμωμένους ανθρώπους. Για τώρα σταματάς την αιματοχυσία, όχι τις υποψίες.";}
  else if(effect==="accuse"){
    const suspect=victim();if(suspect){trust(suspect,-32);s.flags.accused=(s.flags.accused||[]).concat([suspect]);text="Η κατηγορία πέφτει πάνω σε "+suspect+" σαν πέτρα. «Όταν φανεί ότι είμαι αθώος/α, θέλω να θυμάσαι αυτή τη στιγμή», απαντά.";}else{text="Κατηγορείς άγνωστο πρόσωπο χωρίς απόδειξη. Οι φήμες εξαπλώνονται.";}
  }else if(effect==="exile"){
    const n=(ep===3&&step===3&&inGroup().includes(s.flags.betrayalKiller))?s.flags.betrayalKiller:victim();if(n){s.status[n]="missing";trust(n,-45);s.flags.exiled=(s.flags.exiled||[]).concat([n]);text=subjectName(n)+" διώχνεται. Φεύγει λέγοντας ότι, αν επιβιώσει, θα θυμάται τη νύχτα που "+genderWord(n,"τον","την")+" αφήσατε έξω.";}else{text="Απομακρύνεις τον ύποπτο, αλλά κανείς δεν φαίνεται ήρεμος.";}
  }else if(effect==="reunite"){
    const n=pick(missing());
    if(n&&chance(.60+(s.flags.evidence||0)*.015)){s.status[n]="group";trust(n,18);text="Η φιγούρα πλησιάζει και αναγνωρίζεις "+n+". Είναι "+genderWord(n,"ζωντανός","ζωντανή")+"! Τα πρόσωπα αλλάζουν, καθώς ένα απίθανο αντάμωμα γίνεται αληθινό."+relationshipEncounter(n);}
    else if(n){text="Ακολουθείς το ίχνος, αλλά δεν καταφέρνεις να συναντήσεις "+n+". Μένει "+genderWord(n,"αγνοούμενος","αγνοούμενη")+".";}
    else {const r=recruitCandidate();text="Δεν επιστρέφει κανένας από τους χαμένους. Αντί γι' αυτό, "+r.message;}
  }else if(effect==="risk"){
    s.flags.heroicRisk=(s.flags.heroicRisk||0)+1;allTrust(16);s.danger+=2;text="Επιλέγεις να μπεις εσύ στη ζώνη κινδύνου. Όσοι σε βλέπουν καταλαβαίνουν ότι δεν μοιράζεις μόνο εντολές."+lethalRisk(.14,"Σκοτώθηκε καλύπτοντας επικίνδυνη επιχείρηση.");}
  else if(effect==="sacrifice"){
    const n=victim();if(n){if(chance(.34)){kill(n,"Θυσιάστηκε για να περάσει η ομάδα.");text=n+" κρατά τη θέση μέχρι την τελευταία στιγμή. Ο μηχανισμός ανοίγει, αλλά δεν επιστρέφει.";}
      else{s.status[n]="wounded";text=n+" καταφέρνει να επιστρέψει "+genderWord(n,"τραυματισμένος","τραυματισμένη")+". Η ομάδα δεν θα ξεχάσει την πράξη.";}allTrust(-5);}
    else {s.danger+=2;text="Δεν υπάρχει κανένας άλλος να σταθεί στη θέση σου. Αναγκάζεσαι να εγκαταλείψεις το σχέδιο.";}
  }else if(effect==="pair"){
    const group=others();
    const pool=ROSTER.map(function(c){return c.name;}).filter(function(n){return !s.status[n]&&!s.players.includes(n);});
    const pair=s.flags.rescuePairs[s.episode+":"+s.step];
    const a=pair[0],b=pair[1],id=choice.id;
    if(id==="both"){
      const success=chance(.30+s.resources.security*.08+s.resources.meds*.05-s.danger*.02);
      if(success){addAlly(a);addAlly(b);trust(a,18);trust(b,18);text="Με απίστευτη προσπάθεια τραβάς και τους δύο σε ασφαλές σημείο. "+a+" και "+b+" επιβιώνουν."+lethalRisk(.28,"Πέθανε καλύπτοντας τη διάσωση δύο ανθρώπων.");}
      else {let lost=pick([a,b]),safe=lost===a?b:a;kill(lost,"Χάθηκε ενώ επιχειρούσαν να σώσουν δύο ανθρώπους.");addAlly(safe);text="Το πέρασμα υποχωρεί. "+safe+" σώζεται, αλλά "+lost+" χάνεται μέσα στο νερό.";}
    }else if(id==="first"||id==="second"){const safe=id==="first"?a:b,lost=id==="first"?b:a;addAlly(safe);if(chance(.65))kill(lost,"Χάθηκε στη διάσωση της γέφυρας.");else s.status[lost]="missing";text="Σώζεις "+safe+". "+lost+" μένει στην άλλη πλευρά και η μοίρα "+genderWord(lost,"του","της")+" είναι αβέβαιη.";}
    else {s.status[a]="missing";s.status[b]="missing";allTrust(-8);text="Απομακρύνεσαι από τη γέφυρα. Οι φωνές σταματούν και τα ονόματα "+a+", "+b+" γίνονται άλλη μια αναπάντητη ερώτηση.";}
  }
  else if(effect.startsWith("final_"))return finalEffect(effect);
  if(ep===3&&step===3&&s.flags.betrayalVictim){
    if(choice.id==="arrest")text+=" Το πρόσωπο που κατηγορείται εξαφανίζεται από την ομάδα. Ίσως ξανασυναντηθείτε.";
    if(choice.id==="court"&&(s.flags.evidence||0)>2)text+=" Οι μαρτυρίες αποδεικνύουν ότι η πρώτη κατηγορία ήταν λανθασμένη.";
    s.flags.betrayalJudgment=choice.id;
  }
  clampGame();
  result.warning=dead().length>(s._preEffectDeaths||0);
  if(result.warning)result.heading="ΜΙΑ ΖΩΗ ΧΑΘΗΚΕ";
  result.text=text||"Οι δρόμοι άλλαξαν και μαζί τους οι άνθρωποι που περπατούν δίπλα σου.";
  return result;
}
function finalEffect(effect){
  const group=others();
  const avgTrust=group.length?group.reduce(function(sum,n){return sum+(s.trust[n]??50);},0)/group.length:48;
  const preparation=(s.resources.security||0)*.065+(s.resources.meds||0)*.025+(s.flags.evidence||0)*.012+(avgTrust-50)*.002;
  const result={heading:"Η ΤΕΛΕΥΤΑΙΑ ΑΠΟΦΑΣΗ",text:"",warning:false};
  let personalDeath=.25;
  if(effect==="final_sacrifice"){personalDeath=.74-preparation*.30;allTrust(20);result.text="Μένεις στο μηχανισμό μέχρι να περάσουν οι άλλοι. Για λίγα δευτερόλεπτα, το δικό σου σώμα είναι το τελευταίο εμπόδιο στους νεκρούς.";}
  if(effect==="final_together"){personalDeath=.36-preparation*.50;allTrust(12);result.text="Δίνεις το σύνθημα και ορμάτε όλοι μαζί προς το πέρασμα. Η εμπιστοσύνη που χτίσατε είναι το μόνο που δεν μπορείτε να κουβαλήσετε στο σακίδιο.";}
  if(effect==="final_escape"){personalDeath=.12-preparation*.14;allTrust(-23);result.text="Τρέχεις μπροστά και φτάνεις στην απέναντι πλευρά. Πίσω σου ακούγονται φωνές. Δεν ξέρεις ποιος θα μπορέσει να σε ακολουθήσει."+lethalRisk(.48,"Έμεινε πίσω στην τελική απόδραση.");}
  if(effect==="final_trap"){personalDeath=.48-preparation*.42;s.resources.security=Math.max(0,s.resources.security-1);result.text="Ενεργοποιείς τον μηχανισμό παγίδευσης. Οι εκρήξεις φωτίζουν το πρόσωπό σου και η πόρτα αρχίζει να κατεβαίνει."+lethalRisk(.18,"Χάθηκε κατά την τελική παγίδα.");}
  s.flags.finalChoice=effect;
  s.flags.finalRoll=personalDeath;
  s.flags.seasonEnding=true;
  const odds=Math.max(.05,Math.min(.90,personalDeath+(s.danger-3)*.025));
  if(chance(odds)){
    const lead=s.players[Math.floor(dieRoll()*s.players.length)];
    s.status[lead]="dead";
    eventLog(lead+" — Έπεσε στην τελική απόφαση της σεζόν.");
    s.flags.playerDied=lead;
    result.heading="THE END OF "+lead.toUpperCase();
    result.warning=true;
    result.text+=" <strong>"+subjectName(lead)+" δεν τα κατάφερε.</strong> Η ιστορία συνεχίζεται μέσα από όσα άφησε πίσω "+genderWord(lead,"του","της")+".";
  }else{
    s.flags.playerSurvived=true;
    result.text+=" <strong>Το πρώτο φως πέφτει πάνω σου. Είσαι "+genderWord(s.players[0],"ζωντανός","ζωντανή")+".</strong> Η ιστορία σου συνεχίζεται πέρα από τη Γραμμή.";
  }
  clampGame();
  return result;
}
sceneEffect = function(id){
  s._preEffectDeaths=dead().length;
  let report;
  if(s.activeScenario)report=scenarioEffect(id);
  else if(s.episode===1&&s.step===3&&others().length===0)report=effectAlone(id);
  else if(s.episode===1){
    report=originalEffect(id);
    if(s.step===7){
      const targets=s.rescueTargets||[];
      targets.filter(function(n){return alive(n)&&s.status[n]!=="missing";}).forEach(function(n){
        if(!inGroup().includes(n)){addAlly(n);report.text+=relationshipEncounter(n);}
      });
    }
    if(s.step===0&&id==="call"){
      // Contact does not expose identities until the player actually meets someone.
      s.flags.calledButNotMet=true;
      report.text="Η κλήση χτυπά χωρίς απάντηση. Αφήνεις ένα μήνυμα: «Είμαι "+genderWord(s.players[0],"ζωντανός","ζωντανή")+". Αν μ' ακούς, βρες με». Κανένα όνομα δεν επιβεβαιώνεται ακόμη.";
    }
    if(s.step===1&&id==="strangers"){
      const recent=others().slice(-2);
      recent.forEach(function(n){report.text+=relationshipEncounter(n);});
    }
    if(s.step===0&&id==="rescue"){
      report.text+=relationshipEncounter(s.flags.firstRescue);
    }
  }else{
    const selected=scene().choices.find(function(c){return c.id===id;});
    report=applyBeatAction(selected?selected.effect:"evade",selected||{id:id});
  }
  delete s._preEffectDeaths;
  return report;
};

newRun = function(){
  originalNewRun();
  if(!s||s.phase!=="intro")return;
  s.episode=1;s.usedScenarios=[];s.injected={};s.eventCount=0;s.activeScenario=null;
  s.episodeStartDeaths=0;s.episodeStartChoices=0;s.flags.evidence=0;
  save();render();
};
function shouldInject(){return INJECT_AFTER.includes(s.step);}
function enterEpisodeBeat(){
  if(s.episode===1){
    if(s.step===3&&others().length>0)ensureBite();
    if(s.step===7){s.rescueTargets=[];s.flags.bridgeUnknown=[];}
  }
  if(s.episode===3&&s.step===3&&!s.flags.betrayalSeen){
    s.flags.betrayalSeen=true;
    const saved=s.flags.rescued||s.flags.firstRescue;
    const candidate=saved&&inGroup().includes(saved)?saved:null;
    if(candidate&&chance(.55)){
      kill(candidate,"Δολοφονήθηκε από άλλον επιζώντα τρεις εβδομάδες μετά τη διάσωσή "+genderWord(candidate,"του","της")+".");
      s.flags.betrayalVictim=candidate;
      s.flags.betrayalKiller=pick(others().filter(function(n){return n!==candidate;}))||"άγνωστος";
      save();
      showDeaths([candidate]);
    }
  }
}
nextScene = function(){
  if(!s||s.phase!=="story")return;
  s.result=null;s.votes=[];
  if(s.activeScenario){
    s.activeScenario=null;
    s.step++;
    enterEpisodeBeat();
  }else{
    const key=s.episode+"-"+s.step;
    if(shouldInject()&&!s.injected[key]){
      s.injected[key]=true;
      s.activeScenario=scenarioForEpisode();
    }else{s.step++;enterEpisodeBeat();}
  }
  save();render();goTop();
};
choose = function(index){
  if(!s)return;
  const before=dead();
  const decisionCount=s.decisions.length;
  originalChoose(index);
  if(s&&s.decisions.length>decisionCount){
    const last=s.decisions[s.decisions.length-1];
    last.episode=s.episode;
    last.title=s.activeScenario?eventById(s.activeScenario).title:
      s.episode===1?sceneMeta[s.step][1]:
      s.step<8?SEASON_BEATS[s.episode][s.step][1]:"Το τέλος του επεισοδίου";
    save();
  }
  const fresh=dead().filter(function(n){return !before.includes(n);});
  if(fresh.length&&s.phase==="story")showDeaths(fresh);
};

function reportMarkup(){
  const group=inGroup(),loss=dead(),gone=missing();
  const currentChoices=s.decisions.filter(function(d){return (d.episode||1)===s.episode;});
  const allies=group.filter(function(n){return !s.players.includes(n);}).sort(function(a,b){return (s.trust[b]||50)-(s.trust[a]||50);});
  const leadDead=s.players.filter(function(n){return s.status[n]==="dead";});
  const ep=s.episode,final=ep===6;
  const ending=leadDead.length?"YOU<br/><span>DIED.</span>":final?"YOU<br/><span>ENDURED.</span>":"YOU<br/><span>SURVIVED.</span>";
  return '<div class="report"><div class="report-hero"><div><div class="eyebrow">SEASON 01 / EPISODE '+String(ep).padStart(2,"0")+' COMPLETED</div>'+
    '<h1>'+ending+'</h1><p>'+(final?"Η πρώτη σεζόν τελείωσε. Το τέλος γράφτηκε από τις επιλογές σου και τους ανθρώπους που επέζησαν.":"Το επεισόδιο τελείωσε, μα η ιστορία των επιζώντων συνεχίζεται. Οι άνθρωποι θυμούνται όσα έκανες.")+'</p></div>'+
    '<div class="report-badge"><div class="eyebrow">THE LIVING</div><strong>'+group.length+'</strong><span>ΜΑΖΙ ΣΟΥ</span><div class="divider"></div><span>ΝΕΚΡΟΙ '+loss.length+' · ΑΓΝΟΟΥΜΕΝΟΙ '+gone.length+'</span></div></div>'+
    '<div class="report-grid"><div class="report-card"><div class="eyebrow">YOUR STORY / EPISODE '+ep+'</div><h2>ΟΙ ΕΠΙΛΟΓΕΣ ΣΟΥ</h2><ul>'+
    currentChoices.map(function(d,i){return '<li><span class="bullet">'+String(i+1).padStart(2,"0")+'</span><div><strong>'+html(d.choice)+'</strong><div class="subtle">'+html(d.title)+'</div></div></li>';}).join("")+
    '</ul></div><div class="report-card"><div class="eyebrow">RELATIONSHIPS & CONSEQUENCES</div><h2>ΕΜΠΙΣΤΟΣΥΝΗ</h2>'+
    (allies.length?allies.map(function(n){const v=s.trust[n]??50;return '<div class="trust-row"><span>'+html(n)+'</span><div class="meter"><i class="'+(v<40?"low":"")+'" style="width:'+v+'%"></i></div><strong>'+v+'%</strong></div>';}).join(""):'<p>Δεν έχεις ακόμη αποκτήσει μόνιμους συμμάχους.</p>')+
    '<div class="divider"></div><h2>ΑΠΩΛΕΙΕΣ & ΑΓΝΟΟΥΜΕΝΟΙ</h2><div class="survivor-tags">'+
    (loss.map(function(n){return '<span class="survivor-tag dead">✕ '+html(n)+'</span>';}).concat(gone.map(function(n){return '<span class="survivor-tag">? '+html(n)+'</span>';})).join("")||'<span class="subtle">Δεν υπάρχει επιβεβαιωμένη απώλεια.</span>')+
    '</div><div class="divider"></div><div class="eyebrow">STORY ENGINE</div><p class="tiny">'+s.eventCount+' τυχαίες σκηνές αυτής της σεζόν · '+(s.flags.evidence||0)+' στοιχεία · '+s.decisions.length+' συνολικές αποφάσεις</p></div></div>'+
    '<div class="report-footer"><div class="locked-message">◈ '+(final?"Η ΣΕΖΟΝ ΟΛΟΚΛΗΡΩΘΗΚΕ. Κάθε νέα αρχή θα δημιουργήσει διαφορετικό δρόμο.":"ΕΠΟΜΕΝΟ: Επεισόδιο "+(ep+1)+" — "+html(EPISODES[ep]))+'</div>'+
    '<div class="button-row"><button class="btn" data-action="home">ΑΡΧΙΚΗ</button><button class="btn" data-action="save-modal">SAVE / LOAD</button>'+
    (!final?'<button class="btn primary" data-action="next-episode">ΕΠΕΙΣΟΔΙΟ '+(ep+1)+' →</button>':'<button class="btn primary" data-action="new">ΝΕΟ PLAYTHROUGH ↗</button>')+'</div></div></div>';
}
renderReport = function(){app.innerHTML=reportMarkup();};
renderStory = function(){
  const oldMeta=sceneMeta[s.step];
  const ev=s.activeScenario?eventById(s.activeScenario):null;
  const beat=s.episode>1?SEASON_BEATS[s.episode][s.step]:null;
  const label=ev?ev.title:beat?beat[1]:s.episode>1?"Το κλείσιμο του επεισοδίου":oldMeta[1];
  const stamp=ev?"SURVIVAL FILE / #"+String(ev.id).padStart(3,"0"):beat?beat[0]:s.episode>1?"SEASON 01 / EPISODE "+s.episode:oldMeta[0];
  sceneMeta[s.step]=[stamp,label];
  originalRenderStory();
  sceneMeta[s.step]=oldMeta;
  const headline=app.querySelector(".game-top>.eyebrow");
  if(headline)headline.textContent="EPISODE "+String(s.episode).padStart(2,"0")+" / "+(ev?"RANDOM ENCOUNTER "+String(ev.id).padStart(3,"0"):"STORY SCENE "+(s.step+1)+"/9");
  
  const title=app.querySelector(".story-title");
  if(title&&s.step===8&&s.episode>1)title.textContent="ΤΟ ΕΠΕΙΣΟΔΙΟ ΟΛΟΚΛΗΡΩΘΗΚΕ.";
  const lines=app.querySelectorAll(".progress-lines span");
  if(ev){lines.forEach(function(line,i){line.classList.toggle("current",i===s.step);});}
  const pair=!s.activeScenario&&(s.episode===1&&s.step===7?s.rescueTargets:
    s.flags.rescuePairs&&s.flags.rescuePairs[s.episode+":"+s.step]);
  if(pair&&pair.length===2&&!s.result){
    const area=app.querySelector(".choices");
    const options=scene().choices;
    const targetChoices=["first","second"];
    area.classList.add("major-rescue");
    area.innerHTML='<div class="rescue-heading">MAJOR DECISION · ΔΥΟ ΖΩΕΣ, ΜΙΑ ΑΠΟΦΑΣΗ</div><div class="rescue-split">'+pair.map(function(n,i){
      const index=options.findIndex(function(c){return c.id===targetChoices[i];});
      return '<button class="rescue-person" data-choice="'+index+'">'+image(n)+'<span><small>ΕΠΙΛΕΞΕ ΠΟΙΟΝ ΘΑ ΣΩΣΕΙΣ</small><strong>SAVE '+html(n.toUpperCase())+'</strong></span></button>';
    }).join("")+'</div><div class="rescue-alternatives">'+options.map(function(c,i){return targetChoices.includes(c.id)?"":'<button class="choice" data-choice="'+i+'"><span><strong>'+html(c.name)+'</strong><small>'+html(c.hint)+'</small></span></button>';}).join("")+'</div>';
  }
  startAmbient();
};
renderHome = function(){
  originalRenderHome();
  const tiny=app.querySelector(".section-head .tiny");
  if(tiny)tiny.textContent="ΟΛΑ ΤΑ ΕΠΕΙΣΟΔΙΑ ΠΑΙΚΤΙΚΑ · 100 ROTATING EVENTS";
  app.querySelectorAll(".episode-tile").forEach(function(tile,i){
    tile.classList.toggle("active",!!(s&&s.players.length&&s.episode===i+1));
    const lock=tile.querySelector(".lock");if(lock)lock.remove();
    const status=document.createElement("span");
    status.className="episode-status";status.textContent=i===0?"START HERE":s&&s.players.length&&s.episode===i+1?"CURRENT EPISODE":"STORY AVAILABLE";
    tile.appendChild(status);
  });
  const buttons=app.querySelector(".home-copy .button-row");
  if(buttons)buttons.insertAdjacentHTML("beforeend",'<button class="btn" data-action="save-modal">SAVE / LOAD</button>');
  const p=app.querySelector(".home-copy > p");
  if(p)p.textContent="Ξεκινάς χωρίς ομάδα. Γνωρίζεις ανθρώπους μόνο όταν τους συναντάς — και οι επιλογές σου καθορίζουν ποιοι θα σε ακολουθήσουν, ποιοι θα σε προδώσουν και ποιοι θα φτάσουν ως το τέλος.";
};
render = function(){
  originalRender();
  if(s&&s.phase==="story")document.title="THE SPIRIT APOCALYPSE — EPISODE "+String(s.episode||1).padStart(2,"0");
  if(s&&s.phase==="report")document.title="THE SPIRIT APOCALYPSE — EPISODE "+String(s.episode||1).padStart(2,"0")+" COMPLETE";
};
renderSetup = function(){
  originalRenderSetup();
  const p=app.querySelector(".setup-head p");
  if(p)p.textContent="Διάλεξε 1–3 χαρακτήρες από το αυθεντικό cast. Οι προσωπικές τους σχέσεις δεν αποκαλύπτονται πριν συναντηθούν μέσα στην ιστορία.";
  app.querySelectorAll(".cast-info span").forEach(function(x,i){x.textContent=ROSTER[i].pronouns.label.toUpperCase();});
  const footer=app.querySelector(".setup-bottom p");
  if(footer)footer.textContent="Το playthrough αρχίζει χωρίς έτοιμη ομάδα. Οι άνθρωποι μπαίνουν στην ιστορία μέσα από γεγονότα και τις αποφάσεις σας.";
};
renderOpeningShot = function(shot){
  originalRenderOpeningShot(shot);
  if(shot.type==="episode"){
    const card=document.querySelector(".cinema-episode-card");
    if(card){const n=card.querySelector("strong"),h=card.querySelector("h2"),p=card.querySelector("p");
      if(n)n.textContent="EPISODE "+String(s.episode).padStart(2,"0");
      if(h)h.textContent=s.episode===1?"DAY ZERO":"THE "+(s.episode===6?"LAST DAY":"NEXT CHAPTER");
      if(p)p.textContent=EPISODES[s.episode-1].toUpperCase();
    }
  }
};
openingShots = function(){
  // Only confirmed participating cast is credited. Scenic interludes fill the
  // soundtrack duration instead of spoiling unencountered NPCs.
  const actors=s.players.concat(others()).filter(function(n,i,a){return alive(n)&&a.indexOf(n)===i;}).slice(0,7);
  const list=[
    {type:"presents",ms:3500},
    {type:"landscape",ms:3500,image:CINEMA_CITY,super:"THE WORLD YOU KNEW",line:"IS ALREADY GONE."},
    {type:"landscape",ms:3000,image:CINEMA_ROAD,super:"THE DEAD ARE WALKING",line:"EVERY ROAD HAS A PRICE."}
  ];
  actors.forEach(function(n,i){list.push({type:"cast",ms:2400,name:n,castIndex:i,
    credit:s.players.includes(n)?"STARRING · PLAYER "+(s.players.indexOf(n)+1):"ALSO STARRING",
    relation:"ONLY THE LIVING WRITE HISTORY"});});
  const elapsed=list.reduce(function(a,b){return a+b.ms;},0);
  const remaining=Math.max(2100,33400-elapsed);
  const captions=[
    ["NO MESSAGE REACHED HOME.","SILENCE IS NOT SAFETY."],
    ["TRUST IS A LUXURY.","EVERY ALLY WAS A STRANGER."],
    ["THEY DID NOT SEE IT COMING.","NOTHING STAYS BURIED."],
    ["ONE CHOICE CAN SAVE A LIFE.","ONE CHOICE CAN END IT."]
  ];
  const beats=Math.max(1,Math.min(4,Math.round(remaining/3500)));
  for(let i=0;i<beats;i++)list.push({type:"landscape",ms:Math.round(remaining/beats),
    image:i%2?CINEMA_ROAD:CINEMA_CITY,super:captions[i][0],line:captions[i][1]});
  list.push({type:"logo",ms:6500},{type:"episode",ms:4100});
  return list;
};

function nextEpisode(){
  if(!s||s.episode>=6)return;
  stopAmbient();
  s.episode++;
  s.step=0;s.phase="intro";s.votes=[];s.result=null;s.activeScenario=null;
  s.bitten=null;s.rescueTargets=[];s.episodeStartDeaths=dead().length;
  s.episodeStartChoices=s.decisions.length;
  s.resources.food=Math.max(1,Math.min(6,s.resources.food+1));
  if(s.episode===3)s.flags.betrayalSeen=false;
  save();render();goTop();
}
function resetPlayback(){
  stopOpening(false);stopAmbient();deathQueue=[];closeDeath();
}
document.querySelector("#brand-home").addEventListener("click",function(){stopAmbient();});
function musicAllowed(){return soundtrackEnabled&&!document.hidden&&s&&s.phase==="story"&&!opening;}
function startAmbient(){
  if(!musicAllowed())return;
  if(!ambient){ambient=new Audio(SCORE_AMBIENT);ambient.loop=true;ambient.volume=.19;}
  if(ambient.paused)ambient.play().catch(function(){});
}
function stopAmbient(){if(ambient&&!ambient.paused)ambient.pause();}
function toggleAmbient(){
  soundtrackEnabled=!soundtrackEnabled;safeSet("spirit-apocalypse-sound",soundtrackEnabled?"on":"off");
  if(soundtrackEnabled)startAmbient();else stopAmbient();
  updateSoundControl();
}
function updateSoundControl(){const el=document.querySelector("#game-sound");if(el)el.textContent=soundtrackEnabled?"♫ ON":"♫ OFF";}
function closeDeath(){
  clearTimeout(deathTimer);deathTimer=null;
  if(deathAudio){deathAudio.pause();deathAudio.currentTime=0;deathAudio=null;}
  const el=document.querySelector("#death-cinema");if(el)el.remove();
  document.body.classList.remove("death-lock");
  if(deathQueue.length)playDeath();
  else startAmbient();
}
function playDeath(){
  if(!deathQueue.length)return;
  const name=deathQueue.shift();
  stopAmbient();
  const layer=document.createElement("section");
  layer.id="death-cinema";layer.className="death-cinema";layer.setAttribute("role","dialog");
  layer.setAttribute("aria-label","Κινηματογραφική σκηνή θανάτου "+genitiveName(name));
  layer.innerHTML='<div class="death-flash"></div><div class="death-portrait">'+image(name)+'</div>'+
    '<div class="death-ink"></div><div class="death-caption"><span>THE SPIRIT APOCALYPSE · IN MEMORIAM</span>'+
    '<strong>'+html(name)+'</strong><div class="death-line"></div><p>ΕΝΑΣ ΑΚΟΜΗ ΑΝΘΡΩΠΟΣ ΧΑΘΗΚΕ.</p>'+
    '<small>ΚΑΜΙΑ ΕΠΙΛΟΓΗ ΔΕΝ ΞΕΧΝΙΕΤΑΙ.</small></div>'+
    '<button class="death-skip" type="button" id="death-dismiss">ΣΥΝΕΧΕΙΑ ↗</button><div class="death-shatter"></div>';
  document.body.append(layer);
  document.body.classList.add("death-lock");
  layer.querySelector("#death-dismiss").addEventListener("click",closeDeath);
  deathAudio=new Audio(SCORE_DEATH);deathAudio.volume=soundtrackEnabled?.92:0;
  deathAudio.play().catch(function(){});
  deathTimer=setTimeout(closeDeath,6800);
}
function showDeaths(names){
  names.forEach(function(n){if(n&&!deathQueue.includes(n))deathQueue.push(n);});
  if(!document.querySelector("#death-cinema"))playDeath();
}
document.addEventListener("visibilitychange",function(){if(document.hidden)stopAmbient();else startAmbient();});

function validSnapshot(raw){return validGameSnapshot(raw);}
function slotKey(i){return KEY+"-manual-slot-"+i;}
function slotInfo(i){
  try{const raw=JSON.parse(safeGet(slotKey(i))||"null");if(!validSnapshot(raw))return null;
    return {state:raw,date:raw.manualDate||"",players:raw.players.join(", "),episode:raw.episode||1};}catch(e){return null;}
}
function renderSaveModal(){
  const previous=document.querySelector("#save-dialog");if(previous)previous.remove();
  const layer=document.createElement("section");layer.id="save-dialog";layer.className="save-modal";layer.setAttribute("role","dialog");layer.setAttribute("aria-modal","true");layer.setAttribute("aria-label","Αποθήκευση και φόρτωση");
  layer.innerHTML='<div class="save-panel"><div class="save-top"><div><div class="eyebrow">SPIRIT APOCALYPSE / SURVIVAL RECORD</div><h2>SAVE / LOAD</h2></div><button class="save-x" data-save="close" aria-label="Κλείσιμο">✕</button></div>'+
    '<p class="save-explain">Το παιχνίδι αποθηκεύεται αυτόματα. Μπορείς επίσης να κρατήσεις τρία ανεξάρτητα saves ή να μεταφέρεις την πρόοδό σου σε άλλη συσκευή.</p>'+
    Array.from({length:SAVE_SLOTS},function(_,i){const info=slotInfo(i);return '<div class="save-slot"><div><strong>SLOT 0'+(i+1)+'</strong><small>'+(info?'EPISODE 0'+info.episode+' · '+html(info.players)+' · '+html(info.date):"EMPTY SLOT")+'</small></div>'+
      '<div class="save-actions"><button data-save="store" data-slot="'+i+'" '+(!s||!s.players.length?"disabled":"")+'>SAVE</button>'+
      '<button data-save="load" data-slot="'+i+'" '+(!info?"disabled":"")+'>LOAD</button>'+
      '<button data-save="delete" data-slot="'+i+'" '+(!info?"disabled":"")+'>✕</button></div></div>';}).join("")+
    '<div class="save-transfer"><button class="btn" data-save="export" '+(!s||!s.players.length?"disabled":"")+'>↓ EXPORT SAVE (.JSON)</button>'+
    '<button class="btn" data-save="import">↑ IMPORT SAVE</button><input id="save-file-input" type="file" accept=".json,application/json" hidden /></div>'+
    '<p class="tiny">Τα τοπικά saves αποθηκεύονται στον συγκεκριμένο browser. Για μεταφορά ή ασφάλεια, χρησιμοποίησε EXPORT.</p></div>';
  document.body.append(layer);saveDialogOpen=true;
  layer.addEventListener("click",async function(e){
    const btn=e.target.closest("[data-save]");if(!btn)return;
    const cmd=btn.dataset.save,slot=Number(btn.dataset.slot||0);
    if(cmd==="close"){layer.remove();saveDialogOpen=false;return;}
    if(cmd==="store"){
      if(!s||!s.players.length)return;
      const snapshot=JSON.parse(JSON.stringify(s));
      snapshot.manualDate=new Date().toLocaleString("el-GR");
      if(!safeSet(slotKey(slot),JSON.stringify(snapshot)))return;renderSaveModal();announce("Αποθηκεύτηκε στο Slot "+(slot+1));return;
    }
    if(cmd==="load"){
      const item=slotInfo(slot);if(!item)return;
      s=JSON.parse(JSON.stringify(item.state));normalize();save();layer.remove();saveDialogOpen=false;
      resetPlayback();render();goTop();announce("Φορτώθηκε το Slot "+(slot+1));return;
    }
    if(cmd==="delete"){
      if(!confirm("Να διαγραφεί το Slot "+(slot+1)+";"))return;
      try{localStorage.removeItem(slotKey(slot));}catch(e){}
      renderSaveModal();return;
    }
    if(cmd==="export"){
      const blob=new Blob([JSON.stringify(s,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
      anchor.href=url;anchor.download="spirit-apocalypse-episode-"+(s.episode||1)+"-save.json";
      anchor.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);return;
    }
    if(cmd==="import"){layer.querySelector("#save-file-input").click();}
  });
  layer.querySelector("#save-file-input").addEventListener("change",async function(e){
    const file=e.target.files[0];if(!file)return;
    if(file.size>3000000){announce("Το αρχείο είναι υπερβολικά μεγάλο.");return;}
    try{
      const parsed=JSON.parse(await file.text());
      if(!validSnapshot(parsed))throw new Error("invalid");
      s=parsed;normalize();save();layer.remove();saveDialogOpen=false;resetPlayback();render();goTop();announce("Το save φορτώθηκε επιτυχώς.");
    }catch(err){announce("Μη έγκυρο αρχείο save.");}
  });
  layer.addEventListener("click",function(e){if(e.target===layer){layer.remove();saveDialogOpen=false;}});
}
function enhanceHeader(){
  const right=document.querySelector(".header-right");if(!right)return;
  const chip=right.querySelector(".build-chip");if(chip)chip.textContent="SEASON ONE · BETA";
  right.insertAdjacentHTML("beforeend",'<button class="top-control" id="game-sound" type="button" title="Μουσική"></button>'+
    '<button class="top-control" id="game-saves" type="button">SAVE / LOAD</button>'+
    '<button class="top-control top-install" id="game-install" type="button">⬇ INSTALL</button>');
  updateSoundControl();
  document.querySelector("#game-sound").addEventListener("click",toggleAmbient);
  document.querySelector("#game-saves").addEventListener("click",renderSaveModal);
  
}
document.addEventListener("click",function(e){
  const btn=e.target.closest("[data-action]");if(!btn)return;
  if(btn.dataset.action==="save-modal"){renderSaveModal();}
  if(btn.dataset.action==="next-episode"){nextEpisode();}
  if(btn.dataset.action==="new"||btn.dataset.action==="home"){stopAmbient();}
});
window.addEventListener("keydown",function(e){
  if(e.key==="Escape"){const dlg=document.querySelector("#save-dialog");if(dlg){dlg.remove();saveDialogOpen=false;}
    const help=document.querySelector("#install-help");if(help)help.remove();}
});
enhanceHeader();
window.SpiritSeason={startAmbient:startAmbient,stopAmbient:stopAmbient,resetPlayback:resetPlayback};
render();
})();
