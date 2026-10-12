self.addEventListener('push',event=>{
 let data={title:'Sahabat ODHIV Sumut',body:'Ada aktivitas penting di dashboard.',tag:'dashboard-activity',url:'/'};
 try{if(event.data){const incoming=event.data.json();data={...data,...incoming};}}catch{}
 const options={body:String(data.body||'Ada aktivitas penting di dashboard.'),tag:String(data.tag||'dashboard-activity'),data:{url:String(data.url||'/')},vibrate:[250,120,250,120,350],renotify:true,requireInteraction:true,icon:'/icon-192.png',badge:'/badge-72.png'};
 event.waitUntil((async()=>{
  await self.registration.showNotification(String(data.title||'Sahabat ODHIV Sumut'),options);
  try{if(self.registration.navigationPreload){} if(self.navigator&&self.navigator.setAppBadge)await self.navigator.setAppBadge(1);}catch{}
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 try{if(self.navigator&&self.navigator.clearAppBadge)self.navigator.clearAppBadge();}catch{}
 const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  for(const client of clients){if(client.url===target&&'focus' in client)return client.focus();}
  return self.clients.openWindow(target);
 }));
});
