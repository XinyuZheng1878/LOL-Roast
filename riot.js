// 从 Riot 官方 API 拉取玩家最近的对局，并整理成适合锐评的统计数据。
// 注意：Riot API 只覆盖外服（韩服、日服、美服、欧服、东南亚等），不包含腾讯代理的国服。

// 服务器 -> 路由区域（match-v5 用）
export const SERVERS = {
  kr: { label: "韩服 KR", region: "asia" },
  jp1: { label: "日服 JP", region: "asia" },
  na1: { label: "美服 NA", region: "americas" },
  br1: { label: "巴西 BR", region: "americas" },
  euw1: { label: "西欧 EUW", region: "europe" },
  eun1: { label: "北欧东欧 EUNE", region: "europe" },
  tr1: { label: "土耳其 TR", region: "europe" },
  oc1: { label: "大洋洲 OCE", region: "sea" },
  sg2: { label: "新加坡 SG", region: "sea" },
  tw2: { label: "台服 TW", region: "sea" },
  vn2: { label: "越南 VN", region: "sea" },
};

const QUEUE_NAMES = {
  420: "单双排",
  440: "灵活排位",
  400: "匹配",
  430: "匹配",
  450: "极地大乱斗",
  490: "快速匹配",
  1700: "斗魂竞技场",
};

const POSITION_NAMES = {
  TOP: "上单",
  JUNGLE: "打野",
  MIDDLE: "中单",
  BOTTOM: "ADC",
  UTILITY: "辅助",
};

export class RiotError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function riotGet(url, apiKey) {
  const res = await fetch(url, { headers: { "X-Riot-Token": apiKey } });
  if (res.ok) return res.json();
  if (res.status === 404) throw new RiotError("找不到这个召唤师，检查一下名字、#后面的标签和服务器", 404);
  if (res.status === 401 || res.status === 403) {
    throw new RiotError("Riot API key 无效或已过期（开发者 key 每 24 小时要重新生成）", res.status);
  }
  if (res.status === 429) throw new RiotError("请求太频繁了，等一分钟再试", 429);
  throw new RiotError(`Riot API 出错了（${res.status}）`, res.status);
}

export async function fetchRecentMatches({ gameName, tagLine, server, count = 10, apiKey }) {
  const serverInfo = SERVERS[server];
  if (!serverInfo) throw new RiotError("不支持的服务器", 400);
  const { region } = serverInfo;
  // account-v1 不支持 sea，用 asia 查账号即可
  const accountRegion = region === "sea" ? "asia" : region;

  const account = await riotGet(
    `https://${accountRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    apiKey,
  );
  const ids = await riotGet(
    `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=${count}`,
    apiKey,
  );
  if (ids.length === 0) throw new RiotError("这个账号最近没有对局记录", 404);

  // 开发者 key 限速 20 次/秒，10 场并发没问题
  const matches = await Promise.all(
    ids.map((id) => riotGet(`https://${region}.api.riotgames.com/lol/match/v5/matches/${id}`, apiKey)),
  );

  const games = matches.map((m) => toGame(m, account.puuid)).filter(Boolean);
  return { player: `${account.gameName}#${account.tagLine}`, server: serverInfo.label, games };
}

// 把一场原始对局数据压缩成我们关心的字段
function toGame(match, puuid) {
  const info = match.info;
  const me = info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  const team = info.participants.filter((p) => p.teamId === me.teamId);
  const teamKills = team.reduce((s, p) => s + p.kills, 0);
  const teamDamage = team.reduce((s, p) => s + p.totalDamageDealtToChampions, 0);
  const minutes = info.gameDuration / 60;
  // 对位：敌方同位置的玩家（大乱斗等模式没有位置，就没有对位）
  const opponent = me.teamPosition
    ? info.participants.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition)
    : null;

  return {
    id: match.metadata.matchId,
    playedAt: info.gameStartTimestamp,
    ...playerStats(me, minutes),
    opponent: opponent ? { champion: opponent.championName, ...playerStats(opponent, minutes) } : null,
    champion: me.championName,
    queue: QUEUE_NAMES[info.queueId] ?? "其他模式",
    position: POSITION_NAMES[me.teamPosition] ?? "未知位置",
    win: me.win,
    minutes: Math.round(minutes),
    killParticipation: teamKills ? Math.round(((me.kills + me.assists) / teamKills) * 100) : 0,
    damageShare: teamDamage ? Math.round((me.totalDamageDealtToChampions / teamDamage) * 100) : 0,
    visionScore: me.visionScore,
    pentaKills: me.pentaKills,
    firstBlood: me.firstBloodKill,
  };
}

