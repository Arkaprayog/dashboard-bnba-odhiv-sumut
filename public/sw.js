self.addEventListener('push',event=>{
 let data={title:'Sahabat ODHIV Sumut',body:'Ada aktivitas penting di dashboard.',tag:'dashboard-activity',url:'/'};
 try{if(event.data){const incoming=event.data.json();data={...data,...incoming};}}catch{}
 const options={body:String(data.body||'Ada aktivitas penting di dashboard.'),tag:String(data.tag||'dashboard-activity'),data:{url:String(data.url||'/')},vibrate:[180,80,180],renotify:true};
 event.waitUntil(self.registration.showNotification(String(data.title||'Sahabat ODHIV Sumut'),options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  for(const client of clients){if(client.url===target&&'focus' in client)return client.focus();}
  return self.clients.openWindow(target);
 }));
});
