const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const KEY = "spirit-apocalypse-season1-v1";
const ORIGINAL_SCORE = "assets/audio/spirit-apocalypse-original-theme.mp3";
const TITLE_LOGO = "assets/cinematic/spirit-apocalypse-logo.png";
const CINEMA_CITY = "assets/cinematic/city-dawn.webp";
const CINEMA_ROAD = "assets/cinematic/forest-road.webp";
let opening = null;
function safeGet(key){try{return localStorage.getItem(key);}catch(e){return null;}}
function safeSet(key,value){
  try{localStorage.setItem(key,value);return true;}catch(e){
    if(typeof announce==="function")announce("Η αποθήκευση δεν είναι διαθέσιμη. Κάνε EXPORT SAVE για να κρατήσεις την πρόοδό σου.");
    return false;
  }
}
let soundtrackEnabled = safeGet("spirit-apocalypse-sound") !== "off";
const ROSTER = [
  ["Alex","char_alex.webp"],["Billy","char_billy.webp"],["Catherine","char_catherine.png"],
  ["Demarin","char_demarin.webp"],["Elisa","char_elisa.webp"],["Ester","char_ester.png"],
  ["Eva","char_eva.png"],["Evaggelia","char_evaggelia.png"],["Evelyn","char_evelyn.webp"],
  ["Hope","char_hope.webp"],["Ian","char_ian.png"],["Irene","char_irene.png"],
  ["Jasmine","char_jasmine.png"],["Luna","char_luna.webp"],["Paul","char_paul.png"],
  ["Pauline","char_pauline.webp"],["Phillip","char_phillip.webp"],["Rino","char_rino.webp"],
  ["Sargenie","char_sargenie-hq.png"],["Smaragda","char_smaragda-hq.png"],["Sorina","char_sorina.png"],
  ["Tony","char_tony.webp"],["Vicky","char_vicky.jpg"],["Vincent","char_vincent.jpg"],
  ["Violet","char_violet.png"],["Zoe","char_zoe-hq.png"]
].map(function(item){return {name:item[0],file:item[1],gender:characterGenders[item[0]],pronouns:characterPronouns[item[0]]};});
const RELATIONS = [
  ["Luna","Hope","Δίδυμες αδελφές"],["Demarin","Irene","Αδελφές"],
  ["Catherine","Evaggelia","Αδελφές"],["Rino","Pauline","Αδέλφια"],
  ["Rino","Billy","Σύντροφοι"],["Luna","Vincent","Σύντροφοι"],
  ["Hope","Paul","Σύντροφοι"],["Tony","Ian","Σύντροφοι"]
];
const EPISODES = [
  "Η πρώτη μέρα","Οι πύλες","Κανείς αθώος","Οι χαμένοι","Η γραμμή","Ό,τι απέμεινε"
];
const sceneMeta = [
  ["08:17 / DAY ZERO","Η τελευταία φυσιολογική μέρα"],
  ["09:06 / CITY CENTER","Η πρώτη συγκέντρωση"],
  ["12:42 / EXIT ROUTE","Κάθε διαδρομή έχει τίμημα"],
  ["17:18 / TEMPORARY SHELTER","Το σημάδι στο δέρμα"],
  ["20:51 / NORTHERN CHECKPOINT","Οι ζωντανοί είναι χειρότεροι"],
  ["22:13 / SAFEHOUSE","Αυτά που δεν ειπώθηκαν"],
  ["23:06 / RADIO FREQUENCY 04","Μια φωνή στο σκοτάδι"],
  ["23:59 / COLLAPSED BRIDGE","Δεν μπορείς να τους σώσεις όλους"],
  ["00:23 / END OF DAY ONE","Το πρώτο ξημέρωμα"]
];
let s = load();
let setup = { count:1, selected:[] };
let toastTimer;
function load(){
  try{
    const raw = JSON.parse(safeGet(KEY) || "null");
    if(typeof validGameSnapshot === "function" && validGameSnapshot(raw)) return raw;
  }catch(e){}
  return null;
}
function save(){return s ? safeSet(KEY,JSON.stringify(s)) : false;}
function dieRoll(){s.seed ^= s.seed << 13;s.seed ^= s.seed >>> 17;s.seed ^= s.seed << 5;return (s.seed >>> 0)/4294967296;}
function chance(n){return dieRoll()<Math.max(0,Math.min(1,n));}
function pick(list){return list[Math.floor(dieRoll()*list.length)] || null;}
function shuffle(list){let a=list.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(dieRoll()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function person(name){return ROSTER.find(function(x){return x.name===name;});}
function photo(name){return "assets/characters/"+(person(name)||ROSTER[0]).file;}
function image(name,cls){return '<img src="'+photo(name)+'" alt="'+name+'" class="'+(cls||"")+'" loading="lazy" onerror="this.style.opacity=0" />';}
function relation(a,b){return RELATIONS.find(function(x){return (x[0]===a&&x[1]===b)||(x[1]===a&&x[0]===b);});}
function links(name){return RELATIONS.filter(function(x){return x[0]===name||x[1]===name;}).map(function(x){return {name:x[0]===name?x[1]:x[0],label:x[2]};});}
function isMale(name){return characterGenders[name]==="male";}
function alive(name){return s.status[name]!=="dead" && s.status[name]!=="missing";}
function inGroup(){return Object.keys(s.status).filter(function(n){return s.status[n]==="group"||s.status[n]==="bitten"||s.status[n]==="wounded";});}
function others(){return inGroup().filter(function(n){return !s.players.includes(n);});}
function dead(){return Object.keys(s.status).filter(function(n){return s.status[n]==="dead";});}
function missing(){return Object.keys(s.status).filter(function(n){return s.status[n]==="missing";});}
function trust(name,delta){s.trust[name]=Math.max(0,Math.min(100,(s.trust[name]??50)+delta));}
function allTrust(delta){inGroup().forEach(function(n){if(!s.players.includes(n))trust(n,delta);});}
function announce(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){toast.classList.remove("show");},2300);}
function goTop(){window.scrollTo({top:0,behavior:"smooth"});}
function newRun(){
  let players=setup.selected.slice();
  if(players.length!==setup.count){announce("Επίλεξε "+setup.count+" χαρακτήρα/χαρακτήρες.");return;}
  s={version:1,phase:"intro",players:players,seed:(Math.random()*0xffffffff>>>0)||1307,step:0,
     status:{},trust:{},resources:{food:3,meds:2,security:1},danger:1,
     flags:{},decisions:[],result:null,votes:[],rescueTargets:[],bitten:null,notices:[],sceneCache:{}};
  // The protagonist begins without an NPC party. Relationships are revealed only on encounter.
  players.forEach(function(n){s.status[n]="group";});
  save();render();goTop();
}
function addAlly(name){if(!name||s.status[name]==="dead")return; s.status[name]="group";if(s.trust[name]===undefined)s.trust[name]=45;}
function newAlly(){let names=ROSTER.map(function(x){return x.name;}).filter(function(n){return !s.status[n]&&!s.players.includes(n);});return pick(names);}
function kill(name,reason){
  if(!name||s.players.includes(name)||s.status[name]==="dead")return false;
  s.status[name]="dead";
  if(reason)s.notices.push(name+" — "+reason);
  return true;
}
function ensureBite(){
  if(s.bitten && alive(s.bitten))return s.bitten;
  let candidates=others();
  if(candidates.length<1){let n=newAlly();if(n)addAlly(n);candidates=others();}
  s.bitten=pick(candidates);
  s.status[s.bitten]="bitten";
  return s.bitten;
}
function ensureRescue(){
  if(s.rescueTargets.length===2)return s.rescueTargets;
  while(others().length<2){let n=newAlly();if(!n)break;addAlly(n);}
  const candidates=others().filter(function(n){return s.status[n]!=="bitten";});
  const list=candidates.length>=2?candidates:others();
  s.rescueTargets=shuffle(list).slice(0,2);
  return s.rescueTargets;
}
function selectedClose(){
  for(const n of s.players){let x=links(n).find(function(l){return s.status[l.name]==="group";});if(x)return {player:n,name:x.name,label:x.label};}
  return null;
}
function relationshipAfterLoss(name){
  const attached=RELATIONS.filter(function(r){return r[0]===name||r[1]===name;});
  const witness=attached.map(function(r){return {name:r[0]===name?r[1]:r[0],bond:r[2]};}).find(function(x){return inGroup().includes(x.name);});
  if(!witness)return "";
  trust(witness.name,-13);
  s.flags.grief=s.flags.grief||[];
  s.flags.grief.push({lost:name,witness:witness.name,bond:witness.bond});
  return " Η απώλεια "+genitiveName(name)+" συγκλονίζει ιδιαίτερα "+witness.name+". Η σχέση τους ("+witness.bond+") δεν μπορεί να ξεχαστεί.";
}
function actorClose(actor){let link=links(actor).find(function(l){return s.status[l.name]==="group";});return link?{player:actor,name:link.name,label:link.label}:null;}
function displayName(name){return name||"κάποιος";}
function sideStats(){
  const group=inGroup();
  const relationHint=selectedClose();
  return '<aside class="side-panel">'+
    '<div class="side-card"><div class="eyebrow">SURVIVAL LOG</div><h3>Η ΚΑΤΑΣΤΑΣΗ</h3>'+
    '<div class="metric"><span>ΖΩΝΤΑΝΟΙ ΜΑΖΙ ΣΑΣ</span><strong>'+group.length+'</strong></div>'+
    '<div class="metric"><span>ΤΡΟΦΙΜΑ</span><strong>'+s.resources.food+' / 6</strong></div>'+
    '<div class="metric"><span>ΦΑΡΜΑΚΑ</span><strong>'+s.resources.meds+' / 6</strong></div>'+
    '<div class="metric"><span>ΑΣΦΑΛΕΙΑ</span><strong>'+s.resources.security+' / 5</strong></div>'+
    '<div class="metric"><span>ΝΕΚΡΟΙ</span><strong>'+dead().length+'</strong></div></div>'+
    '<div class="side-card"><div class="eyebrow">YOUR PEOPLE</div><h3>Η ΟΜΑΔΑ</h3><div class="member-list">'+
    group.slice(0,12).map(function(n){return '<div class="member">'+image(n)+'<span>'+n+'</span></div>';}).join("")+
    '</div></div>'+
    '<div class="side-card"><div class="eyebrow">THREAT LEVEL</div><h3>Ο ΚΙΝΔΥΝΟΣ ΑΥΞΑΝΕΤΑΙ</h3><div class="threat-bar">'+
    Array.from({length:6},function(_,i){return '<span class="'+(i<s.danger?"on":"")+'"></span>';}).join("")+
    '</div><p class="relation-note">'+(relationHint?relationHint.name+' — '+relationHint.label+' με '+relationHint.player+'. Οι δεσμοί σας μπορούν να αλλάξουν αποφάσεις.':'Οι νέες σχέσεις χτίζονται μέσα από τις αποφάσεις σας.')+'</p></div></aside>';
}
function scene(){
  const close=selectedClose();
  if(s.step===0)return {
    text:[
      "Το κινητό σου δονείται στις <strong>08:17</strong>. Τρεις ειδοποιήσεις έκτακτης ανάγκης. Καμία δεν εξηγεί γιατί άνθρωποι επιτίθενται σε περαστικούς.",
      "Στον δρόμο, ένα λεωφορείο πέφτει πάνω σε σταθμευμένα αυτοκίνητα. Κάποιος σηκώνεται από τις ρόδες του και συνεχίζει να περπατά.",
      "Η πόλη δεν γνωρίζει ακόμη τη λέξη «ζόμπι». Εσύ έχεις μόλις λίγα λεπτά."
    ],
    dialogue:{who:"ΑΓΝΩΣΤΗ ΦΩΝΗ / ΡΑΔΙΟ",text:"Μείνετε μέσα. Κλειδώστε τις πόρτες. Μην πλησιάζετε όποιον έχει δαγκωθεί."},
    choices:[
      {id:"call",name:s.players.length>1?"Επικοινώνησε με τους δικούς σου":close?"Πάρε τηλέφωνο "+close.name:"Πάρε τηλέφωνο έναν φίλο",hint:"Οι προσωπικοί δεσμοί έρχονται πρώτοι."},
      {id:"supplies",name:"Μάζεψε όσα μπορείς",hint:"Νερό, φάρμακα και τρόφιμα πριν βγεις."},
      {id:"rescue",name:"Βοήθησε έναν άγνωστο",hint:"Ένας άνθρωπος χτυπά απελπισμένα την πόρτα."},
      {id:"look",name:"Παρακολούθησε τη γειτονιά",hint:"Κατάλαβε πρώτα πού ξεκίνησε η επίθεση."}
    ]
  };
  if(s.step===1)return {
    text:[
      "Στο παλιό τραμ καταφέρνετε να συναντηθείτε με άλλους επιζώντες. Κανείς δεν ξέρει πόσες ώρες έχουν περάσει. Όλοι μιλούν ταυτόχρονα.",
      "Μια γυναικεία κραυγή ακούγεται από τα διπλανά στενά. Πίσω σας η λεωφόρος έχει αρχίσει να γεμίζει σκιές.",
      "Η ομάδα περιμένει από εσάς την πρώτη κοινή απόφαση."
    ],
    dialogue:{who:pickStaticSpeaker(),text:"Ό,τι κι αν κάνουμε, ας το αποφασίσουμε τώρα. Έξω δεν έχουμε δεύτερη ευκαιρία."},
    choices:[
      {id:"strangers",name:"Βοήθησε τους εγκλωβισμένους",hint:"Μπορεί να κερδίσεις νέους συμμάχους."},
      {id:"secure",name:"Οχύρωσε τον σταθμό",hint:"Προστάτευσε όσους βρίσκονται ήδη μαζί σου."},
      {id:"pharmacy",name:"Κάνε έφοδο στο φαρμακείο",hint:"Τα εφόδια θα χρειαστούν πολύ σύντομα."},
      {id:"rush",name:"Φύγε πριν νυχτώσει",hint:"Καμία καθυστέρηση. Καμία υπόσχεση."}
    ]
  };
  if(s.step===2)return {
    text:[
      "Η έξοδος από το κέντρο έχει αποκλειστεί. Τα φώτα της πόλης σβήνουν ένα ένα, σαν κάποιος να τραβά ένα τεράστιο καλώδιο.",
      "Μια διαδρομή περνά από τον υπόγειο διάδρομο. Μια δεύτερη από ταράτσες. Η τρίτη διασχίζει το παλιό νοσοκομείο.",
      "Πρέπει να βρεθείτε σε ασφαλές μέρος πριν πέσει το απόλυτο σκοτάδι."
    ],
    dialogue:{who:"ΑΣΥΡΜΑΤΟΣ ΑΣΤΥΝΟΜΙΑΣ",text:"...όποια μονάδα ακούει... το νοσοκομείο δεν είναι ασφαλές. Επαναλαμβάνω—"},
    choices:[
      {id:"tunnel",name:"Πέρνα από το τούνελ",hint:"Σύντομο, αλλά σχεδόν τελείως σκοτεινό."},
      {id:"roofs",name:"Ανέβα στις ταράτσες",hint:"Μακριά από τα πλήθη, με κίνδυνο πτώσης."},
      {id:"hospital",name:"Διέσχισε το νοσοκομείο",hint:"Ιατρικές προμήθειες, άγνωστος κίνδυνος."},
      {id:"roads",name:"Ακολούθησε τον περιφερειακό",hint:"Αργό ταξίδι, αλλά με καλύτερη ορατότητα."}
    ]
  };
  if(s.step===3){
    const bitten=s.bitten||ensureBite();
    return {
      text:[
        "Μέσα στο προσωρινό καταφύγιο, "+bitten+" κλείνει απότομα το μανίκι "+(isMale(bitten)?"του":"της")+".",
        "Το αίμα έχει ήδη στεγνώσει γύρω από <strong>ένα βαθύ δάγκωμα στο χέρι</strong>. Η ομάδα σωπαίνει. Η πληγή δεν κρύβεται πια.",
        "Δεν ξέρετε με βεβαιότητα αν ο ακρωτηριασμός μπορεί να σταματήσει τη μόλυνση. Ο χρόνος λιγοστεύει."
      ],
      dialogue:{who:bitten.toUpperCase(),text:"Σας παρακαλώ... μην αποφασίσετε για μένα σαν να έχω πεθάνει ήδη."},
      choices:[
        {id:"isolate",name:"Απομόνωσε "+bitten,hint:"Παρακολουθήστε τα συμπτώματα χωρίς άμεση βία."},
        {id:"amputate",name:"Προσπάθησε να σώσεις "+(isMale(bitten)?"τον ":"την ")+bitten,hint:"Επικίνδυνος ακρωτηριασμός — χρειάζονται φάρμακα."},
        {id:"hide",name:"Κρύψε το δάγκωμα",hint:"Προστάτευσε το μυστικό, ρισκάροντας την ομάδα."},
        {id:"leave",name:"Άφησε "+(isMale(bitten)?"τον ":"την ")+bitten+" πίσω",hint:"Απομάκρυνε τον κίνδυνο από το καταφύγιο."},
        {id:"end",name:"Σκότωσε "+(isMale(bitten)?"τον ":"την ")+bitten+" πριν μετατραπεί",hint:"Μη αναστρέψιμη απόφαση. Η ομάδα θα θυμάται."}
      ]
    };
  }
  if(s.step===4)return {
    text:[
      "Σε ένα πρόχειρο οδόφραγμα σας σταματούν ένοπλοι επιζώντες. Δεν φορούν στολές, αλλά έχουν όπλα, νερό και ένα φορτηγό.",
      "Ο αρχηγός τους ζητά τα μισά σας εφόδια για να περάσετε. Πίσω από τον φράχτη βλέπετε ανθρώπους που μπορεί να γνωρίζατε πριν από την καταστροφή.",
      "Ένας από τους δικούς σας ψιθυρίζει ότι αυτοί οι άνθρωποι δεν πρόκειται να τηρήσουν καμία συμφωνία."
    ],
    dialogue:{who:"ΑΡΧΗΓΟΣ ΟΔΟΦΡΑΓΜΑΤΟΣ",text:"Εδώ έξω δεν υπάρχουν καλοί και κακοί. Υπάρχουν μόνο αυτοί που έχουν κάτι να ανταλλάξουν."},
    choices:[
      {id:"trade",name:"Δώσε τρόφιμα για πέρασμα",hint:"Χάνεις πόρους, αποφεύγεις μια σύγκρουση."},
      {id:"talk",name:"Προσπάθησε να τους πείσεις",hint:"Η εμπιστοσύνη και η ψυχραιμία μπορεί να βοηθήσουν."},
      {id:"sneak",name:"Πέρασε κρυφά από πίσω",hint:"Αν σας δουν, δεν θα μπορείτε να εξηγήσετε."},
      {id:"fight",name:"Αμφισβήτησέ τους με τη βία",hint:"Μεγάλος κίνδυνος, πιθανώς μεγάλο κέρδος."}
    ]
  };
  if(s.step===5){
    const close=selectedClose(), speaker=close?close.name:(others()[0]||"κάποιος από την ομάδα");
    return {
      text:[
        "Στην ησυχία του καταφυγίου ακούγεται μόνο μια χαλασμένη γεννήτρια. Κάποιος έχει γράψει στον τοίχο: <strong>ΑΝ ΔΙΑΒΑΖΕΙΣ ΑΥΤΟ, ΕΙΜΑΙ ΑΚΟΜΗ ΕΔΩ.</strong>",
        speaker+" κάθεται απέναντί σου. Δεν προσπαθεί πια να κρύψει πόσο φοβάται. Οι υπόλοιποι αποφεύγουν να μιλήσουν για όσα έγιναν σήμερα.",
        "Λίγο πριν συνεχίσετε, έχεις χρόνο για μία τελευταία ανθρώπινη κίνηση."
      ],
      dialogue:{who:speaker.toUpperCase(),text:"Πες μου ότι μετά απ' όλα αυτά θα μπορούμε να κοιταχτούμε στα μάτια."},
      choices:[
        {id:"openup",name:"Μίλα ειλικρινά με "+speaker,hint:"Μια προσωπική στιγμή μπορεί να χτίσει εμπιστοσύνη."},
        {id:"apologize",name:"Ζήτησε συγγνώμη για τις δύσκολες αποφάσεις",hint:"Κάποιοι χρειάζονται να ακούσουν ότι τους καταλαβαίνεις."},
        {id:"suppliesCheck",name:"Έλεγξε το κρυφό ντουλάπι",hint:"Ψάξε χρήσιμους πόρους πριν φύγετε."},
        {id:"watch",name:"Ανάλαβε τη σκοπιά",hint:"Άφησε τους άλλους να ξεκουραστούν."}
      ]
    };
  }
  if(s.step===6){
    return {
      text:[
        "Ο ασύρματος ξυπνά με ένα μακρόσυρτο παράσιτο. Μια άγνωστη γυναίκα μιλά τόσο χαμηλόφωνα που σχεδόν δεν την ακούτε.",
        "«Είμαστε στο βόρειο πέρασμα. Υπάρχει φως και φαγητό. Αν θέλετε να ζήσετε, απαντήστε τώρα». Στο βάθος ακούγεται ένας μεταλλικός γδούπος και μετά σιωπή.",
        "Κανείς δεν μπορεί να ξέρει αν πρόκειται για διάσωση, παγίδα ή μια ακόμη ομάδα που πεθαίνει."
      ],
      dialogue:{who:"FREQUENCY 04 / ΑΓΝΩΣΤΟ ΣΗΜΑ",text:"Αν κάποιος σας ακολουθεί... μη φέρετε την ομάδα σας εδώ. Σας παρακαλώ."},
      choices:[
        {id:"answer",name:"Απάντησε στο σήμα",hint:"Μπορεί να αποκτήσετε επικοινωνία με άλλο καταφύγιο."},
        {id:"silent",name:"Μείνετε σιωπηλοί",hint:"Κανείς δεν μαθαίνει πού βρίσκεστε."},
        {id:"falsepos",name:"Δώσε ψεύτικη τοποθεσία",hint:"Δοκιμάζεις αν η φωνή σάς παρακολουθεί."},
        {id:"trace",name:"Αναζήτησε την πηγή του σήματος",hint:"Ρίσκο, αλλά πιθανή πληροφορία για την επόμενη μέρα."}
      ]
    };
  }
  if(s.step===7){
    const pair=ensureRescue(), a=pair[0],b=pair[1];
    return {
      text:[
        "Μια σειρήνα ουρλιάζει στην άκρη της γέφυρας. Το πλήθος των μολυσμένων σπρώχνει τις μπάρες. Η παλιά διάβαση καταρρέει.",
        "<strong>"+a+"</strong> και <strong>"+b+"</strong> μένουν παγιδευμένοι σε αντίθετες πλευρές. Μπορείτε να τρέξετε προς έναν από τους δύο ή να επιχειρήσετε κάτι σχεδόν αδύνατο.",
        "Ο υπόλοιπος κόσμος σας παρακολουθεί. Όποιον κι αν διαλέξετε, κάποιος θα το θυμάται."
      ],
      dialogue:{who:a.toUpperCase(),text:"Μη μας αφήσετε εδώ! Σας παρακαλώ!"},
      choices:[
        {id:"both",name:"Σώσε και τους δύο",hint:"Το μεγαλύτερο ρίσκο. Μπορεί να κοστίσει και σε τρίτον."},
        {id:"first",name:"Σώσε μόνο "+a,hint:"Επικεντρώνεσαι στον πρώτο παγιδευμένο."},
        {id:"second",name:"Σώσε μόνο "+b,hint:"Επικεντρώνεσαι στον δεύτερο παγιδευμένο."},
        {id:"none",name:"Μη ρισκάρεις",hint:"Φεύγετε όσο υπάρχει ακόμη διέξοδος."}
      ]
    };
  }
  return {text:["Η πόλη πίσω σας φωτίζεται για λίγο από μια έκρηξη. Οι ζωντανοί δεν πανηγυρίζουν. Μετρούν απουσίες.","Το πρώτο βράδυ τελείωσε. Η ιστορία σας, όμως, μόλις άρχισε."],dialogue:{who:"Η ΤΕΛΕΥΤΑΙΑ ΡΑΔΙΟΦΩΝΙΚΗ ΜΕΤΑΔΟΣΗ",text:"Αν κάποιος ακούει... υπάρχει καταφύγιο στον βορρά. Μην εμπιστεύεστε κανέναν."},choices:[{id:"finish",name:"Δες τα αποτελέσματα του επεισοδίου",hint:"Επιζώντες, απώλειες, επιλογές και εμπιστοσύνη."}]};
}
function pickStaticSpeaker(){return others()[0]||"ΚΑΠΟΙΟΣ ΑΠΟ ΤΗΝ ΟΜΑΔΑ";}
function sceneEffect(id){
  const close=selectedClose();
  const report={heading:"Η ιστορία άλλαξε.",text:"",warning:false};
  if(s.step===0){
    if(id==="call"){
      if(s.players.length>1){const contacts=s.players.map(actorClose).filter(Boolean);const names=[...new Set(contacts.map(function(c){trust(c.name,15);return c.name;}))];s.flags.called=names;report.text=names.length?"Καταφέρνετε να επικοινωνήσετε με "+names.join(", ")+". Οι προσωπικοί δεσμοί της ομάδας γίνονται η πρώτη σας δύναμη.":"Προλαβαίνετε να ειδοποιήσετε ανθρώπους πριν καταρρεύσουν οι τηλεφωνικές γραμμές.";}
      else if(close){trust(close.name,16);s.flags.called=close.name;report.text="Κατάφερες να μιλήσεις με "+close.name+". Η φωνή "+genderWord(close.name,"του","της")+" σπάει όταν ακούει τη δική σου. Υποσχεθήκατε ότι δεν θα χαθείτε.";}
      else {allTrust(5);report.text="Συγκέντρωσες φίλους πριν πέσουν οι γραμμές. Για λίγο, το χάος μοιάζει λιγότερο μοναχικό.";}
    }else if(id==="supplies"){s.resources.food+=2;s.resources.meds+=1;report.text="Γεμίζεις ένα σακίδιο με κονσέρβες, νερό και επιδέσμους. Το βάρος του δεν σου αφήνει περιθώριο να τρέξεις γρήγορα.";}
    else if(id==="rescue"){let n=newAlly();addAlly(n);trust(n,22);s.flags.firstRescue=n;report.text="Ανοίγεις την πόρτα την τελευταία στιγμή. "+n+" μπαίνει τρέχοντας και σε κοιτάζει με μάτια γεμάτα ευγνωμοσύνη. Μόλις έσωσες μια ζωή.";s.danger+=1;}
    else {s.resources.security+=1;s.danger=Math.max(1,s.danger-1);report.text="Παρατηρείς τη διαδρομή των επιθέσεων. Αναγνωρίζεις ένα ασφαλές πέρασμα, αλλά ο χρόνος που έχασες δεν επιστρέφει.";}
  } else if(s.step===1){
    if(id==="strangers"){let a=newAlly();addAlly(a);let b=newAlly();addAlly(b);trust(a,18);trust(b,18);s.resources.food=Math.max(0,s.resources.food-1);s.danger+=1;report.text=a+" και "+b+" έρχονται μαζί σας. Οι δύο νέοι επιζώντες δεν θα ξεχάσουν ότι επέστρεψες γι' αυτούς.";}
    else if(id==="secure"){s.resources.security=Math.min(5,s.resources.security+2);allTrust(7);report.text="Κλείνετε τις εισόδους και μεταφέρετε έπιπλα στις σκάλες. Η ομάδα αισθάνεται ασφαλέστερη, έστω για λίγες ώρες.";}
    else if(id==="pharmacy"){s.resources.meds+=2;let a=newAlly();if(chance(.65)){addAlly(a);report.text="Βρίσκετε φάρμακα και συναντάτε "+a+", που ενώνεται με την ομάδα.";}else{report.text="Επιστρέφετε με φάρμακα, αλλά μια μολυσμένη φιγούρα σας ακολουθεί μέχρι τον σταθμό.";s.danger+=1;}}
    else {s.danger=Math.max(1,s.danger-1);allTrust(-6);report.text="Φεύγετε βιαστικά. Μερικοί πίσω σας ζητούν βοήθεια. Κανείς δεν γυρίζει. Η σιωπή μέσα στην ομάδα βαραίνει.";}
  } else if(s.step===2){
    if(id==="tunnel"){s.danger+=2;if(chance(.36)){s.resources.food=Math.max(0,s.resources.food-1);report.text="Στο σκοτάδι χάνετε μέρος των προμηθειών. Βγαίνετε τρέχοντας στο φως, με τον ήχο βημάτων πίσω σας.";}else{report.text="Ο σκοτεινός διάδρομος αποδεικνύεται σύντομος. Φτάνετε στο καταφύγιο προτού σας εντοπίσουν."}}
    else if(id==="roofs"){s.danger+=1;if(chance(.38)&&others().length>2){let n=pick(others());s.status[n]="wounded";s.resources.meds=Math.max(0,s.resources.meds-1);report.text=n+" πέφτει σε ένα μεταλλικό στέγαστρο και τραυματίζεται. "+genderWord(n,"Τον","Την")+" τραβάτε πάνω, αλλά χρειάζεστε επιδέσμους.";}else{report.text="Περνάτε πάνω από τις ταράτσες. Για πρώτη φορά βλέπετε το μέγεθος της καταστροφής."}}
    else if(id==="hospital"){s.resources.meds+=2;s.danger+=2;report.text="Το νοσοκομείο είναι γεμάτο εγκαταλελειμμένα φορεία. Βρίσκετε φάρμακα, αλλά ακούτε κάτι να σας ακολουθεί ανάμεσα στους θαλάμους.";}
    else {s.resources.food=Math.max(0,s.resources.food-1);s.resources.security+=1;report.text="Η παράκαμψη σας κοστίζει τροφή, όμως βρίσκετε ένα μέρος όπου μπορείτε να κλείσετε τα παράθυρα και να ανάψετε μια μικρή φωτιά.";}
  } else if(s.step===3){
    const n=s.bitten;
    if(id==="isolate"){s.flags.bite="isolated";s.status[n]="missing";trust(n,-15);allTrust(3);report.text="Κλειδώνετε "+n+" σε ξεχωριστό δωμάτιο με νερό και ασύρματο. Η μοίρα "+genderWord(n,"του","της")+" παραμένει άγνωστη. Η απόφαση θα επιστρέψει αργότερα.";}
    else if(id==="amputate"){
      s.resources.meds=Math.max(0,s.resources.meds-1);s.flags.bite="amputation";
      if(chance(.38+.09*s.resources.meds)){s.status[n]="wounded";trust(n,20);allTrust(6);report.text="Η επέμβαση είναι τρομακτική, αλλά "+n+" επιβιώνει. Δεν ξέρετε ακόμη αν η μόλυνση σταμάτησε. Ο πόνος, πάντως, είναι αληθινός.";}
      else {kill(n,"Πέθανε μετά την αποτυχημένη προσπάθεια να σταματήσει η μόλυνση.");allTrust(-9);report.warning=true;report.heading="ΑΝΑΚΟΙΝΩΣΗ ΘΑΝΑΤΟΥ";report.text=n+" δεν αντέχει την απώλεια αίματος. Η ομάδα μένει για ώρα ακίνητη. Ένα ακόμη σώμα, μία ακόμη επιλογή που δεν γυρίζει πίσω.";}
    } else if(id==="hide"){s.flags.bite="hidden";trust(n,16);allTrust(-7);s.danger+=2;report.text="Καλύπτεις το δάγκωμα και ζητάς σιωπή. "+n+" σε ευχαριστεί, αλλά κάποιος είδε το αίμα και αρχίζει να υποψιάζεται.";}
    else if(id==="leave"){s.flags.bite="abandoned";s.status[n]="missing";trust(n,-35);allTrust(-8);report.text="Αφήνετε νερό και ένα φακό. "+n+" δεν σας αποχαιρετά. Κανείς δεν ξέρει αν θα ξανασυναντηθείτε.";}
    else {s.flags.bite="killed";kill(n,"Η ομάδα αποφάσισε να μην περιμένει τη μεταμόρφωση.");allTrust(-19);report.warning=true;report.heading="ΑΝΑΚΟΙΝΩΣΗ ΘΑΝΑΤΟΥ";report.text="Ο πυροβολισμός ακούγεται πιο δυνατός από κάθε κραυγή έξω. "+n+" δεν ανασαίνει πια. Μερικοί πιστεύουν ότι τους έσωσες. Άλλοι δεν θα σε συγχωρήσουν.";}
  } else if(s.step===4){
    if(id==="trade"){s.resources.food=Math.max(0,s.resources.food-2);s.danger=Math.max(1,s.danger-1);allTrust(4);report.text="Αφήνεις τις προμήθειες μπροστά τους. Το φορτηγό σας ανοίγει πέρασμα. Δεν ξέρετε αν αγοράσατε ασφάλεια ή απλώς χρόνο.";}
    else if(id==="talk"){if(chance(.55+s.resources.security*.045)){let n=newAlly();addAlly(n);trust(n,10);report.text="Ο αρχηγός δέχεται να σας περάσει. "+n+" επιλέγει να φύγει μαζί σας — ίσως ένας καινούργιος σύμμαχος.";allTrust(7);}else{s.danger+=1;report.text="Δεν σας εμπιστεύονται. Αναγκάζεστε να υποχωρήσετε μέσα από επικίνδυνα στενά.";allTrust(-4);}}
    else if(id==="sneak"){if(chance(.65-s.danger*.035)){s.resources.food+=1;report.text="Περνάτε απαρατήρητοι και βρίσκετε μια κούτα προμήθειες πίσω από το φορτηγό.";}else{s.danger+=2;report.text="Μια σκοπιά σας εντοπίζει. Σφαίρες χτυπούν την άσφαλτο. Τρέχετε χωρίς να κοιτάξετε πίσω.";}}
    else {s.danger+=2;s.resources.security=Math.max(0,s.resources.security-1);if(chance(.28)&&others().length>2){let n=pick(others());kill(n,"Σκοτώθηκε στη σύγκρουση με το οδόφραγμα.");report.warning=true;report.heading="ΑΝΑΚΟΙΝΩΣΗ ΘΑΝΑΤΟΥ";report.text="Η σύγκρουση κρατά λιγότερο από ένα λεπτό. "+n+" πέφτει στην άσφαλτο και δεν σηκώνεται. Σας αφήνουν να περάσετε, αλλά το τίμημα είναι αβάσταχτο.";}else{report.text="Το οδόφραγμα υποχωρεί μέσα στον πανικό. Φεύγετε με την αίσθηση ότι αποκτήσατε εχθρούς.";}}
  } else if(s.step===5){
    const close=selectedClose();
    if(id==="openup"){
      const n=close?close.name:others()[0];trust(n,19);s.flags.heartToHeart=n;
      report.text="Κάθεσαι δίπλα σε "+n+" και μιλάτε για τον κόσμο που χάσατε. Για λίγα λεπτά, η λέξη «επιβίωση» σημαίνει κάτι περισσότερο από φόβο.";
    } else if(id==="apologize"){
      allTrust(10);s.flags.apology=true;
      report.text="Παραδέχεσαι ότι δεν υπήρχαν εύκολες επιλογές. Κάποιοι δεν απαντούν, αλλά η σιωπή τους δεν μοιάζει πια με εχθρότητα.";
    } else if(id==="suppliesCheck"){
      s.resources.food+=1;s.resources.meds+=1;s.flags.cacheFound=true;
      report.text="Κάτω από μια σπασμένη σανίδα βρίσκεις κονσέρβες και φάρμακα. Κάποιος τα είχε κρύψει πριν εγκαταλείψει το καταφύγιο.";
    } else {
      s.resources.security+=1;allTrust(5);s.flags.keptWatch=true;
      report.text="Μένεις ξύπνιος/α στη σκοπιά όσο οι άλλοι αποκοιμιούνται. Όταν ξημερώσει, θα θυμούνται ότι τους προστάτεψες.";
    }
  } else if(s.step===6){
    if(id==="answer"){
      if(chance(.6)){s.flags.radioAlly=true;report.text="Η φωνή δίνει ένα συνθηματικό και υπόσχεται να ανάψει φως στο βόρειο πέρασμα. Ίσως υπάρχει ακόμη κάποιος που θέλει να βοηθήσει.";}
      else{s.flags.radioTrap=true;s.danger+=1;report.text="Απαντάς, αλλά η γυναίκα σωπαίνει απότομα. Στο βάθος ακούγεται κάποιος να επαναλαμβάνει τη θέση σας. Ήταν παγίδα;";}
    } else if(id==="silent"){
      s.resources.security+=1;s.flags.radioSilent=true;report.text="Κλείνεις τον ασύρματο. Κανείς δεν θα βρει τη θέση σας από αυτή τη συχνότητα. Αλλά ίσως μόλις αγνόσατε κάποιον που χρειαζόταν βοήθεια.";
    } else if(id==="falsepos"){
      s.flags.radioFalsePos=true;if(chance(.4)){s.danger=Math.max(1,s.danger-1);report.text="Λίγα λεπτά μετά τη ψεύτικη τοποθεσία, ακούτε κινητήρες να κατευθύνονται αλλού. Κάποιος είχε στήσει ενέδρα.";}
      else{report.text="Καμία απάντηση. Η ομάδα δεν ξέρει αν ξεγέλασε κάποιον ή αν έστειλε έναν αθώο σε λάθος μέρος.";}
    } else {
      s.flags.radioTraced=true;s.danger+=1;report.text="Εντοπίζετε μια ασθενή εκπομπή κοντά σε έναν παλιό αναμεταδότη. Κρατάτε τις συντεταγμένες. Μπορεί να αποδειχθούν σωτηρία — ή παγίδα.";
    }
  } else if(s.step===7){
    const a=s.rescueTargets[0],b=s.rescueTargets[1];
    const rescueP=Math.max(.12,Math.min(.88,.38+s.resources.security*.08+s.resources.meds*.045-s.danger*.045));
    if(id==="both"){
      if(chance(rescueP)){trust(a,23);trust(b,23);s.flags.savedBoth=true;report.text="Τρέχετε στο πιο επικίνδυνο σημείο της γέφυρας. Την τελευταία στιγμή τραβάτε και τους δύο στο ασφαλές έδαφος. "+a+" και "+b+" είναι ζωντανοί.";if(chance(.28)){let third=pick(others().filter(function(n){return n!==a&&n!==b;}));if(third){kill(third,"Χάθηκε ενώ κάλυπτε τη διάσωση δύο άλλων επιζώντων.");report.warning=true;report.heading="ΜΙΑ ΔΙΑΣΩΣΗ. ΜΙΑ ΑΠΩΛΕΙΑ.";report.text+=" Όμως "+subjectName(third,true)+" έμεινε πίσω για να καλύψει τη διαφυγή. Δεν επέστρεψε ποτέ.";}}}
      else {let lost=pick([a,b]);kill(lost,"Χάθηκε όταν απέτυχε η διάσωση δύο ατόμων.");trust(lost===a?b:a,8);report.warning=true;report.heading="ΑΝΑΚΟΙΝΩΣΗ ΘΑΝΑΤΟΥ";report.text="Το σχοινί σπάει. Προλαβαίνετε να τραβήξετε μόνο "+(lost===a?b:a)+". "+lost+" εξαφανίζεται στο χάος της γέφυρας. Η απόφαση να σώσετε και τους δύο δεν αρκούσε.";}
    }else if(id==="first"||id==="second"){let saved=id==="first"?a:b;let lost=id==="first"?b:a;trust(saved,25);if(chance(.76+s.resources.security*.03)){kill(lost,"Δεν σώθηκε στη γέφυρα.");report.warning=true;report.heading="ΑΝΑΚΟΙΝΩΣΗ ΘΑΝΑΤΟΥ";report.text="Σώζεις "+saved+". "+lost+" απλώνει το χέρι για τελευταία φορά πριν χαθεί μέσα στο πλήθος. Η ομάδα δεν θα ξεχάσει ποιον επέλεξες.";}else{s.status[lost]="missing";report.text="Σώζεις "+saved+". "+lost+" χάνεται πίσω από τον καπνό. Κανείς δεν ξέρει αν ζει.";}s.flags.rescued=saved;}
    else {s.status[a]="missing";s.status[b]="missing";allTrust(-13);s.flags.rescued="none";report.warning=true;report.heading="ΚΑΝΕΙΣ ΔΕΝ ΓΥΡΙΣΕ ΠΙΣΩ";report.text="Η ομάδα υποχωρεί. Οι φωνές των "+a+" και "+b+" χάνονται. Δεν βρέθηκαν σώματα — μόνο ένα άδειο πέρασμα και δύο ονόματα που κανείς δεν τολμά να πει.";}
  }
  s.resources.food=Math.min(6,Math.max(0,s.resources.food));
  s.resources.meds=Math.min(6,Math.max(0,s.resources.meds));
  s.resources.security=Math.min(5,Math.max(0,s.resources.security));
  s.danger=Math.min(6,Math.max(1,s.danger));
  return report;
}
function choose(index){
  if(!s||s.phase!=="story"||s.result)return;
  const current=scene();
  const chosen=current.choices[index];
  if(!chosen)return;
  if(s.step===8){s.phase="report";save();render();goTop();return;}
  s.votes.push(index);
  if(s.votes.length<s.players.length){save();render();goTop();return;}
  const counts={};
  s.votes.forEach(function(i){counts[i]=(counts[i]||0)+1;});
  const best=Math.max.apply(null,Object.values(counts));
  const winners=Object.keys(counts).filter(function(i){return counts[i]===best;}).map(Number);
  const decided=winners.length===1?winners[0]:pick(winners);
  const c=current.choices[decided];
  const previousDead=dead();
  const result=sceneEffect(c.id);
  dead().filter(function(n){return !previousDead.includes(n);}).forEach(function(n){result.text+=relationshipAfterLoss(n);});
  if(s.players.length>1 && winners.length>1)result.text+=" Η ομάδα ήταν διχασμένη· η ισοψηφία έκρινε τυχαία την τελική κίνηση.";
  if(s.players.length>1 && new Set(s.votes).size>1)allTrust(-2);
  s.decisions.push({title:sceneMeta[s.step][1],choice:c.name,detail:result.text.replace(/<[^>]*>/g,"").slice(0,180)});
  s.result=result;
  s.votes=[];
  save();render();goTop();
}
function nextScene(){
  s.step+=1;s.result=null;s.votes=[];
  if(s.step===3)ensureBite();
  if(s.step===7)ensureRescue();
  save();render();goTop();
}
function renderHome(){
  document.title="THE SPIRIT APOCALYPSE — SEASON 01";
  const city='<svg class="cityscape" viewBox="0 0 620 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fadeCity" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#34413a"/><stop offset="1" stop-color="#020605"/></linearGradient></defs><path fill="#1d2825" d="M0 360h39v-80h46v55h45v-150h60v35h25v-62h65v166h37v-118h75v96h42v-190h55v96h60v-33h71v115h60v410H0z"/><path fill="url(#fadeCity)" d="M0 466h26v-101h52v75h45V300h45v70h41V252h66v152h50V334h58v-68h40v143h45V210h50v145h45v-95h54v170h65v270H0z"/><path fill="#060b09" d="M0 580h49V435h39v55h48V395h34v65h29V367h61v125h49V420h62v-65h37v106h48V319h70v170h48V409h53v55h63v236H0z"/><g fill="#cfaa68" opacity=".58"><rect x="153" y="413" width="6" height="15"/><rect x="175" y="414" width="6" height="15"/><rect x="221" y="398" width="7" height="15"/><rect x="234" y="398" width="7" height="15"/><rect x="384" y="392" width="7" height="15"/><rect x="500" y="330" width="7" height="14"/><rect x="516" y="330" width="7" height="14"/></g><path d="M0 600l150-55 50 29 78-80 80 27 60-45 190 92" stroke="#0f1914" stroke-width="22" fill="none"/><path d="M290 700l-2-285m-5-6h14m-7 17l-54-90" stroke="#040807" stroke-width="10" fill="none"/><path d="M270 430q12-6 20 0q12-6 23 0" stroke="#040807" stroke-width="5" fill="none"/></svg>';
  app.innerHTML='<div class="home"><div class="home-hero"><div class="home-copy">'+
    '<div class="eyebrow"><span class="bar">●</span> SPIRIT UNIVERSE / NEW SURVIVAL SERIES</div>'+
    '<img class="main-title-logo" src="'+TITLE_LOGO+'" alt="THE SPIRIT APOCALYPSE" />'+
    '<div class="intro-kicker">THE END IS ONLY THE BEGINNING.</div>'+
    '<p>Έξι επεισόδια. Το ίδιο cast. Μια διαφορετική αποκάλυψη κάθε φορά. Εσύ αποφασίζεις ποιος θα βρεθεί δίπλα σου, ποιον θα σώσεις και ποιον θα χάσεις.</p>'+
    '<div class="button-row"><button class="btn primary" data-action="new">ΞΕΚΙΝΑ ΤΗ ΣΕΙΡΑ <span class="arrow">↗</span></button>'+
    (s&&s.phase!=="home"?'<button class="btn" data-action="continue">ΣΥΝΕΧΙΣΕ ΤΟ SAVE ↗</button>':'')+'</div>'+
    '<div class="feature-line"><span><b>26</b> ΧΑΡΑΚΤΗΡΕΣ</span><span><b>6</b> ΕΠΕΙΣΟΔΙΑ</span><span><b>∞</b> ΔΙΑΦΟΡΕΤΙΚΕΣ ΙΣΤΟΡΙΕΣ</span></div>'+
    '</div><div class="hero-art"><div class="sun-disc"></div>'+city+'<div class="poster-caption"><div><strong>DAY ZERO</strong>THE END STARTED QUIETLY.</div><div class="warning-tag">NO ONE IS SAFE<br/>AFTER DARK.</div></div></div></div>'+
    '<div class="section-head"><div><div class="eyebrow">SEASON 01 / THE STORY SO FAR</div><h2>ΕΞΙ ΕΠΕΙΣΟΔΙΑ. ΚΑΜΙΑ ΒΕΒΑΙΟΤΗΤΑ.</h2></div><span class="tiny">ΕΠΕΙΣΟΔΙΟ 1: ΠΑΙΚΤΙΚΟ · 2–6: ΥΠΟ ΑΝΑΠΤΥΞΗ</span></div>'+
    '<div class="episode-strip">'+EPISODES.map(function(t,i){return '<div class="episode-tile '+(i===0?"active":"")+'"><small>EPISODE</small><strong>0'+(i+1)+'</strong><span>'+t+'</span>'+(i>0?'<span class="lock">⌁</span>':'')+'</div>';}).join("")+'</div></div>';
}
function renderSetup(){
  document.title="THE SPIRIT APOCALYPSE — CHARACTER SELECT";
  app.innerHTML='<div class="setup"><div class="setup-head"><div><div class="eyebrow">BEFORE THE OUTBREAK / CHARACTER SELECT</div><h2>ΠΟΙΟΣ ΕΙΣΑΙ ΟΤΑΝ<br/>Ο ΚΟΣΜΟΣ ΤΕΛΕΙΩΣΕΙ;</h2><p>Επίλεξε χαρακτήρα από το αυθεντικό cast του Spirit Slasher. Οι συγγένειες και οι σχέσεις μεταφέρονται σε αυτό το εναλλακτικό σύμπαν.</p></div>'+
    '<div><div class="tiny" style="margin-bottom:8px">LOCAL PLAYERS</div><div class="player-count">'+[1,2,3].map(function(n){return '<button data-count="'+n+'" class="'+(setup.count===n?"selected":"")+'">'+n+' '+(n===1?"SOLO":"PLAYERS")+'</button>';}).join("")+'</div></div></div>'+
    '<div class="selection-status"><div class="chosen-list">'+Array.from({length:setup.count},function(_,i){return '<span class="chosen-chip '+(setup.selected[i]?"":"empty")+'">'+(setup.selected[i]||"ΠΑΙΚΤΗΣ "+(i+1))+'</span>';}).join("")+'</div><span class="tiny">'+setup.selected.length+' / '+setup.count+' ΕΠΙΛΕΓΜΕΝΟΙ</span></div>'+
    '<div class="cast-grid">'+ROSTER.map(function(c){let idx=setup.selected.indexOf(c.name),ties=links(c.name).length;return '<button class="cast-card '+(idx>=0?"chosen":"")+'" data-select="'+c.name+'" aria-pressed="'+(idx>=0)+'"><div class="cast-photo">'+image(c.name)+(idx>=0?'<span class="picked-number">P'+(idx+1)+'</span>':'')+'</div><div class="cast-info"><strong>'+c.name+'</strong><span>'+(ties?ties+" ΔΕΣΜΟΙ":"CAST")+'</span></div></button>';}).join("")+'</div>'+
    '<div class="setup-bottom"><p>Οι χαρακτήρες που δεν επιλέγεις μπορούν να γίνουν σύμμαχοι, αγνοούμενοι, εχθροί ή θύματα. Κάθε νέα αρχή φέρνει τυχαία διαφορετική ομάδα.</p><button class="btn primary" data-action="start" '+(setup.selected.length!==setup.count?"disabled":"")+'>PLAY EPISODE 01 <span class="arrow">→</span></button></div></div>';
}
function renderIntro(){
  const lead=s.players[0];
  app.innerHTML='<div class="intro-screen"><div class="intro-copy"><div class="eyebrow">SPIRIT UNIVERSE PRESENTS / SEASON 01</div>'+
    '<h1>EVERYTHING<br/><span>WAS NORMAL.</span><br/>UNTIL IT WASN’T.</h1>'+
    '<p>Η αυλαία ανοίγει σαν πραγματική σειρά: κινηματογραφικές εικόνες, προσωπικά credits του cast, πρωτότυπη σκοτεινή μουσική και ένα τελικό title reveal. Μετά ξεκινά η πρώτη σου απόφαση.</p>'+
    '<blockquote>'+(s.players.length===1?'Ξυπνάς '+genderWord(lead,'μόνος','μόνη'):'Ξυπνάτε μαζί')+'. Οι δρόμοι είναι άδειοι. Κανείς δεν σου έχει υποσχεθεί ότι θα έρθει να σε βρει.</blockquote>'+
    '<button class="btn primary" data-action="enter">▶ PLAY CINEMATIC OPENING</button><p class="tiny" style="margin-top:13px">~44 ΔΕΥΤΕΡΟΛΕΠΤΑ · ORIGINAL MUSIC · SKIP AVAILABLE</p></div>'+
    '<div class="intro-photo">'+image(lead)+'<div class="intro-photo-label"><small>THE STORY OF</small><strong>'+lead+'</strong><small>DAY 00 — 08:17 AM</small></div></div></div>';
}
function renderStory(){
  const meta=sceneMeta[s.step],sc=scene();
  const speaker=ROSTER.find(function(r){return sc.dialogue&&r.name.toUpperCase()===sc.dialogue.who;});
  const choiceMarkup=s.result?
    '<div class="result-box '+(s.result.warning?"warning":"")+'"><strong>'+s.result.heading+'</strong>'+s.result.text+'</div><div style="margin-top:17px"><button class="btn primary" data-action="next">ΣΥΝΕΧΕΙΑ <span class="arrow">→</span></button></div>':
    '<div class="choice-label">'+(s.players.length>1?"NOW PLAYING: "+s.players[s.votes.length]+" · PLAYER "+(s.votes.length+1)+" / "+s.players.length:"Η ΑΠΟΦΑΣΗ ΣΟΥ")+'</div>'+
    (s.players.length>1?'<div class="handoff"><strong>'+s.players[s.votes.length]+'</strong><span>Σειρά σου. Διάλεξε μυστικά μία επιλογή και δώσε τη συσκευή στον επόμενο παίκτη.</span></div>':'')+
    '<div class="choices">'+sc.choices.map(function(c,i){return '<button class="choice '+(s.step===6?"continue-choice":"")+'" data-choice="'+i+'"><span class="index">0'+(i+1)+'</span><span><strong>'+c.name+'</strong><small>'+c.hint+'</small></span></button>';}).join("")+'</div>';
  app.innerHTML='<div class="game"><div class="game-top"><span class="eyebrow">EPISODE 01 / '+(s.step+1)+' OF 9 SCENES</span><div class="progress-lines">'+Array.from({length:9},function(_,i){return '<span class="'+(i<s.step?"done":i===s.step?"current":"")+'"></span>';}).join("")+'</div><span class="tiny">AUTOSAVED ●</span></div>'+
    '<div class="game-head"><h1>'+meta[1].toUpperCase()+'</h1><div class="chapter">'+meta[0]+'</div></div>'+
    '<div class="game-grid"><section class="story-panel">'+(speaker?'<div class="story-portrait" aria-hidden="true">'+image(speaker.name)+'</div>':'')+'<div class="story-time">● '+meta[0]+' / LIVE STORY</div>'+
    '<h2 class="story-title">'+(s.step===8?"Η ΝΥΧΤΑ ΤΕΛΕΙΩΣΕ.":meta[1])+'</h2>'+
    '<div class="story-text">'+sc.text.map(function(p){return '<p>'+p+'</p>';}).join("")+'</div>'+
    (sc.dialogue?'<div class="story-dialogue"><strong>'+sc.dialogue.who+'</strong>“'+sc.dialogue.text+'”</div>':'')+
    '<div class="choice-area">'+choiceMarkup+'</div></section>'+sideStats()+'</div></div>';
}
function renderReport(){
  const group=inGroup(),loss=dead(),gone=missing();
  const trustNames=group.filter(function(n){return !s.players.includes(n);}).sort(function(a,b){return (s.trust[b]||50)-(s.trust[a]||50);});
  app.innerHTML='<div class="report"><div class="report-hero"><div><div class="eyebrow">SEASON 01 / EPISODE 01 COMPLETED</div>'+
    '<h1>YOU<br/><span>SURVIVED.</span></h1><p>Η πρώτη μέρα τελείωσε. Δεν σώθηκαν όλοι. Κάποιοι σε εμπιστεύονται περισσότερο, άλλοι λιγότερο. Οι επιλογές σου έχουν αποθηκευτεί σε αυτό το playthrough.</p></div>'+
    '<div class="report-badge"><div class="eyebrow">THE LIVING</div><strong>'+group.length+'</strong><span>ΕΠΙΖΩΝΤΕΣ ΣΤΗΝ ΟΜΑΔΑ</span><div class="divider"></div><span>ΝΕΚΡΟΙ '+loss.length+' · ΑΓΝΟΟΥΜΕΝΟΙ '+gone.length+'</span></div></div>'+
    '<div class="report-grid"><div class="report-card"><div class="eyebrow">THE CHOICES YOU MADE</div><h2>Η ΔΙΚΗ ΣΟΥ ΙΣΤΟΡΙΑ</h2><ul>'+
    s.decisions.map(function(d,i){return '<li><span class="bullet">0'+(i+1)+'</span><div><strong>'+d.choice+'</strong><div class="subtle">'+d.title+'</div></div></li>';}).join("")+
    '</ul></div><div class="report-card"><div class="eyebrow">TRUST & CONSEQUENCES</div><h2>ΠΟΣΟ ΣΕ ΕΜΠΙΣΤΕΥΟΝΤΑΙ</h2>'+
    (trustNames.length?trustNames.map(function(n){let v=s.trust[n]??50;return '<div class="trust-row"><span>'+n+'</span><div class="meter"><i class="'+(v<40?"low":"")+'" style="width:'+v+'%"></i></div><strong>'+v+'%</strong></div>';}).join(""):'<p>Η ομάδα είναι πολύ μικρή για να υπάρχουν μετρήσεις.</p>')+
    '<div class="divider"></div><h2>ΑΠΩΛΕΙΕΣ & ΕΞΑΦΑΝΙΣΕΙΣ</h2><div class="survivor-tags">'+
    (loss.map(function(n){return '<span class="survivor-tag dead">✕ '+n+'</span>';}).concat(gone.map(function(n){return '<span class="survivor-tag">? '+n+'</span>';})).join("")||'<span class="subtle">Κανένας επιβεβαιωμένος θάνατος.</span>')+'</div></div></div>'+
    '<div class="report-footer"><div class="locked-message">◈ <strong>Επεισόδια 2–6:</strong> επόμενο στάδιο ανάπτυξης. Το τωρινό save διατηρεί τις αποφάσεις του Επεισοδίου 1.</div>'+
    '<div class="button-row"><button class="btn" data-action="home">ΑΡΧΙΚΗ</button><button class="btn primary" data-action="new">ΝΕΟ PLAYTHROUGH ↗</button></div></div></div>';
}
function render(){
  if(s&&s.version===2){if(typeof campaignRender==='function')return campaignRender();return;}
  document.title="THE SPIRIT APOCALYPSE — "+(s&&s.phase==="story"?"EP 01":s&&s.phase==="report"?"EPISODE COMPLETE":"SEASON 01");
  if(!s||s.phase==="home")renderHome();
  else if(s.phase==="setup")renderSetup();
  else if(s.phase==="intro")renderIntro();
  else if(s.phase==="story")renderStory();
  else if(s.phase==="report")renderReport();
  else renderHome();
}
function openingShots(){
  const players=s.players;
  const cast=players.concat(inGroup().filter(function(n){return !players.includes(n);}));
  return [
    {type:"presents",ms:3500},
    {type:"landscape",ms:3500,image:CINEMA_CITY,super:"08:17 AM / THE FIRST DAY",line:"THE WORLD ENDED QUIETLY."},
    {type:"landscape",ms:3000,image:CINEMA_ROAD,super:"ALL FREQUENCIES LOST",line:"NO ONE WAS READY."}
  ].concat(cast.map(function(n,i){
    const p=players.indexOf(n);
    return {type:"cast",ms:3200,name:n,castIndex:i,credit:p>=0?"STARRING  ·  PLAYER "+(p+1):"ALSO STARRING",relation:"EVERY CHOICE CHANGES THE STORY"};
  })).concat([
    {type:"landscape",ms:3800,image:CINEMA_CITY,super:"NO SIGNAL. NO RESCUE.",line:"YOU ARE ON YOUR OWN."},
    {type:"logo",ms:6500},
    {type:"episode",ms:4000}
  ]);
}
function openingMark(){
  return '<div class="cinema-hud"><div><span class="red-dot">●</span> S01 // EP01 <span class="cinema-live">DAY ZERO</span></div>'+
    '<div class="cinema-buttons"><button class="cinema-icon-btn" data-cinema="sound" aria-label="Εναλλαγή ήχου">'+(soundtrackEnabled?"♫ SOUND ON":"♫ SOUND OFF")+'</button>'+
    '<button class="cinema-icon-btn" data-cinema="skip">SKIP INTRO ↗</button></div></div>'+
    '<div class="cinema-viewport" id="cinema-viewport"></div><div class="cinema-bottomline"><span>THE SPIRIT APOCALYPSE / OPENING CREDITS</span><span>ORIGINAL SCORE</span></div>'+
    '<div class="cinema-progress"><i id="cinema-progress-fill"></i></div>';
}
function renderOpeningShot(shot){
  const p=document.querySelector("#cinema-viewport");
  if(!p)return;
  if(shot.type==="presents"){
    p.innerHTML='<div class="intro-shot cinema-presents"><div class="cinema-breath"></div>'+
      '<div class="cinema-presents-copy"><div class="cinema-line"></div><p>SPIRIT UNIVERSE</p><strong>PRESENTS</strong><small>AN ORIGINAL INTERACTIVE SERIES</small></div></div>';
  } else if(shot.type==="landscape"){
    p.innerHTML='<div class="intro-shot cinema-landscape"><img class="cinema-world-image" src="'+shot.image+'" alt="" />'+
      '<div class="cinema-dark-wash"></div><div class="cinema-landscape-copy"><span>'+shot.super+'</span><h2>'+shot.line+'</h2></div></div>';
  } else if(shot.type==="cast"){
    const side=shot.castIndex%2===0?"photo-right":"photo-left";
    p.innerHTML='<div class="intro-shot cinema-cast '+side+'"><div class="cinema-cast-world" style="background-image:url('+CINEMA_ROAD+')"></div>'+
      '<div class="cinema-portrait">'+image(shot.name)+'</div><div class="cinema-cast-copy"><span class="cinema-credit">'+shot.credit+'</span>'+
      '<h2>'+shot.name+'</h2><div class="cinema-rule"></div><p>'+shot.relation+'</p></div></div>';
  } else if(shot.type==="logo"){
    p.innerHTML='<div class="intro-shot cinema-title-reveal"><div class="cinema-abyss"></div>'+
      '<img class="cinema-logo-image" src="'+TITLE_LOGO+'" alt="THE SPIRIT APOCALYPSE" /><div class="cinema-red-horizon"></div>'+
      '<p>EVERY CHOICE LEAVES A SCAR.</p></div>';
  } else {
    p.innerHTML='<div class="intro-shot cinema-episode-card"><div class="cinema-episode-bg"></div><span>SEASON ONE</span>'+
      '<strong>EPISODE 01</strong><h2>DAY ZERO</h2><p>Η ΠΡΩΤΗ ΜΕΡΑ</p><div class="cinema-start-signal">YOUR STORY BEGINS NOW ···</div></div>';
  }
}
function stopOpening(continueStory){
  if(!opening)return;
  clearTimeout(opening.timer);clearInterval(opening.ticker);
  if(opening.audio){opening.audio.pause();opening.audio.currentTime=0;}
  const node=document.querySelector("#cinema-overlay");
  if(node)node.remove();
  opening=null;
  document.body.classList.remove("cinema-lock");
  if(continueStory&&s){s.phase="story";save();render();goTop();}
}
function advanceOpening(){
  if(!opening)return;
  const shot=opening.shots[opening.index++];
  if(!shot){stopOpening(true);return;}
  renderOpeningShot(shot);
  opening.timer=setTimeout(advanceOpening,shot.ms);
}
function playOpening(){
  stopOpening(false);
  const shots=openingShots();
  const overlay=document.createElement("section");
  overlay.id="cinema-overlay";
  overlay.className="cinema-overlay";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-label","Κινηματογραφική εισαγωγή The Spirit Apocalypse");
  overlay.innerHTML=openingMark();
  document.body.append(overlay);
  document.body.classList.add("cinema-lock");
  const music=new Audio(ORIGINAL_SCORE);
  music.preload="auto";music.volume=soundtrackEnabled?.85:0;
  opening={shots:shots,index:0,timer:null,ticker:null,audio:music,started:performance.now(),total:shots.reduce(function(a,b){return a+b.ms;},0)};
  music.play().catch(function(){});
  overlay.addEventListener("click",function(e){
    const b=e.target.closest("[data-cinema]");
    if(!b)return;
    if(b.dataset.cinema==="skip"){stopOpening(true);return;}
    if(b.dataset.cinema==="sound"){
      soundtrackEnabled=!soundtrackEnabled;
      safeSet("spirit-apocalypse-sound",soundtrackEnabled?"on":"off");
      if(opening&&opening.audio){opening.audio.muted=!soundtrackEnabled;}
      b.textContent=soundtrackEnabled?"♫ SOUND ON":"♫ SOUND OFF";
    }
  });
  opening.ticker=setInterval(function(){
    if(!opening)return;
    const pct=Math.min(100,(performance.now()-opening.started)/opening.total*100);
    const bar=document.querySelector("#cinema-progress-fill");
    if(bar)bar.style.width=pct+"%";
  },80);
  advanceOpening();
}
window.addEventListener("keydown",function(e){if(e.key==="Escape"&&opening)stopOpening(true);});
document.querySelector("#brand-home").addEventListener("click",function(){if(s){save();}renderHome();goTop();});
app.addEventListener("click",function(event){
  const btn=event.target.closest("button");
  if(!btn)return;
  const action=btn.dataset.action;
  if(btn.dataset.count){setup.count=Number(btn.dataset.count);setup.selected=setup.selected.slice(0,setup.count);renderSetup();return;}
  if(btn.dataset.select){let name=btn.dataset.select,idx=setup.selected.indexOf(name);if(idx>=0)setup.selected.splice(idx,1);else if(setup.selected.length<setup.count)setup.selected.push(name);else{announce("Έχεις ήδη επιλέξει "+setup.count+" χαρακτήρες.");return;}renderSetup();return;}
  if(btn.dataset.choice!==undefined){choose(Number(btn.dataset.choice));return;}
  if(action==="new"){setup={count:1,selected:[]};renderSetup();goTop();return;}
  if(action==="start"){newRun();return;}
  if(action==="enter"){playOpening();return;}
  if(action==="next"){nextScene();return;}
  if(action==="continue"){if(s){render();goTop();}return;}
  if(action==="home"){renderHome();goTop();}
});
render();
