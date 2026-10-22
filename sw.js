/* Mk Crypt + OneSignal Service Worker */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

/* Mk Crypt Industrie — Service Worker
 * Notifications autonomes (toutes les ~2h) même si l'onglet est fermé.
 * Limite navigateur : après très longue inactivité, un service Push
 * (OneSignal / FCM) est nécessaire — voir mkNotifEnablePush dans le HTML.
 */
const SW_VERSION = 'mk-sw-v3';
const DB_NAME = 'mk-crypt-notif';
const DB_STORE = 'config';

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim().then(function(){
    return scheduleAlarmCheck();
  }));
});

function openDB(){
  return new Promise(function(resolve, reject){
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function(){
      var db = req.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = function(){ resolve(req.result); };
    req.onerror = function(){ reject(req.error); };
  });
}

function idbGet(key){
  return openDB().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DB_STORE, 'readonly');
      var req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  });
}

function idbSet(key, val){
  return openDB().then(function(db){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(val, key);
      tx.oncomplete = function(){ resolve(); };
      tx.onerror = function(){ reject(tx.error); };
    });
  });
}

function dayKey(){
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function defaultTips(){
  return [
    { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 01 : Inscription dans la formation gratuite 🎓', page: 'formation-gratuit' },
    { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 03 : Dépôt sur Stake', page: 'formation-gratuit' },
    { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 04 : Retrait mobile money @Stake', page: 'formation-gratuit' },
    { title: 'Mk Crypt · Série', body: 'Suivez Mk Crypt Saison 01 Épisode 01 : Secret azahona vola @Cryptomonaie', page: 'serie', action: 's1e1' },
    { title: 'Mk Crypt · Parrainage', body: 'Partagez l\'app et réclamez votre bonus de parrainage 💰', page: 'parrainage' },
    { title: 'Mk Crypt · Formation', body: 'Continuez la formation 39 990 Ar — Leçon 18 Jazz Ultra', page: 'formation-debutant' },
    { title: 'Mk Crypt · Accompagnement', body: 'Réservez un créneau d\'accompagnement personnalisé', page: 'accompagnement' },
    { title: 'Mk Crypt · Rappel', body: 'Ouvrez Mk Crypt Industrie et progressez aujourd\'hui 🚀', page: 'home' }
  ];
}

function hoursList(){
  return [7, 9, 11, 13, 15, 17, 19, 21];
}

function pickTip(slot, tips){
  tips = tips && tips.length ? tips : defaultTips();
  var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return tips[(day * 8 + slot) % tips.length];
}

function showTipNotification(tip, tag){
  tip = tip || {};
  return self.registration.showNotification(tip.title || 'Mk Crypt Industrie', {
    body: tip.body || 'Ouvrez l\'application pour continuer votre formation',
    tag: tag || ('mk-' + Date.now()),
    renotify: true,
    requireInteraction: false,
    silent: false,
    icon: tip.icon || undefined,
    badge: tip.badge || undefined,
    data: {
      page: tip.page || 'home',
      action: tip.action || '',
      url: './'
    },
    vibrate: [120, 60, 120]
  });
}

/* Vérifie l'heure et envoie la notif du créneau si due */
function flushDueNotifications(){
  return idbGet('cfg').then(function(cfg){
    cfg = cfg || {};
    var tips = cfg.tips || defaultTips();
    var hours = cfg.hours || hoursList();
    var icon = cfg.icon || undefined;
    var sent = cfg.sent || {};
    var dk = dayKey();
    if(!sent[dk]) sent[dk] = [];
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var tasks = [];

    hours.forEach(function(hour, slot){
      if(sent[dk].indexOf(slot) !== -1) return;
      /* fenêtre : à partir de l'heure du créneau, pendant 2h */
      var due = (h > hour) || (h === hour && m >= 0);
      var stillInWindow = (h < hour + 2) || (h === hour + 1);
      if(due && stillInWindow){
        var tip = pickTip(slot, tips);
        if(icon){ tip.icon = icon; tip.badge = icon; }
        var tag = 'mk-daily-' + dk + '-' + slot;
        tasks.push(
          showTipNotification(tip, tag).then(function(){
            sent[dk].push(slot);
          }).catch(function(){})
        );
      }
    });

    /* nettoyage vieux jours */
    Object.keys(sent).forEach(function(k){
      if(k !== dk) delete sent[k];
    });
    cfg.sent = sent;
    cfg.lastCheck = Date.now();

    return Promise.all(tasks).then(function(){
      return idbSet('cfg', cfg);
    });
  }).catch(function(err){
    console.warn('flushDue', err);
  });
}

function scheduleAlarmCheck(){
  /* Tente Periodic Background Sync (Chrome Android, PWA installée) */
  return self.registration.periodicSync
    ? self.registration.periodicSync.register('mk-daily-tips', { minInterval: 2 * 60 * 60 * 1000 }).catch(function(){})
    : Promise.resolve();
}

self.addEventListener('periodicsync', function(event){
  if(event.tag === 'mk-daily-tips' || event.tag === 'mk-notif-check'){
    event.waitUntil(flushDueNotifications());
  }
});

self.addEventListener('sync', function(event){
  if(event.tag === 'mk-notif-check'){
    event.waitUntil(flushDueNotifications());
  }
});

/* Push distant (OneSignal / FCM / Web Push serveur) */
self.addEventListener('push', function(event){
  var tip = null;
  try{
    if(event.data){
      var raw = event.data.json ? event.data.json() : null;
      if(raw && typeof raw.then === 'function'){
        event.waitUntil(raw.then(function(data){
          tip = data.tip || data;
          return showTipNotification(tip, data.tag);
        }));
        return;
      }
      tip = event.data.json();
    }
  }catch(e){
    try{ tip = { title: 'Mk Crypt Industrie', body: event.data.text() }; }catch(x){}
  }
  tip = tip || { title: 'Mk Crypt Industrie', body: 'Nouveau rappel de formation disponible' };
  if(tip.tip) tip = tip.tip;
  event.waitUntil(showTipNotification(tip, tip.tag));
});

self.addEventListener('message', function(event){
  var data = event.data || {};
  if(data.type === 'INIT_NOTIF'){
    event.waitUntil(
      idbGet('cfg').then(function(cfg){
        cfg = cfg || {};
        if(data.tips) cfg.tips = data.tips;
        if(data.hours) cfg.hours = data.hours;
        if(data.icon) cfg.icon = data.icon;
        cfg.enabled = true;
        return idbSet('cfg', cfg);
      }).then(function(){
        return flushDueNotifications();
      }).then(function(){
        return scheduleAlarmCheck();
      })
    );
  }
  if(data.type === 'SHOW_TIP' && data.tip){
    event.waitUntil(showTipNotification(data.tip, data.tag));
  }
  if(data.type === 'FLUSH'){
    event.waitUntil(flushDueNotifications());
  }
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var data = event.notification.data || {};
  var page = data.page || 'home';
  var action = data.action || '';
  var url = data.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        var client = list[i];
        if('focus' in client){
          return client.focus().then(function(c){
            try{ c.postMessage({ type: 'NOTIF_CLICK', page: page, action: action }); }catch(e){}
            return c;
          });
        }
      }
      if(self.clients.openWindow){
        var target = url.split('#')[0] + '#mk=' + encodeURIComponent(page + (action ? ':' + action : ''));
        return self.clients.openWindow(target);
      }
    })
  );
});

/* Au démarrage du SW : vérifier les créneaux */
flushDueNotifications();
