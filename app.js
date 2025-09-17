import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  query, orderBy, onSnapshot, runTransaction, serverTimestamp, getDocs
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

// -------------------- Firebase bootstrap --------------------
const firebaseConfig = {
  apiKey: 'AIzaSyADGfYlLyMB-W5A2JM6uF8VqTiF3LL9lEI',
  authDomain: 'secertmisson-19e11.firebaseapp.com',
  projectId: 'secertmisson-19e11',
  storageBucket: 'secertmisson-19e11.firebasestorage.app',
  messagingSenderId: '730645471093',
  appId: '1:730645471093:web:dacceb7a79256deb06fd3c'
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// -------------------- Constants --------------------
const wordPool = [
  'adventure','analysis','balance','beacon','bridge','canvas','celebration','challenge','clarity','compass','confidence','connection','courage','creative','dawn','discovery','dream','energy','focus','friend','future','galaxy','harmony','idea','insight','journey','knowledge','legend','light','logic','memory','mission','momentum','mystery','network','ocean','origin','pioneer','puzzle','quest','rhythm','rocket','science','signal','spirit','story','strategy','sunrise','teamwork','victory','vision','voice','whisper','wisdom','wonder','勇氣','陪伴','舞台','突破','信任','導航','熱血','制服','課本','筆記','系辦','宿舍','迎新','笑聲','夥伴','挑戰','咖啡','創意','默契','藍圖','熱舞','報到','掌聲','合照','社團','系學會','冒險','新生','學長','學姐','教室','操場','期初','夜唱','旅行','海邊','燈塔','星空','火花','羅盤','影子','記憶','步伐','弧光','勇者','信號','驚喜','高歌','電光','火箭','能量','節奏'
];
const wordSets = [
  ['書包','黑板','制服','合作社','操場','社團','考卷','午餐','畢業','晚自習','走廊','補習班','福利社','園遊會','校慶','體育館','校車','導師','鐘聲','便當','樓梯','桌子','獎狀','作業','校長'],
  ['YouTube','籃球','電玩','電影','小說','動漫','手機','音樂','網購','漫畫','旅遊','偶像','追劇','社群','滑板','吉他','美食','咖啡','運動','朋友','錢包','KTV','流行','打工','大人'],
  ['鑰匙','雨傘','電腦','冰箱','床','衣櫃','燈','時鐘','筆記本','椅子','書桌','水杯','眼鏡','耳機','手機','鞋子','枕頭','門','窗戶','鏡子','手電筒','衛生紙','書','地圖','刀'],
  ['愛','夢想','勇氣','希望','未來','自由','歡樂','熱情','和平','正義','時間','記憶','藝術','歷史','科學','奇蹟','信念','生命','命運','靈魂','黑暗','恐懼','聲音','沉默','死亡']
];
const defaultRoomConfigs = [
  { id: 'room-alpha', name: '機密代號 A', capacity: 10 },
  { id: 'room-bravo', name: '機密代號 B', capacity: 10 },
  { id: 'room-charlie', name: '機密代號 C', capacity: 10 },
  { id: 'room-delta', name: '機密代號 D', capacity: 10 }
];

const localPlayerKey = 'codenamePlayerStore-v1';
const BASE_GUESSES = 2; // 調高為 2，體驗較合理
const lastRoomKey = 'codenameLastRoomId';

// -------------------- Helpers --------------------
function normalizeRoomId(roomId){const v=typeof roomId==='string'?roomId.trim():'';if(!v)throw new Error('房間代碼無效，請重新選擇房間');return v;}
function roomDoc(roomId,...segments){return doc(db,'rooms',normalizeRoomId(roomId),...segments);}
function roomCollection(roomId,...segments){return collection(db,'rooms',normalizeRoomId(roomId),...segments);}
function logAndAlert(msg,err){console.error(msg,err||'');alert(msg);}
function shuffle(a){const c=[...a];for(let i=c.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[c[i],c[j]]=[c[j],c[i]];}return c;}
function otherTeam(team){return team==='red'?'blue':'red';}
function generateBoard(startingTeam, wordSet = wordPool){
  const selected = shuffle([...wordSet]).slice(0,25);
  const roles = [...Array(9).fill(startingTeam), ...Array(8).fill(otherTeam(startingTeam)), ...Array(7).fill('neutral'),'assassin'];
  const shuffled = shuffle(roles);
  return selected.map((word,i)=>({index:i,word,role:shuffled[i],revealed:false}));
}
function getJoinedAtValue(data){const ts=data.joinedAt;return ts&&typeof ts.seconds==='number'?ts.seconds+(ts.nanoseconds||0)/1e9:0;}

// localStorage utils
function loadPlayerStore(){try{return JSON.parse(localStorage.getItem(localPlayerKey)||'{}')}catch{return {}}}
function persistPlayerStore(s){try{localStorage.setItem(localPlayerKey,JSON.stringify(s))}catch{}}
let playerStore = loadPlayerStore();
function setStoredPlayer(roomId, playerId){playerStore[normalizeRoomId(roomId)]={playerId};persistPlayerStore(playerStore);}
function removeStoredPlayer(roomId){const id=normalizeRoomId(roomId);delete playerStore[id];persistPlayerStore(playerStore);}
function getStoredPlayer(roomId){return playerStore[normalizeRoomId(roomId)]}
function setLastRoom(roomId){localStorage.setItem(lastRoomKey,normalizeRoomId(roomId))}
function clearLastRoom(){localStorage.removeItem(lastRoomKey)}
function getLastRoom(){return localStorage.getItem(lastRoomKey)}

// -------------------- Global state --------------------
const state = {
  rooms:new Map(), roomData:null, players:[], cards:[],
  currentRoomId:null, currentPlayerId:null,
  unsubRooms:null, unsubRoom:null, unsubPlayers:null, unsubCards:null,
  uid:null
};
const lobbyView=document.getElementById('lobby-view');
const roomView=document.getElementById('room-view');
const roomListEl=document.getElementById('room-list');
const playerListEl=document.getElementById('player-list');
const roomTitleEl=document.getElementById('room-title');
const roomMetaEl=document.getElementById('room-meta');
const roomStatusEl=document.getElementById('room-status');
const viewIndicatorEl=document.getElementById('view-indicator');
const boardGridEl=document.getElementById('board-grid');
const boardScoreEl=document.getElementById('board-score');
const winnerBannerEl=document.getElementById('winner-banner');
const toggleReadyBtn=document.getElementById('toggle-ready');
const startGameBtn=document.getElementById('start-game');
const resetGameBtn=document.getElementById('reset-game');
const leaveRoomBtn=document.getElementById('leave-room');
const authStateEl=document.getElementById('auth-state');

// -------------------- Rendering helpers --------------------
function getCurrentPlayer(){if(!state.currentPlayerId) return null;return state.players.find(p=>p.id===state.currentPlayerId)||null;}
function updateViews(){const inRoom=!!state.currentRoomId;lobbyView.classList.toggle('active',!inRoom);roomView.classList.toggle('active',inRoom);}
function renderRoomList(){
  const items = defaultRoomConfigs.map(cfg=>{
    const room = state.rooms.get(cfg.id)||{};
    const name = room.name||cfg.name;
    const capacity = room.capacity||cfg.capacity;
    const occupied = room.playerCount||0;
    const status = room.status||'lobby';
    const owner = room.ownerName||'尚未指定';
    const statusLabel = status==='lobby'?'等待開始':status==='in-progress'?'遊戲進行中':'已結束';
    const disabled = status==='in-progress'||occupied>=capacity;
    return `
      <div class="room-card">
        <div style="display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start;">
          <h3>${name}</h3><span class="room-status">${statusLabel}</span>
        </div>
        <div class="room-meta"><span>房主：${owner}</span><span>人數：${occupied}/${capacity}</span></div>
        <div class="room-actions" style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <button data-room="${cfg.id}" class="join-room" ${disabled?'disabled':''}>加入房間</button>
          <button data-room="${cfg.id}" class="ghost danger reset-room" type="button">重置房間</button>
        </div>
      </div>`;
  }).join('');
  roomListEl.innerHTML = items;
}
function renderRoomDetail(){
  const room=state.roomData;
  if(!room){
    playerListEl.innerHTML='<div class="empty-state">載入房間中...</div>';
    boardGridEl.innerHTML='';boardScoreEl.innerHTML='';viewIndicatorEl.textContent='請加入房間';winnerBannerEl.style.display='none';return;
  }
  roomTitleEl.textContent=room.name;
  roomMetaEl.textContent=`房主：${room.ownerName||'尚未指定'}｜玩家 ${room.playerCount||0}/${room.capacity}`;
  let statusText=room.status==='lobby'?'等待準備中':room.status==='in-progress'?'遊戲進行中':'本局結束';
  if(room.status==='in-progress'&&room.currentTurn){statusText+=room.currentTurn==='red'?'｜輪到紅隊':'｜輪到藍隊'}
  roomStatusEl.textContent=statusText;

  const currentPlayer=getCurrentPlayer(); const isOwner=currentPlayer&&room.ownerId===currentPlayer.id;
  playerListEl.innerHTML = state.players.map(p=>{
    const badges=[];
    if(p.id===room.ownerId) badges.push('<span class="badge owner">房主</span>');
    if(p.team) badges.push(`<span class="badge team-${p.team}">${p.team==='red'?'紅隊':'藍隊'}</span>`);
    if(p.isCaptain) badges.push('<span class="badge captain">隊長</span>');
    badges.push(`<span class="badge ${p.ready?'ready':'waiting'}">${p.ready?'已準備':'等待中'}</span>`);
    const canKick=isOwner&&p.id!==room.ownerId;
    const kickBtn=canKick?`<button class="kick-btn" data-player-id="${p.id}">踢出</button>`:'';
    return `<div class="player-console"><div class="top-line"><span class="name">${p.name||'隊友'}</span>${kickBtn}</div><div style="display:flex;flex-wrap:wrap;gap:.4rem;">${badges.join('')}</div></div>`;
  }).join('') || '<div class="empty-state">尚未有人加入，歡迎成為第一位成員！</div>';

  if(currentPlayer){toggleReadyBtn.textContent=currentPlayer.ready?'取消準備':'我準備好了';toggleReadyBtn.disabled=room.status!=='lobby';}
  else{toggleReadyBtn.textContent='我準備好了';toggleReadyBtn.disabled=true;}
  const everyoneReady = room.status==='lobby' && state.players.length>=2 && state.players.every(p=>p.ready);
  startGameBtn.disabled = !(room.status==='lobby' && isOwner && everyoneReady);
  resetGameBtn.disabled = !(isOwner && room.status!=='lobby');

  updateViewIndicator(); renderBoard();
}
function renderBoard(){
  const room=state.roomData;
  if(!room||!state.cards.length){
    boardGridEl.innerHTML='<div class="empty-state">等待房主開始遊戲後才會生成任務地圖。</div>';
    boardGridEl.classList.remove('captain-view');boardGridEl.classList.add('disabled');
    boardScoreEl.innerHTML='';winnerBannerEl.style.display='none';return;
  }
  const currentPlayer=getCurrentPlayer();
  boardGridEl.classList.toggle('captain-view', !!(currentPlayer&&currentPlayer.isCaptain));
  boardGridEl.classList.toggle('disabled', room.status!=='in-progress');
  boardGridEl.innerHTML = state.cards.map(c=>{
    const r = (currentPlayer&&currentPlayer.isCaptain) ? ` role-${c.role}` : (c.revealed?` role-${c.role}`:'');
    return `<div class="card${r}${c.revealed?' revealed':''}" data-index="${c.index}"><span class="label">${c.word}</span></div>`;
  }).join('');
  updateScoreboard();
  if(room.status==='finished'&&room.winner){winnerBannerEl.textContent=room.winner==='red'?'紅隊勝利！':'藍隊勝利！';winnerBannerEl.style.display='block';}
  else{winnerBannerEl.style.display='none';}
}
function updateScoreboard(){
  if(!state.cards.length){boardScoreEl.innerHTML='';return;}
  const counts={red:0,blue:0,neutral:0,assassin:0};
  state.cards.forEach(c=>{if(!c.revealed) counts[c.role]=(counts[c.role]||0)+1;});
  boardScoreEl.innerHTML = `
    <span class="score"><span class="dot" style="background:#ef4444"></span>紅隊剩 ${counts.red}</span>
    <span class="score"><span class="dot" style="background:#2563eb"></span>藍隊剩 ${counts.blue}</span>
    <span class="score"><span class="dot" style="background:#94a3b8"></span>中立 ${counts.neutral}</span>
    <span class="score"><span class="dot" style="background:#0f172a"></span>刺客 ${counts.assassin}</span>`;
}
function updateViewIndicator(){
  const room=state.roomData, me=getCurrentPlayer();
  if(!room||!me){viewIndicatorEl.textContent='請加入房間';return;}
  if(room.status==='lobby'){viewIndicatorEl.textContent='尚未開始';return;}
  if(room.status==='in-progress'){
    const turnInfo = room.currentTurn ? (room.currentTurn==='red'?'輪到紅隊':'輪到藍隊') : '輪到誰等待更新';
    if(me.isCaptain) viewIndicatorEl.textContent=`你是隊長，可查看全部顏色｜${turnInfo}`;
    else if(me.team) viewIndicatorEl.textContent=`你是${me.team==='red'?'紅隊':'藍隊'}成員，只能看到已翻開的卡片｜${turnInfo}`;
    else viewIndicatorEl.textContent='你目前為觀戰者，只能看到公開資訊';
    return;
  }
  viewIndicatorEl.textContent='本局結束，等待房主重設';
}

// -------------------- Firestore listeners --------------------
function cleanupRoomSubscriptions(){ if(state.unsubRoom){state.unsubRoom();state.unsubRoom=null} if(state.unsubPlayers){state.unsubPlayers();state.unsubPlayers=null} if(state.unsubCards){state.unsubCards();state.unsubCards=null} }
function subscribeToDirectory(){
  if(state.unsubRooms) state.unsubRooms();
  state.unsubRooms = onSnapshot(collection(db,'rooms'), snap=>{
    state.rooms.clear();
    snap.forEach(d=>{
      if(defaultRoomConfigs.some(c=>c.id===d.id)) state.rooms.set(d.id,{id:d.id,...d.data()});
    });
    renderRoomList();
  });
}
function subscribeToRoom(roomId){
  cleanupRoomSubscriptions(); state.roomData=null; state.players=[]; state.cards=[];
  if(!roomId){renderRoomDetail();return;}
  const safeRoomId=normalizeRoomId(roomId);
  state.unsubRoom = onSnapshot(doc(db,'rooms',safeRoomId), s=>{
    if(!s.exists()){logAndAlert('房間已不存在，將返回大廳'); state.currentRoomId=null; state.currentPlayerId=null; clearLastRoom(); updateViews(); renderRoomList(); renderRoomDetail(); return;}
    state.roomData={id:s.id,...s.data()}; renderRoomDetail();
  });
  state.unsubPlayers = onSnapshot(query(roomCollection(roomId,'players'),orderBy('joinedAt','asc')), s=>{
    state.players = s.docs.map(d=>({id:d.id,...d.data()}));
    const stored=getStoredPlayer(roomId);
    if(stored && !state.players.some(p=>p.id===stored.playerId)){ removeStoredPlayer(roomId); state.currentPlayerId=null; }
    renderRoomDetail();
  });
  state.unsubCards = onSnapshot(roomCollection(roomId,'cards'), s=>{
    state.cards = s.docs.map(d=>{const data=d.data(); return {id:d.id,...data,index: typeof data.index==='number'?data.index:Number(d.id)};}).sort((a,b)=>a.index-b.index);
    renderBoard();
  });
}

// -------------------- Firestore utilities --------------------
async function ensureDefaultRooms(){
  await Promise.all(defaultRoomConfigs.map(async cfg=>{
    const ref=doc(db,'rooms',cfg.id); const snap=await getDoc(ref);
    if(!snap.exists()){
      await setDoc(ref,{name:cfg.name,capacity:cfg.capacity,status:'lobby',ownerId:null,ownerName:'',startingTeam:'red',winner:null,playerCount:0,remainingRed:null,remainingBlue:null,currentTurn:null,guessesRemaining:null,createdAt:serverTimestamp()});
    }else{
      const data=snap.data(), updates={};
      if(data.name!==cfg.name) updates.name=cfg.name;
      if(data.capacity!==cfg.capacity) updates.capacity=cfg.capacity;
      if(typeof data.playerCount!=='number') updates.playerCount=0;
      if(!('remainingRed'in data)) updates.remainingRed=null;
      if(!('remainingBlue'in data)) updates.remainingBlue=null;
      if(!('currentTurn'in data)) updates.currentTurn=null;
      if(!('guessesRemaining'in data)) updates.guessesRemaining=null;
      if(Object.keys(updates).length) await updateDoc(ref,updates);
    }
  }));
}
async function fetchPlayerRefs(roomId){ try{const refs=await getDocs(roomCollection(roomId,'players')); return refs.docs.map(d=>({ref:d.ref,id:d.id,data:d.data()})).sort((a,b)=>getJoinedAtValue(a.data)-getJoinedAtValue(b.data));}catch{return []}}
async function fetchCardRefs(roomId){ try{const refs=await getDocs(roomCollection(roomId,'cards')); return refs.docs.map(d=>d.ref);}catch{return []}}

// -------------------- Room flows --------------------
async function resetRoom(roomId){
  const safeRoomId=normalizeRoomId(roomId);
  if(!confirm(`確認要重置 ${roomId} 嗎？`)) return;
  try{
    const playersSnap=await getDocs(roomCollection(safeRoomId,'players'));
    const cardsSnap=await getDocs(roomCollection(safeRoomId,'cards'));
    await runTransaction(db, async tx=>{
      const roomRef=doc(db,'rooms',safeRoomId); const roomSnap=await tx.get(roomRef); if(!roomSnap.exists()) return;
      playersSnap.forEach(d=>tx.delete(d.ref));
      cardsSnap.forEach(d=>tx.delete(d.ref));
      tx.set(roomRef,{status:'lobby',ownerId:null,ownerName:'',startingTeam:'red',currentTurn:null,guessesRemaining:null,winner:null,playerCount:0,remainingRed:null,remainingBlue:null},{merge:true});
    });
    if(playerStore[safeRoomId]){delete playerStore[safeRoomId];persistPlayerStore(playerStore);}
    if(state.currentRoomId===roomId){clearLastRoom(); cleanupRoomSubscriptions(); state.currentRoomId=null; state.currentPlayerId=null; state.roomData=null; state.players=[]; state.cards=[]; updateViews(); renderRoomDetail();}
    else{renderRoomDetail()}
    renderRoomList();
  }catch(e){logAndAlert('重置房間失敗',e);}
}
async function attemptResume(){
  const last=getLastRoom(); if(!last) return;
  const stored=getStoredPlayer(last); if(!stored) return;
  try{
    const s=await getDoc(doc(db,'rooms',last,'players',stored.playerId));
    if(s.exists()){ state.currentRoomId=last; state.currentPlayerId=stored.playerId; subscribeToRoom(last); updateViews(); }
    else{ removeStoredPlayer(last); clearLastRoom(); }
  }catch{}
}
async function handleJoinRoom(roomId){
  if(!roomId) return;
  const trimmed=roomId.trim(); if(!trimmed) return;
  const room=state.rooms.get(trimmed); if(room&&room.status==='in-progress'){logAndAlert('遊戲進行中，請稍候再加入'); return;}
  const stored=getStoredPlayer(trimmed);
  if(stored){
    try{ const s=await getDoc(doc(db,'rooms',trimmed,'players',stored.playerId));
      if(s.exists()){ state.currentRoomId=trimmed; state.currentPlayerId=stored.playerId; setLastRoom(trimmed); subscribeToRoom(trimmed); updateViews(); return; }
      removeStoredPlayer(trimmed);
    }catch{}
  }
  const nickname=prompt('輸入你的暱稱'); if(!nickname) return;
  const safeName=nickname.trim().slice(0,16); if(!safeName) return;
  try{
    const playerId = await joinRoomTransaction(trimmed, safeName);
    state.currentRoomId=trimmed; state.currentPlayerId=playerId; setStoredPlayer(trimmed,playerId); setLastRoom(trimmed); subscribeToRoom(trimmed); updateViews();
  }catch(e){logAndAlert(e.message||'加入房間失敗',e);}
}
async function joinRoomTransaction(roomId, name){
  const safeRoomId=normalizeRoomId(roomId);
  const playerId=crypto.randomUUID();
  const uid = state.uid; if(!uid){throw new Error('尚未登入');}
  await runTransaction(db, async tx=>{
    const roomRef=doc(db,'rooms',safeRoomId); const roomSnap=await tx.get(roomRef); if(!roomSnap.exists()) throw new Error('房間不存在');
    const room=roomSnap.data(); if(room.status==='in-progress') throw new Error('遊戲進行中，請稍候加入');
    const currentCount=room.playerCount||0; if(currentCount>=(room.capacity||10)) throw new Error('房間人數已滿');
    tx.set(doc(db,'rooms',safeRoomId,'players',playerId),{ uid, name, ready:false, team:null, isCaptain:false, joinedAt:serverTimestamp() });
    const updates={ playerCount: currentCount+1 };
    if(!room.ownerId){ updates.ownerId=playerId; updates.ownerName=name; }
    tx.set(roomRef,updates,{merge:true});
  });
  return playerId;
}
async function toggleReady(){
  const roomId=state.currentRoomId; const me=getCurrentPlayer(); if(!roomId||!me) return;
  try{ await updateDoc(doc(db,'rooms',normalizeRoomId(roomId),'players',me.id),{ready:!me.ready}); }catch(e){logAndAlert('更新準備狀態失敗',e);}
}
async function startGame(){
  const roomId=state.currentRoomId; const me=getCurrentPlayer(); if(!roomId||!me) return;
  const safeRoomId=normalizeRoomId(roomId); const playerRefs=await fetchPlayerRefs(safeRoomId); const cardRefs=await fetchCardRefs(safeRoomId);
  try{
    await runTransaction(db, async tx=>{
      const roomRef=doc(db,'rooms',safeRoomId); const roomSnap=await tx.get(roomRef);
      if(!roomSnap.exists()) throw new Error('房間不存在');
      const room=roomSnap.data();
      if(room.ownerId!==me.id) throw new Error('只有房主可以開始遊戲');
      if(room.status!=='lobby') throw new Error('遊戲狀態不允許開始');
      const players=[];
      for(const item of playerRefs){ const s=await tx.get(item.ref); if(s.exists()) players.push({id:s.id,...s.data()}); }
      if(players.length<2) throw new Error('至少需要兩位玩家');
      if(!players.every(p=>p.ready)) throw new Error('仍有人未按準備');

      const randomized=shuffle(players); const mid=Math.ceil(randomized.length/2);
      const redTeam=randomized.slice(0,mid), blueTeam=randomized.slice(mid);
      if(!redTeam.length||!blueTeam.length) throw new Error('需要保證兩隊都有成員');
      const redCaptain=redTeam[Math.floor(Math.random()*redTeam.length)];
      const blueCaptain=blueTeam[Math.floor(Math.random()*blueTeam.length)];
      const startingTeam=Math.random()<0.5?'red':'blue';
      const wordSet=wordSets[Math.floor(Math.random()*wordSets.length)];
      const cards=generateBoard(startingTeam, wordSet);
      const remainingRed=cards.filter(c=>c.role==='red').length;
      const remainingBlue=cards.filter(c=>c.role==='blue').length;

      cardRefs.forEach(ref=>tx.delete(ref));
      cards.forEach(card=>tx.set(doc(db,'rooms',safeRoomId,'cards',String(card.index)), card));

      randomized.forEac
