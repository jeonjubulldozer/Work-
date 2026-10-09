/* 현황판 잠금 풀기: 이 기기 안에만 있는 열쇠로 data.enc.json을 풉니다. 열쇠(개인키)는 기기 밖으로 나가지 않습니다. */
(function(){
  var DB="hyeonhwang-vault", STORE="k";
  function idb(){ return new Promise(function(res,rej){ var r=indexedDB.open(DB,1); r.onupgradeneeded=function(){ r.result.createObjectStore(STORE); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }); }
  function get(k){ return idb().then(function(d){ return new Promise(function(res,rej){ var q=d.transaction(STORE).objectStore(STORE).get(k); q.onsuccess=function(){ res(q.result); }; q.onerror=function(){ rej(q.error); }; }); }); }
  function put(k,v){ return idb().then(function(d){ return new Promise(function(res,rej){ var t=d.transaction(STORE,"readwrite"); t.objectStore(STORE).put(v,k); t.oncomplete=function(){ res(); }; t.onerror=function(){ rej(t.error); }; }); }); }
  function b64(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); var b=atob(s), u=new Uint8Array(b.length); for(var i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
  function hex(buf){ return Array.prototype.map.call(new Uint8Array(buf),function(x){ return ("0"+x.toString(16)).slice(-2); }).join(""); }
  function kidOf(n){ return crypto.subtle.digest("SHA-256", new TextEncoder().encode(n)).then(function(h){ return hex(h).slice(0,16); }); }
  var pending=null;
  function ensureKey(){
    if(!(window.crypto&&crypto.subtle&&window.indexedDB)) return Promise.reject(new Error("unsupported"));
    if(pending) return pending;
    pending=get("pair").then(function(rec){
      if(rec) return rec;
      return crypto.subtle.generateKey({name:"RSA-OAEP",modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"}, false, ["encrypt","decrypt"])
        .then(function(kp){ return crypto.subtle.exportKey("jwk",kp.publicKey).then(function(jwk){ return kidOf(jwk.n).then(function(kid){
          var rec={priv:kp.privateKey, n:jwk.n, kid:kid, made:Date.now()};
          return put("pair",rec).then(function(){ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); return rec; }); }); }); });
    });
    return pending;
  }
  function open(url){
    return ensureKey().then(function(rec){
      return fetch0(url,{cache:"no-store"}).then(function(r){ if(!r.ok){ var e=new Error("nodata"); e.code="nodata"; throw e; } return r.json(); }).then(function(j){
        var mine=(j.keys||[]).filter(function(k){ return k.kid===rec.kid; })[0];
        if(!mine){ var e=new Error("notpaired"); e.code="notpaired"; throw e; }
        return crypto.subtle.decrypt({name:"RSA-OAEP"}, rec.priv, b64(mine.wk))
          .then(function(raw){ return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["decrypt"]); })
          .then(function(key){ return crypto.subtle.decrypt({name:"AES-GCM",iv:b64(j.iv)}, key, b64(j.ct)); })
          .then(function(pt){ return new TextDecoder().decode(pt); });
      });
    });
  }
  var fetch0=window.fetch.bind(window);
  var me=document.currentScript, home=me&&me.getAttribute("data-home");
  window.Vault={ ensureKey:ensureKey, open:open, code:function(){ return ensureKey().then(function(r){ return "hk1:"+r.n; }); } };
  if(home){
    /* 현황판 화면: data.json 요청을 잠긴 파일을 푼 결과로 바꿔 줍니다. */
    window.fetch=function(input,init){
      var u=typeof input==="string"?input:((input&&input.url)||"");
      if(/(^|\/)data\.json(\?|$)/.test(u)){
        return open(u.replace(/data\.json.*/,"data.enc.json")).then(function(t){ return new Response(t,{status:200,headers:{"Content-Type":"application/json"}}); })
          .catch(function(e){ if(e&&(e.code==="notpaired"||e.code==="nodata")) location.replace(home); throw e; });
      }
      return fetch0(input,init);
    };
    document.addEventListener("DOMContentLoaded",function(){
      var a=document.createElement("a"); a.href=home; a.textContent="← 처음으로";
      a.style.cssText="display:block;max-width:1080px;margin:0 auto;padding:14px 20px 0;font:500 14px/1.4 'IBM Plex Sans KR',sans-serif;color:inherit;opacity:.7;text-decoration:none";
      document.body.insertBefore(a,document.body.firstChild);
    });
  }
  if("serviceWorker" in navigator){ navigator.serviceWorker.register((home||"./")+"sw.js").catch(function(){}); }
})();
