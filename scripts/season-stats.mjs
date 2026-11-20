// 一次性统计：读取 Firebase 各赛季对局，输出对局数 / 玩家数（只打印汇总数字）
const BASE = 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
for (const s of ['s1', 's2', 's3', 's4']) {
  const get = async (k) => { const r = await fetch(`${BASE}/playerProfiles/${s}/${k}.json`); return r.ok ? r.json() : null; };
  const [players, matches] = await Promise.all([get('players'), get('matches')]);
  const ms = Object.values(matches || {});
  const pc = players ? Object.keys(players).length : 0;
  const by = {}, ids = {}, ent = {};
  const dates = [];
  for (const m of ms) {
    const t = m.exhibition ? '表演赛' : (m.track === 'baby' ? '宝宝赛' : '正赛');
    by[t] = (by[t] || 0) + 1;
    ids[t] = ids[t] || new Set();
    ent[t] = (ent[t] || 0) + (m.entries || []).length;
    for (const e of m.entries || []) ids[t].add(e.playerId);
    if (m.date) dates.push(m.date);
  }
  dates.sort();
  const all = new Set(); for (const t of ['正赛', '宝宝赛']) (ids[t] || []).forEach(x => all.add(x));
  console.log(`== ${s}: players节点=${pc}, matches=${ms.length}, 日期 ${dates[0] || '-'} ~ ${dates[dates.length - 1] || '-'}`);
  for (const t of Object.keys(by)) console.log(`   ${t}: ${by[t]}局, 出场人次${ent[t]}, 不同玩家${ids[t].size}`);
  console.log(`   (正赛+宝宝赛) 不同玩家合计=${all.size}`);
}
