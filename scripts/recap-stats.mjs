// 一次性(第2版)：读各赛季复盘文本，按"夜/天"分块统计，打印汇总数字与高频词（过滤玩家名字）
const BASE = 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
const get = async p => (await fetch(`${BASE}/${p}.json`)).json();
const all = new Map();
for (const p of ['tournament/recaps', 'tournament/s3/recaps', 'tournament/s4/recaps', 'archive/s3/recaps', 'tournament/s2/recaps', 'tournament/s1/recaps']) {
  const d = await get(p); let n = 0;
  for (const r of Object.values(d || {})) { if (r && r.body) { n++; const k = r.title + '|' + (r.date || '') + '|' + (r.game || ''); if (!all.has(k)) all.set(k, r); } }
  console.log(p, '条数', n);
}
const names = new Set();
for (const s of ['s1', 's2', 's3', 's4']) { const pl = await get(`playerProfiles/${s}/players`); for (const p of Object.values(pl || {})) [p.name, p.displayName].forEach(x => x && names.add(String(x).trim())); }
const recaps = [...all.values()];
const season = r => (/^S4/.test(r.title) ? 'S4' : 'S3');
console.log('去重后复盘', recaps.length, 'S3', recaps.filter(r => season(r) === 'S3').length, 'S4', recaps.filter(r => season(r) === 'S4').length);
const nums = s => (s.match(/\d+/g) || []).map(Number);
const C = {}; const inc = (s, k) => { C[s] ??= {}; C[s][k] = (C[s][k] || 0) + 1; };
const dayWords = {}, hunterWords = {};
for (const r of recaps) {
  const S = season(r), b = r.body; inc(S, '复盘数');
  const head = b.split('🌙')[0];
  const seats = role => { const m = head.match(new RegExp(role + '\\s*(\\d+(?:\\s*\\/\\s*\\d+)*)')); return m ? m[1].split('/').map(x => +x.trim()) : []; };
  const witch = seats('女巫'), hunter = seats('猎人'), wk = seats('狼王'), seer = [...seats('预言家'), ...seats('通灵师')];
  if (witch.length) inc(S, '有女巫'); if (hunter.length) inc(S, '有猎人'); if (wk.length) inc(S, '有狼王'); if (seer.length) inc(S, '有预言家或通灵师');
  const blocks = b.split(/(?=🌙|☀️)/).slice(1).map(t => ({ night: t.startsWith('🌙'), idx: '一二三四五六'.indexOf((t.match(/第(.)(?:晚|天)/) || [])[1]), t }));
  const n1 = blocks.find(x => x.night && x.idx === 0), d1 = blocks.find(x => !x.night && x.idx === 0);
  if (n1) { const m = [...n1.t.matchAll(/(?:狼人击杀|击杀号码)\s*(\d+)/g)].map(x => +x[1]); if (m.length) { inc(S, '首夜有刀口'); if (m.some(s => witch.includes(s))) inc(S, '女巫首夜被刀'); } }
  const poison = blocks.filter(x => x.night).flatMap(x => [...x.t.matchAll(/女巫毒\s*(\d+)/g)].map(m => +m[1]));
  if (poison.length) inc(S, '用毒局'); if (poison.some(s => hunter.includes(s))) inc(S, '猎人被毒');
  if (/猎人[^\n]{0,10}(开枪|带走|枪)/.test(b)) inc(S, '猎人开枪(文字)'); if (/狼王[^\n]{0,10}(开枪|带走|枪)/.test(b)) inc(S, '狼王开枪(文字)');
  if (d1) { const words = new Set((d1.t.match(/[一-龥]{2,4}/g) || []).filter(w => ![...names].some(n => n && (w.includes(n) || n.includes(w))))); words.forEach(w => dayWords[w] = (dayWords[w] || 0) + 1);
    if (seer.some(s => new RegExp(`(放逐|出局|抗推|票出|投出|公投)[^\\n]{0,12}\\b${s}\\b|\\b${s}\\b[^\\n]{0,8}(被放逐|出局|被抗推|被票出|被投出)`).test(d1.t))) inc(S, '预言家通灵师首日被放逐(关键词)'); }
  for (const m of b.matchAll(/猎人[^\n]{0,14}/g)) (m[0].match(/[一-龥]{2,4}/g) || []).filter(w => ![...names].some(n => n && (w.includes(n) || n.includes(w)))).forEach(w => hunterWords[w] = (hunterWords[w] || 0) + 1);
}
console.log(JSON.stringify(C, null, 1));
const top = o => Object.entries(o).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([w, n]) => `${w}:${n}`).join(' ');
console.log('第一天高频词 ->', top(dayWords)); console.log('猎人附近高频词 ->', top(hunterWords));
