// Server gaplek: serve halaman + WebSocket. Server memegang semua logika dan kartu.
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
  }
  res.writeHead(404); res.end('Not found');
});
const wss = new WebSocketServer({ server });

const rooms = new Map();
const rnd = n => Math.floor(Math.random() * n);

function mkRoom(code) {
  return {
    code, host: -1, tm: 0,
    seats: [0, 1, 2, 3].map(i => ({ name: 'Bot ' + (i + 1), bot: true, ws: null })),
    g: { phase: 'lobby', hands: [[], [], [], []], board: [], turn: 0, passes: 0, first: true, log: '', winner: -1, why: '' }
  };
}

function newGame(r) {
  const d = [];
  for (let a = 0; a < 7; a++) for (let b = a; b < 7; b++) d.push([a, b]);
  for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  const g = r.g;
  g.hands = [0, 1, 2, 3].map(i => d.slice(i * 7, i * 7 + 7));
  g.board = []; g.passes = 0; g.first = true; g.winner = -1; g.why = ''; g.phase = 'play';
  g.log = 'Ronde baru dimulai';
  g.turn = g.hands.findIndex(h => h.some(t => t[0] === 6 && t[1] === 6));
}

function moves(g, h) {
  const m = [];
  if (!g.board.length) {
    h.forEach((t, i) => { if (!g.first || (t[0] === 6 && t[1] === 6)) m.push({ i, e: 'R' }); });
    return m;
  }
  const L = g.board[0][0], R = g.board[g.board.length - 1][1];
  h.forEach((t, i) => {
    if (t[0] === L || t[1] === L) m.push({ i, e: 'L' });
    if (t[0] === R || t[1] === R) m.push({ i, e: 'R' });
  });
  return m;
}

function play(r, s, i, e) {
  const g = r.g, t = g.hands[s].splice(i, 1)[0];
  if (!g.board.length) g.board.push(t);
  else if (e === 'L') { const L = g.board[0][0]; g.board.unshift(t[1] === L ? [t[0], t[1]] : [t[1], t[0]]); }
  else { const R = g.board[g.board.length - 1][1]; g.board.push(t[0] === R ? [t[0], t[1]] : [t[1], t[0]]); }
  g.first = false; g.passes = 0;
  g.log = r.seats[s].name + ' main ' + t[0] + '-' + t[1];
  if (!g.hands[s].length) { g.phase = 'over'; g.winner = s; g.why = 'kartu habis'; }
  else g.turn = (g.turn + 1) % 4;
}

function step(r) {
  const g = r.g; if (g.phase !== 'play') return;
  const h = g.hands[g.turn], m = moves(g, h);
  if (!m.length) {
    g.passes++; g.log = r.seats[g.turn].name + ' lewat';
    if (g.passes >= 4) {
      const sm = g.hands.map(x => x.reduce((a, t) => a + t[0] + t[1], 0));
      g.phase = 'over'; g.winner = sm.indexOf(Math.min(...sm)); g.why = 'buntu, poin terkecil menang';
    } else g.turn = (g.turn + 1) % 4;
  } else {
    m.sort((a, b) => h[b.i][0] + h[b.i][1] - h[a.i][0] - h[a.i][1]); // bot: buang kartu terbesar
    play(r, g.turn, m[0].i, m[0].e);
  }
  broadcast(r); sched(r);
}

function sched(r) {
  clearTimeout(r.tm);
  const g = r.g; if (g.phase !== 'play') return;
  if (r.seats[g.turn].bot || !moves(g, g.hands[g.turn]).length) r.tm = setTimeout(() => step(r), 1000);
}

function view(r, s) {
  const g = r.g;
  return {
    t: 'state', code: r.code, me: s, host: r.host, phase: g.phase,
    seats: r.seats.map((x, i) => ({ name: x.name, bot: x.bot, n: g.hands[i].length })),
    board: g.board, turn: g.turn, hand: g.hands[s],
    moves: g.phase === 'play' && g.turn === s ? moves(g, g.hands[s]) : [],
    log: g.log, winner: g.winner, why: g.why
  };
}
function broadcast(r) {
  r.seats.forEach((x, i) => { if (x.ws && x.ws.readyState === 1) x.ws.send(JSON.stringify(view(r, i))); });
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join') {
      if (ws.room) return;
      const code = String(m.code || '').trim().toLowerCase().slice(0, 20) || 'solo-' + Math.random().toString(36).slice(2, 6);
      let r = rooms.get(code); if (!r) { r = mkRoom(code); rooms.set(code, r); }
      const s = r.seats.findIndex(x => x.bot);
      if (s < 0) return ws.send(JSON.stringify({ t: 'err', msg: 'Meja sudah penuh (4 pemain).' }));
      r.seats[s] = { name: String(m.name || 'Pemain').slice(0, 12), bot: false, ws };
      ws.room = r; ws.seat = s;
      if (r.host < 0) r.host = s;
      broadcast(r); sched(r); return;
    }
    const r = ws.room; if (!r) return;
    const g = r.g;
    if (m.t === 'start' && ws.seat === r.host && g.phase !== 'play') { newGame(r); broadcast(r); sched(r); }
    if (m.t === 'play' && g.phase === 'play' && g.turn === ws.seat &&
        moves(g, g.hands[ws.seat]).some(x => x.i === m.i && x.e === m.e)) {
      play(r, ws.seat, m.i, m.e); broadcast(r); sched(r);
    }
  });
  ws.on('close', () => {
    const r = ws.room; if (!r) return;
    r.seats[ws.seat] = { name: 'Bot ' + (ws.seat + 1), bot: true, ws: null };
    const hs = r.seats.findIndex(x => !x.bot);
    if (hs < 0) { clearTimeout(r.tm); rooms.delete(r.code); return; }
    if (r.host === ws.seat) r.host = hs;
    broadcast(r); sched(r);
  });
});

server.listen(PORT, () => console.log('Gaplek berjalan di http://localhost:' + PORT));