// 赛后报告用的详细数据，自己和对位都算一份方便对比
function playerStats(p, minutes) {
  return {
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    csPerMin: +((p.totalMinionsKilled + p.neutralMinionsKilled) / minutes).toFixed(1),
    goldPerMin: Math.round(p.goldEarned / minutes),
    damagePerMin: Math.round(p.totalDamageDealtToChampions / minutes),
    damageTakenPerMin: Math.round(p.totalDamageTaken / minutes),
    visionPerMin: +(p.visionScore / minutes).toFixed(2),
    wardsPlaced: p.wardsPlaced,
    wardsKilled: p.wardsKilled,
    controlWards: p.visionWardsBoughtInGame,
    buildingDamage: p.damageDealtToBuildings,
    timeDeadSec: p.totalTimeSpentDead,
    largestMultiKill: p.largestMultiKill,
  };
}

// 汇总统计：给 AI 和卡片都用
export function summarize(games) {
  const n = games.length;
  const wins = games.filter((g) => g.win).length;
  const sum = (key) => games.reduce((s, g) => s + (Number.isFinite(g[key]) ? g[key] : 0), 0);
  // 截图识别的数据可能缺字段，只对有值的场次求平均，都没有就是 null
  const avg = (key, digits) => {
    const vals = games.map((g) => g[key]).filter(Number.isFinite);
    return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(digits) : null;
  };
  const k = sum("kills");
  const d = sum("deaths");
  const a = sum("assists");

  // 每个英雄的场次和胜负，算好直接给 AI，免得它自己数错
  const byChamp = {};
  for (const g of games) {
    const c = (byChamp[g.champion] ??= { name: g.champion, games: 0, wins: 0, k: 0, d: 0, a: 0 });
    c.games++;
    if (g.win) c.wins++;
    c.k += g.kills;
    c.d += g.deaths;
    c.a += g.assists;
  }
  const champions = Object.values(byChamp)
    .sort((x, y) => y.games - x.games || y.wins - x.wins)
    .map((c) => ({
      name: c.name,
      games: c.games,
      wins: c.wins,
      losses: c.games - c.wins,
      kda: +((c.k + c.a) / Math.max(1, c.d)).toFixed(2),
    }));
  const topChampions = champions.slice(0, 3).map((c) => ({ name: c.name, times: c.games }));

  const kda = (g) => (g.kills + g.assists) / Math.max(1, g.deaths);
  const sorted = [...games].sort((x, y) => kda(x) - kda(y));

  // 从最近一场往前数连胜/连败
  let streak = 0;
  for (const g of games) {
    if (g.win === games[0].win) streak++;
    else break;
  }

  return {
    games: n,
    wins,
    losses: n - wins,
    winRate: Math.round((wins / n) * 100),
    kda: +((k + a) / Math.max(1, d)).toFixed(2),
    avgKills: +(k / n).toFixed(1),
    avgDeaths: +(d / n).toFixed(1),
    avgAssists: +(a / n).toFixed(1),
    avgCsPerMin: avg("csPerMin", 1),
    avgVision: avg("visionScore", 0),
    pentaKills: sum("pentaKills"),
    champions,
    topChampions,
    worstGame: sorted[0],
    bestGame: sorted[n - 1],
    streak: { type: games[0].win ? "连胜" : "连败", count: streak },
  };
}
