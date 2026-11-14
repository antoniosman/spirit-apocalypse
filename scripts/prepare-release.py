from pathlib import Path
import json,hashlib,sys,shutil
root=Path(__file__).resolve().parent.parent
files=['./','./index.html','./styles.css','./campaign.css','./campaign.js','./campaign-validation.js','./campaign-ui.js','./character-data.js','./save-validation.js','./scenarios.js','./episodes.js','./app.js','./season.js','./pwa.js','./release.js','./version.json','./manifest.webmanifest']
files += ['./'+p.relative_to(root).as_posix() for folder in ['assets','icons'] for p in sorted((root/folder).rglob('*')) if p.is_file() and p.name!='app-source.png']
digest=hashlib.sha256()
digest.update(Path(__file__).read_bytes())
for file in files:
    if file not in ['./','./release.js','./version.json']:digest.update((root/file.removeprefix('./')).read_bytes())
release={'version':'1.1.2','build':digest.hexdigest()[:12],'name':'The Spirit Apocalypse'}
(root/'version.json').write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
(root/'release.js').write_text('const APP_RELEASE = '+json.dumps(release)+';\n',encoding='utf-8')
prefix='spirit-apocalypse-'+hashlib.sha256(b'/spirit-apocalypse/').hexdigest()[:10]+'-'
sw='''/* Generated from every runtime asset; scoped independently of other Spirit games. */
const CACHE_PREFIX = %s;
const CACHE_VERSION = CACHE_PREFIX + %s;
const BASE = self.registration.scope;
const CORE_FILES = %s;
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
  const match=/^bytes=(\\d*)-(\\d*)$/.exec(range);
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
'''%(json.dumps(prefix),json.dumps(digest.hexdigest()[:12]),json.dumps(files,indent=2))
(root/'sw.js').write_text(sw,encoding='utf-8')
if '--dist' in sys.argv:
    output=root/'dist'
    output.mkdir(exist_ok=True)
    for file in files:
        if file=='./':continue
        relative=file.removeprefix('./')
        target=output/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(root/relative,target)
    shutil.copy2(root/'sw.js',output/'sw.js')
    (output/'.nojekyll').touch()
print(f'Prepared {len(files)} offline URLs; build {release["build"]}')
