// 一次性：跨赛季去重统计累计不同玩家数（只打印数字，不打印名字）
import fs from 'fs';
const html = fs.readFileSync('index.html', 'utf8');
const grab = (key) => { const i = html.indexOf(key) + key.length; let d = 0, j = i; for (; j < html.length; j++) { const c = html[j]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (d === 0) { j++; break; } } } return JSON.parse(html.slice(i, j)); };
const H = grab('HISTORY_DATA='), S1 = grab('const S1_MATCHES=');
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
const seasons = {};
seasons.S1 = new Set(S1.rows.filter(r => r[10]).map(r => norm(S1.names[r[0]])));
seasons.S2 = new Set(H.S2.filter(p => +p.games > 0).map(p => norm(p.name)));
const BASE = 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
for (const s of ['s3', 's4']) {
  const get = async k => (await fetch(`${BASE}/playerProfiles/${s}/${k}.json`)).json();
  const [pl, ms] = [await get('players'), await get('matches')];
  const set = new Set(); let noname = 0;
  for (const m of Object.values(ms || {})) { if (m.exhibition) continue; for (const e of m.entries || []) { const p = (pl || {})[e.playerId] || {}; const n = norm(p.name || p.displayName || e.name || e.playerName); if (n) set.add(n); else noname++; } }
  seasons[s.toUpperCase()] = set; console.log(s, 'entries without name:', noname);
}
const cum = new Set(); const out = [];
for (const k of ['S1', 'S2', 'S3', 'S4']) { const set = seasons[k]; const before = cum.size; set.forEach(x => cum.add(x)); out.push(`${k}: 本季${set.size}人, 新增${cum.size - before}人, 累计不重复${cum.size}人`); }
console.log(out.join('\n'));
const all = ['S1', 'S2', 'S3', 'S4'].map(k => seasons[k]);
const cnt = new Map(); all.forEach(s => s.forEach(x => cnt.set(x, (cnt.get(x) || 0) + 1)));
const dist = [1, 2, 3, 4].map(n => `${n}个赛季:${[...cnt.values()].filter(v => v === n).length}人`);
console.log('参与赛季数分布 ->', dist.join(', '));
