// 一次性：探查对局记录里夜晚/白天记录(recordData)的覆盖率与字段格式（不打印玩家名字）
const BASE = 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
for (const s of ['s3', 's4']) {
  const ms = Object.values(await (await fetch(`${BASE}/playerProfiles/${s}/matches.json`)).json() || {}).filter(m => !m.exhibition);
  const withRec = ms.filter(m => m.recordData && Object.keys(m.recordData).length);
  const fields = {}, samples = {};
  for (const m of withRec) for (const [f, cols] of Object.entries(m.recordData)) { fields[f] = (fields[f] || 0) + 1; samples[f] = samples[f] || new Set(); if (samples[f].size < 6) Object.entries(cols).slice(0, 2).forEach(([c, v]) => samples[f].add(`${c}:${v}`)); }
  console.log(`== ${s}: 对局${ms.length}, 有夜晚/白天记录${withRec.length}`);
  Object.entries(fields).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${f}: ${n}局  例 ${[...samples[f]].join(' | ')}`));
  const ex = ms.find(m => (m.entries || [])[0]); console.log('  entry keys:', Object.keys(ex.entries[0]).join(','), '| match keys:', Object.keys(ex).join(','));
}
