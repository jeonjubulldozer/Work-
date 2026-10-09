/* 새 내용을 먼저 받아 오고, 인터넷이 안 될 때만 마지막으로 받은 것을 보여 줍니다. */
var C="hyeonhwang-v1";
self.addEventListener("install",function(e){ self.skipWaiting(); });
self.addEventListener("activate",function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch",function(e){
  var r=e.request; if(r.method!=="GET"||new URL(r.url).origin!==location.origin) return;
  e.respondWith(fetch(r).then(function(res){ if(res.ok){ var c=res.clone(); caches.open(C).then(function(k){ k.put(r,c); }); } return res; })
    .catch(function(){ return caches.match(r,{ignoreSearch:true}).then(function(m){ return m||Response.error(); }); }));
});
