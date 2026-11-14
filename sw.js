/* Generated from every runtime asset; scoped independently of other Spirit games. */
const CACHE_PREFIX = "spirit-apocalypse-ed539f8495-";
const CACHE_VERSION = CACHE_PREFIX + "c3b767cb8c96";
const BASE = self.registration.scope;
const CORE_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./save-validation.js",
  "./scenarios.js",
  "./episodes.js",
  "./app.js",
  "./season.js",
  "./pwa.js",
  "./release.js",
  "./version.json",
  "./manifest.webmanifest",
  "./assets/audio/spirit-apocalypse-death-sting.mp3",
  "./assets/audio/spirit-apocalypse-original-theme.mp3",
  "./assets/audio/spirit-apocalypse-survival-ambient.mp3",
  "./assets/characters/char_alex.webp",
  "./assets/characters/char_billy.webp",
  "./assets/characters/char_catherine.png",
  "./assets/characters/char_demarin.webp",
  "./assets/characters/char_elisa.webp",
  "./assets/characters/char_ester.png",
  "./assets/characters/char_eva.png",
  "./assets/characters/char_evaggelia.png",
  "./assets/characters/char_evelyn.webp",
  "./assets/characters/char_hope.webp",
  "./assets/characters/char_ian.png",
  "./assets/characters/char_irene.png",
  "./assets/characters/char_jasmine.png",
  "./assets/characters/char_luna.webp",
  "./assets/characters/char_paul.png",
  "./assets/characters/char_pauline.webp",
  "./assets/characters/char_phillip.webp",
  "./assets/characters/char_rino.webp",
  "./assets/characters/char_sargenie-hq.png",
  "./assets/characters/char_smaragda-hq.png",
  "./assets/characters/char_sorina.png",
  "./assets/characters/char_tony.webp",
  "./assets/characters/char_vicky.jpg",
  "./assets/characters/char_vincent.jpg",
  "./assets/characters/char_violet.png",
  "./assets/characters/char_zoe-hq.png",
  "./assets/cinematic/city-dawn.webp",
  "./assets/cinematic/forest-road.webp",
  "./assets/cinematic/spirit-apocalypse-logo.png",
  "./icons/app-192.png",
  "./icons/app-512.png",
  "./icons/app-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(CORE_FILES.map(path => new Request(new URL(path, BASE).href,{cache:'reload'})))));
});
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function cachedResponse(request, cached){
  const range=request.headers.get('range');
  if(!range)return cached;
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!match)return cached;
  const buffer=await cached.arrayBuffer(),length=buffer.byteLength;
  let start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
  let end=match[1]&&match[2]?Number(match[2]):length-1;
  end=Math.min(end,length-1);
  if(start>end||start>=length)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+length}});
  const headers=new Headers(cached.headers);
  headers.set('Content-Range','bytes '+start+'-'+end+'/'+length);
  headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
  return new Response(buffer.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET'||!event.request.url.startsWith(BASE))return;
  if(new URL(event.request.url).pathname===new URL('./version.json',BASE).pathname)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_VERSION);
    const url=new URL(event.request.url);
    // Tracking/share query strings must not break an offline launch.
    if(event.request.mode==='navigate'&&(url.pathname===new URL(BASE).pathname||url.pathname===new URL('./index.html',BASE).pathname))return cache.match(new URL('./index.html',BASE).href);
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cachedResponse(event.request,cached);
    try{return await fetch(event.request);}catch(e){
      if(event.request.mode==='navigate')return cache.match(new URL('./index.html',BASE).href);
      return Response.error();
    }
  })());
});
