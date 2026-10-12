/* Mk Crypt Industrie — Service Worker (notifications quotidiennes) */
const CACHE = 'mk-crypt-v1';
const NOTIF_TAG = 'mk-daily-tip';

const DAILY_TIPS = [
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 01 : Inscription dans la formation gratuite 🎓' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 02 : Ino avy ny zavatra hilaigna rah anomboka @Crypto' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 03 : Dépôt — apprenez à déposer sur Stake' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 04 : Retrait Orange Money, Mvola, Airtel Money @Stake' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 05 : Otrino Vola Jiaby hilaigna rah anomboko' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 07 : Conseil Bonus rah anao crypto' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 09 : Fomba fakana Ilay Bonus 16 mille Ariary @Mk crypt industrie' },
  { title: 'Mk Crypt · Formation gratuite', body: 'Suivez la Leçon 10 : Ahona atao miditra @Formation Avancer' },
  { title: 'Mk Crypt · Série', body: 'Suivez la série Mk Crypt — Saison 01 Épisode 01 : Secret fazahona vola @Cryptomonaie 🎬' },
  { title: 'Mk Crypt · Série', body: 'Suivez la série Mk Crypt — Saison 01 Épisode 02 : Stratégie & discipline @Crypto' },
  { title: 'Mk Crypt · Formation complète', body: 'Suivez la Leçon 03 : Ny asa atao — formation 39 990 Ar' },
  { title: 'Mk Crypt · Formation complète', body: 'Suivez la Leçon 15 : Explication Règle de ×7 Capital' },
  { title: 'Mk Crypt · Formation complète', body: 'Suivez la Leçon 19 : Exercice Pratique' },
  { title: 'Mk Crypt Industrie', body: 'Rappel : ouvrez Mk Exchange Crypto pour dépôt / retrait en MGA 💱' },
  { title: 'Mk Crypt Industrie', body: 'Astuce du jour : consultez les Avis des utilisateurs pour voir les résultats des membres ⭐' },
  { title: 'Mk Crypt · Parrainage', body: 'Invitez un ami via Parrainage et réclamez votre bonus d\'invitation 🎁' }
];

function dayIndex() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  const day = Math.floor(diff / 86400000);
  return day % DAILY_TIPS.length;
}

function tipForToday() {
  return DAILY_TIPS[dayIndex()];
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SHOW_DAILY') {
    event.waitUntil(showDailyNotification(data.force === true));
  }
  if (data.type === 'SHOW_TIP' && data.tip) {
    event.waitUntil(
      self.registration.showNotification(data.tip.title || 'Mk Crypt Industrie', {
        body: data.tip.body || '',
        tag: NOTIF_TAG,
        renotify: true,
        icon: data.icon || undefined,
        badge: data.badge || undefined,
        data: { url: data.url || './' },
        vibrate: [120, 60, 120]
      })
    );
  }
});

async function showDailyNotification(force) {
  try {
    const key = 'mk_last_daily_notif';
    // SW cannot use localStorage — use Cache or skip date check when forced from page
    const tip = tipForToday();
    await self.registration.showNotification(tip.title, {
      body: tip.body,
      tag: NOTIF_TAG,
      renotify: true,
      data: { url: './' },
      vibrate: [120, 60, 120],
      requireInteraction: false
    });
  } catch (e) {
    console.warn('SW notif', e);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

/* Periodic Background Sync (Android Chrome, si supporté) */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mk-daily-tips') {
    event.waitUntil(showDailyNotification(true));
  }
});
