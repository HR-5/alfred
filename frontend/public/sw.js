/* Alfred Service Worker — handles push notifications */

self.addEventListener('push', function (event) {
  if (!event.data) return
  let payload = { title: 'Alfred', body: 'You have a reminder' }
  try {
    payload = event.data.json()
  } catch {
    payload.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'alfred-reminder',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/app') && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow('/app')
    })
  )
})
