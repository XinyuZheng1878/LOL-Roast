// 从战绩截图里识别对局数据，转成和 Riot API 一样的格式，后面的锐评逻辑不用改。
import { askAIJSON } from "./ai.js";

const SYSTEM = `你是英雄联盟战绩截图识别助手。用户会上传一张截图，可能是：
- 战绩列表页（掌上英雄联盟、WeGame、客户端生涯页等，列出最近多场对局）
- 单局结算页（一局 10 个玩家的数据）

任务：识别出截图主人的对局数据。
- 战绩列表页：每一行是一场，全部识别出来，最多 20 场
- 单局结算页：只识别截图主人那一行（通常高亮显示或位于自己队伍中带标记的位置）；无法判断是谁时，选第一行并把 uncertain 设为 true
- 看不清或截图里没有的数值填 null，不要猜
- 英雄名用截图里显示的名字（中文就用中文）

只输出一个 JSON 对象，不要任何其他文字，格式：
{"isLolStats": true 或 false（截图是不是英雄联盟战绩）, "player": "玩家名，看不到就填空字符串", "uncertain": false, "games": [{"champion": "英雄名", "win": true/false, "kills": 数字, "deaths": 数字, "assists": 数字, "mode": "排位/匹配/大乱斗等，看不到填 null", "minutes": 对局分钟数或 null, "cs": 补刀数或 null, "damage": 对英雄伤害或 null}]}`;

export class ScreenshotError extends Error {}

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

// dataUrl：前端传来的 "data:image/jpeg;base64,..." 字符串
export async function readScreenshot(dataUrl) {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(dataUrl));
  if (!match || !MEDIA_TYPES.includes(match[1])) throw new ScreenshotError("只支持 JPG、PNG、WebP 格式的图片");

  const r = await askAIJSON(SYSTEM, "识别这张截图里的战绩。", "vision", { mediaType: match[1], base64: match[2] });
  if (!r) throw new ScreenshotError("识图服务暂时不可用，稍后再试");
  if (!r.isLolStats) throw new ScreenshotError("这张图好像不是英雄联盟的战绩截图，换一张试试");

  const games = (Array.isArray(r.games) ? r.games : [])
    .filter((g) => g && typeof g.champion === "string" && [g.kills, g.deaths, g.assists].every(Number.isFinite))
    .slice(0, 20)
    .map(toGame);
  if (games.length === 0) throw new ScreenshotError("没认出战绩数据，换一张更清晰的截图试试");

  return {
    player: String(r.player || "神秘召唤师").slice(0, 30),
    server: "截图识别",
    games,
    uncertain: Boolean(r.uncertain),
  };
}

const num = (v) => (Number.isFinite(v) ? v : null);

function toGame(g) {
  const minutes = num(g.minutes);
  const cs = num(g.cs);
  return {
    champion: g.champion.slice(0, 20),
    queue: typeof g.mode === "string" ? g.mode.slice(0, 10) : "未知模式",
    position: "未知位置",
    win: Boolean(g.win),
    kills: g.kills,
    deaths: g.deaths,
    assists: g.assists,
    minutes,
    csPerMin: minutes && cs !== null ? +(cs / minutes).toFixed(1) : null,
    damage: num(g.damage),
    killParticipation: null,
    damageShare: null,
    visionScore: null,
    pentaKills: 0,
    firstBlood: false,
  };
}
