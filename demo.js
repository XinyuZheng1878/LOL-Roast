// 演示数据：没有 Riot API key 时用来体验完整流程。

// 英雄 -> 常见位置
const CHAMP_POSITIONS = {
  Yasuo: "中单", Yone: "上单", Darius: "上单", LeeSin: "打野", Kayn: "打野",
  Ahri: "中单", Zed: "中单", Ezreal: "ADC", Jinx: "ADC", Thresh: "辅助", Lulu: "辅助",
};
const CHAMPS = Object.keys(CHAMP_POSITIONS);

// 用名字做种子，同一个名字每次生成的数据一样
function seededRandom(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
}

export function demoMatches(gameName = "演示玩家", tagLine = "DEMO") {
  const rand = seededRandom(gameName + tagLine);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + rand() * (hi - lo);
  // 偏爱前两个英雄，更像真实玩家
  const mains = [pick(CHAMPS), pick(CHAMPS)];

  // 生成一个玩家一局的详细数据，ahead 越大表现越好
  const stats = (ahead, minutes) => {
    const deaths = Math.max(0, Math.round(between(2, 9) - ahead * 3));
    return {
      kills: Math.max(0, Math.round(between(1, 8) + ahead * 4)),
      deaths,
      assists: Math.round(between(2, 12)),
      csPerMin: +between(4, 8 + ahead).toFixed(1),
      goldPerMin: Math.round(between(330, 450) + ahead * 60),
      damagePerMin: Math.round(between(400, 800) + ahead * 150),
      damageTakenPerMin: Math.round(between(500, 1000)),
      visionPerMin: +between(0.4, 1.4).toFixed(2),
      wardsPlaced: Math.round(between(4, 20)),
      wardsKilled: Math.round(between(0, 6)),
      controlWards: Math.round(between(0, 4)),
      buildingDamage: Math.round(between(500, 6000) + ahead * 1500),
      timeDeadSec: Math.round(deaths * between(15, 35)),
      largestMultiKill: Math.max(1, Math.round(between(0, 2.5) + ahead)),
    };
  };

  const start = Date.now();
  const games = Array.from({ length: 10 }, (_, i) => {
    const win = rand() < 0.42;
    const minutes = 20 + Math.floor(rand() * 18);
    const ahead = between(-0.6, 0.6) + (win ? 0.3 : -0.3);
    const me = stats(ahead, minutes);
    const champion = rand() < 0.7 ? pick(mains) : pick(CHAMPS);
    const opponent = { champion: pick(CHAMPS.filter((c) => CHAMP_POSITIONS[c] === CHAMP_POSITIONS[champion])), ...stats(-ahead, minutes) };
    // 辅助基本不补刀
    if (CHAMP_POSITIONS[champion] === "辅助") {
      me.csPerMin = +between(0.8, 2).toFixed(1);
      opponent.csPerMin = +between(0.8, 2).toFixed(1);
    }
    return {
      id: `DEMO_${i + 1}`,
      playedAt: start - i * 3600_000 * 5,
      ...me,
      opponent,
      champion,
      queue: "单双排",
      position: CHAMP_POSITIONS[champion],
      win,
      minutes,
      killParticipation: 25 + Math.floor(rand() * 50),
      damageShare: 10 + Math.floor(rand() * 25),
      visionScore: Math.round(me.visionPerMin * minutes),
      pentaKills: rand() < 0.03 ? 1 : 0,
      firstBlood: rand() < 0.15,
    };
  });

  return { player: `${gameName}#${tagLine}`, server: "演示数据", games };
}
