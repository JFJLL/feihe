const base = process.argv[2] || process.env.VERIFY_BASE || 'http://localhost:5017';
const dashboard = await fetch(base + '/api/dashboard?projectId=qicui&fresh=1').then(r=>r.json());
console.log('trend', dashboard.analytics?.trend);
const notes = dashboard.analytics?.topNotes || [];
console.log('top notes', notes.slice(0,3).map(n=>({id:n.id,title:n.title,coverUrl:n.coverUrl})));
for (const note of notes.slice(0,2)) {
  const response = await fetch(base + note.coverUrl + '&format=json');
  const body = await response.text();
  console.log('resolve',note.id,response.status,body.slice(0,450));
  if(response.ok) {
    const image = await fetch(JSON.parse(body).coverUrl);
    console.log('image',image.status,image.headers.get('content-type'),(await image.arrayBuffer()).byteLength);
  }
}
