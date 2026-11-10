/* Cache estático para instalar o Polo Finance e abrir offline no iPhone.
 * Troque a versão quando publicar arquivos atualizados.
 */
const CACHE = 'polo-finance-v1-4-1';
const FILES = [
  './','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './planejamento.html','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('polo-finance-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>res).catch(()=>caches.match(req).then(cached=>cached||caches.match('./index.html'))));
  }else{
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
  }
});
