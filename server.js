const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=process.env.PORT||3000,rooms=new Map();
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p==='/')p='/index.html';const file=path.join(__dirname,'public',path.normalize(p).replace(/^(\.\.[/\\])+/,''));if(!file.startsWith(path.join(__dirname,'public')+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'text/plain');res.end(data)})});
const wss=new WebSocketServer({server});
function send(ws,obj){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))}
function broadcast(r,obj){r.players.forEach(p=>send(p.ws,obj))}
function state(r){return {type:'state',phase:r.phase,round:r.round,players:r.players.map(p=>({role:p.role,x:p.x,y:p.y})),winner:r.winner}}
function reset(r){r.phase='playing';r.winner=null;r.players.forEach(p=>{p.x=p.role==='farmer'?18:80;p.y=p.role==='farmer'?55:45;p.last=Date.now()});broadcast(r,state(r))}
function closeRoom(ws){let r=ws.room;if(!r)return;r.players=r.players.filter(p=>p.ws!==ws);broadcast(r,{type:'notice',message:'상대방 연결이 끊겼습니다.'});r.phase='waiting';r.winner=null;if(!r.players.length)rooms.delete(r.code);else broadcast(r,state(r));ws.room=null}
wss.on('connection',ws=>{ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(m.type==='join'){closeRoom(ws);let code=String(m.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);if(!code){send(ws,{type:'error',message:'방 코드를 입력하세요.'});return}let r=rooms.get(code);if(!r){r={code,players:[],phase:'waiting',round:1,winner:null};rooms.set(code,r)}if(r.players.length>=2){send(ws,{type:'error',message:'방이 가득 찼습니다.'});return}let p={ws,role:r.players.length?'chicken':'farmer',x:r.players.length?80:18,y:r.players.length?45:55,last:Date.now()};r.players.push(p);ws.room=r;send(ws,{type:'joined',code,role:p.role});if(r.players.length===2)reset(r);else broadcast(r,state(r));return}
const r=ws.room;if(!r)return;const p=r.players.find(p=>p.ws===ws);if(!p)return;
if(m.type==='move'&&r.phase==='playing'){let now=Date.now(),dt=Math.min(.12,Math.max(0,(now-p.last)/1000));p.last=now;let dx=Math.max(-1,Math.min(1,Number(m.dx)||0)),dy=Math.max(-1,Math.min(1,Number(m.dy)||0)),mag=Math.hypot(dx,dy);if(mag>1){dx/=mag;dy/=mag}let speed=p.role==='chicken'?28:31;p.x=Math.max(5,Math.min(95,p.x+dx*speed*dt));p.y=Math.max(8,Math.min(92,p.y+dy*speed*dt));broadcast(r,state(r))}
if(m.type==='catch'&&r.phase==='playing'&&p.role==='farmer'){let q=r.players.find(x=>x.role==='chicken');if(q&&Math.hypot(p.x-q.x,p.y-q.y)<19){r.phase='finished';r.winner='farmer';broadcast(r,{type:'caught'});broadcast(r,state(r))}else send(ws,{type:'notice',message:'닭에게 더 가까이 접근하세요!'});}
if(m.type==='next'&&r.phase==='finished'&&r.players.length===2){r.players.forEach(p=>p.role=p.role==='farmer'?'chicken':'farmer');r.round++;r.players.forEach(p=>send(p.ws,{type:'role',role:p.role}));reset(r)}
});ws.on('close',()=>closeRoom(ws));ws.on('error',()=>{})});
server.listen(PORT,()=>console.log('Chicken Duel on '+PORT));
