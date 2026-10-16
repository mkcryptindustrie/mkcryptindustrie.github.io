/* Mk Crypt Industrie — Service Worker (notifs toutes les 2h + deep-link) */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(event){
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event){
  var data = event.data || {};
  if(data.type === 'SHOW_TIP' && data.tip){
    event.waitUntil(
      self.registration.showNotification(data.tip.title || 'Mk Crypt Industrie', {
        body: data.tip.body || '',
        tag: data.tag || ('mk-daily-' + Date.now()),
        renotify: true,
        icon: data.icon || undefined,
        badge: data.badge || undefined,
        data: {
          page: data.tip.page || 'home',
          action: data.tip.action || '',
          url: data.url || './'
        },
        vibrate: [100, 50, 100]
      })
    );
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
            c.postMessage({ type: 'NOTIF_CLICK', page: page, action: action });
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

self.addEventListener('periodicsync', function(event){
  if(event.tag === 'mk-daily-tips'){
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(function(list){
        list.forEach(function(c){ c.postMessage({ type: 'NOTIF_SYNC' }); });
      })
    );
  }
});
