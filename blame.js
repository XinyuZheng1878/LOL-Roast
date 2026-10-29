// 开黑群“战犯评选”：识别一局结算截图里我方五人的数据，排名后让锐评官给每人一句点评。
import { askAIJSON } from "./ai.js";
import { drawPersona, TONES } from "./personas.js";
import { toPublicPersona } from "./roast.js";
import { ScreenshotError, parseDataUrl } from "./screenshot.js";

const VISION_SYSTEM = `你是英雄联盟单局结算截图识别助手。截图是一局结束后的数据面板，通常有两队各 5 人。

任务：识别两队所有玩家的数据。
- 截图主人所在的队伍标为 myTeam: true。通常在上方或左侧、名字高亮；实在看不出就把排在前面的队伍当作我方
- 看不清或截图里没有的数值填 null，不要猜
- 英雄名、玩家名按截图显示

只输出一个 JSON 对象，不要任何其他文字，格式：
{"isScoreboard": true 或 false（是不是英雄联盟单局结算数据）, "teams": [{"myTeam": true/false, "win": true/false/null, "players": [{"name": "玩家名", "champion": "英雄名", "kills": 数字, "deaths": 数字, "assists": 数字, "damage": 对英雄伤害或 null, "gold": 金币或 null, "cs": 补刀或 null}]}]}`;

const ROAST_SYSTEM = `你是英雄联盟“锐评官”，在开黑群里主持“战犯评选”。我方 5 人已经按表现分从高到低排好名次，你给每人一个称号和一句点评。

规则：
- 名次已经定好，不要改；第 1 名通常是 MVP，最后一名通常是战犯，但可以按数据起更有梗的称号（如“躺赢狗”“提款机”“孤勇者”）
- 用指定人设的口吻，好笑但不伤人，只针对游戏表现，不攻击现实中的人身、外貌、性别、地域等，不用脏话，不骂人是“猪”“废物”“垃圾”之类
- 每句点评引用这个人的具体数据，不超过 30 字；数字只能照抄给出的数据，不要自己算
- 称号 2-5 个字

只输出一个 JSON 对象，不要任何其他文字，格式：
{"headline": "一句话总结这局，不超过 25 字", "players": [{"rank": 名次, "label": "称号", "comment": "点评"}]}`;

export async function judgeScoreboard(dataUrl, tone) {
  const image = parseDataUrl(dataUrl);
  const r = await askAIJSON(VISION_SYSTEM, "识别这张结算截图。", "vision", image);
  if (!r) throw new ScreenshotError("识图服务暂时不可用，稍后再试");
  if (!r.isScoreboard) throw new ScreenshotError("这张图好像不是一局的结算数据，换一张试试");

  const teams = (Array.isArray(r.teams) ? r.teams : []).filter((t) => Array.isArray(t?.players));
  const mine = teams.find((t) => t.myTeam) ?? teams[0];
  const players = (mine?.players ?? [])
    .filter((p) => typeof p?.champion === "string" && [p.kills, p.deaths, p.assists].every(Number.isFinite))
    .slice(0, 5);
  if (players.length < 2) throw new ScreenshotError("没认出我方队员的数据，换一张更清晰的结算截图试试");

  const ranked = rank(players);
  const p = drawPersona(tone);
  const ai = await askAIJSON(
    ROAST_SYSTEM,
    `人设：${p.voice.name}（${p.voice.desc}）
语气：${TONES[p.tone]}

这局我方${mine.win === true ? "赢了" : mine.win === false ? "输了" : "胜负未知"}。排名：
${ranked.map(describe).join("\n")}`,
  );

  const comments = Array.isArray(ai?.players) ? ai.players : [];
  return {
    win: typeof mine.win === "boolean" ? mine.win : null,
    headline: String(ai?.headline ?? (mine.win ? "赢了，但不是所有人都配赢" : "输了，总得有人背锅")),
    players: ranked.map((pl) => {
      const c = comments.find((x) => Number(x?.rank) === pl.rank);
      return {
        ...pl,
        label: String(c?.label ?? defaultLabel(pl.rank, ranked.length)).slice(0, 8),
        comment: String(c?.comment ?? "").slice(0, 60),
      };
    }),
    persona: toPublicPersona(p),
    source: ai ? "ai" : "template",
  };
}

// 表现分：参团率、伤害占比、KDA 各占一部分，算好后直接排名，不让 AI 自己排
function rank(players) {
  const num = (v) => (Number.isFinite(v) ? v : null);
  const teamKills = Math.max(1, players.reduce((s, p) => s + p.kills, 0));
  const hasDamage = players.every((p) => Number.isFinite(p.damage));
  const teamDamage = hasDamage ? Math.max(1, players.reduce((s, p) => s + p.damage, 0)) : 1;

  return players
    .map((p) => {
      const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
      const kp = (p.kills + p.assists) / teamKills;
      const dmgShare = hasDamage ? p.damage / teamDamage : null;
      const score = Math.min(kda, 10) * 6 + kp * 30 + (dmgShare ?? kp * 0.6) * 40 - p.deaths * 1.5;
      return {
        name: String(p.name ?? "").slice(0, 20),
        champion: p.champion.slice(0, 12),
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        kda: +kda.toFixed(2),
        killParticipation: Math.round(kp * 100),
        damageShare: dmgShare === null ? null : Math.round(dmgShare * 100),
        damage: num(p.damage),
        gold: num(p.gold),
        cs: num(p.cs),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...p }, i) => ({ ...p, rank: i + 1 }));
}

function describe(p) {
  return (
    `第${p.rank}名：${p.name || "无名氏"}（${p.champion}）${p.kills}/${p.deaths}/${p.assists}，KDA ${p.kda}，参团率 ${p.killParticipation}%` +
    (p.damageShare !== null ? `，伤害占比 ${p.damageShare}%` : "") +
    (p.gold !== null ? `，金币 ${p.gold}` : "") +
    (p.cs !== null ? `，补刀 ${p.cs}` : "")
  );
}

function defaultLabel(rank, total) {
  if (rank === 1) return "MVP";
  if (rank === total) return "战犯";
  return "群众演员";
}
