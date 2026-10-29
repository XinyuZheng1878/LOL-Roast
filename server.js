import express from "express";
import { fetchRecentMatches, summarize, SERVERS, RiotError } from "./riot.js";
import { demoMatches } from "./demo.js";
import { generateRoast, replyToUser, STYLES } from "./roast.js";
import { judgeScoreboard } from "./blame.js";
import { catalog } from "./personas.js";
import { generateReport } from "./report.js";
import { limit } from "./limits.js";
import { readScreenshot, ScreenshotError } from "./screenshot.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// 部署时前面有 nginx，按它转发的 X-Forwarded-For 识别真实 IP
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "8mb" }));
app.use(express.static("public"));
// 截图用的 html2canvas 从本地提供，国内访问外部 CDN 不稳定
app.use("/vendor", express.static("node_modules/html2canvas/dist"));

app.get("/api/config", (req, res) => {
  res.json({
    servers: Object.entries(SERVERS).map(([id, s]) => ({ id, label: s.label })),
    styles: Object.keys(STYLES),
    riotEnabled: Boolean(RIOT_API_KEY),
  });
});

app.get("/api/catalog", (req, res) => res.json(catalog()));

app.post("/api/roast", limit(1), async (req, res) => {
  const { riotId = "", server = "kr", style = "savage", demo = false, games, player, source } = req.body ?? {};
  const [gameName, tagLine] = String(riotId).split("#").map((s) => s.trim());

  try {
    let data;
    if (Array.isArray(games) && games.length > 0) {
      // 换个锐评官时，前端把上次的对局数据传回来，不用重新查询或识图
      data = { player: String(player ?? "神秘召唤师").slice(0, 30), server: String(source ?? "").slice(0, 20), games: cleanGames(games) };
    } else if (demo || !RIOT_API_KEY) {
      data = demoMatches(gameName || undefined, tagLine || undefined);
    } else {
      if (!gameName || !tagLine) {
        return res.status(400).json({ error: "请按“名字#标签”的格式输入，比如 Faker#KR1" });
      }
      data = await fetchRecentMatches({ gameName, tagLine, server, apiKey: RIOT_API_KEY });
    }

    const summary = summarize(data.games);
    const roast = await generateRoast(data, summary, style);
    res.json({ player: data.player, server: data.server, summary, roast, games: data.games });
  } catch (error) {
    if (error instanceof RiotError) {
      return res.status(error.status >= 500 ? 502 : error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: "服务器出错了，稍后再试" });
  }
});

// 上传战绩截图：先识图拿到数据，再照常锐评（识图 + 锐评 = 2 次 AI 调用）
app.post("/api/roast-image", limit(2), async (req, res) => {
  const { image, style = "random" } = req.body ?? {};
  try {
    const data = await readScreenshot(image);
    const summary = summarize(data.games);
    const roast = await generateRoast(data, summary, style);
    res.json({ player: data.player, server: data.server, summary, roast, games: data.games, fromScreenshot: true });
  } catch (error) {
    if (error instanceof ScreenshotError) return res.status(400).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "服务器出错了，稍后再试" });
  }
});

// 前端把要分析的那一场对局传回来；只保留已知字段，避免把任意内容塞给 AI
const NUMBER_FIELDS = [
  "kills", "deaths", "assists", "csPerMin", "goldPerMin", "damagePerMin", "damageTakenPerMin",
  "visionPerMin", "wardsPlaced", "wardsKilled", "controlWards", "buildingDamage", "timeDeadSec",
  "largestMultiKill", "minutes", "killParticipation", "damageShare", "visionScore", "pentaKills", "damage",
];
const TEXT_FIELDS = ["champion", "queue", "position"];

function cleanStats(src) {
  const out = {};
  for (const k of NUMBER_FIELDS) if (Number.isFinite(src?.[k])) out[k] = src[k];
  for (const k of TEXT_FIELDS) if (typeof src?.[k] === "string") out[k] = src[k].slice(0, 30);
  return out;
}

function cleanGames(games) {
  return games.slice(0, 20).map((g) => ({
    ...cleanStats(g),
    win: Boolean(g.win),
    pentaKills: Number.isFinite(g.pentaKills) ? g.pentaKills : 0,
    firstBlood: Boolean(g.firstBlood),
    ...(Number.isFinite(g.playedAt) ? { playedAt: g.playedAt } : {}),
    ...(g.opponent ? { opponent: { ...cleanStats(g.opponent), champion: String(g.opponent.champion ?? "").slice(0, 20) } } : {}),
  }));
}

// 开黑群战犯评选：上传一局结算截图（识图 + 点评 = 2 次 AI 调用）
app.post("/api/blame", limit(2), async (req, res) => {
  const { image, style = "random" } = req.body ?? {};
  try {
    res.json(await judgeScoreboard(image, style));
  } catch (error) {
    if (error instanceof ScreenshotError) return res.status(400).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: "服务器出错了，稍后再试" });
  }
});

// 和锐评官对线：前端带上战绩、锐评官、原锐评和之前的对话
app.post("/api/reply", limit(1), async (req, res) => {
  const { games, persona, card, history = [], message } = req.body ?? {};
  const text = String(message ?? "").trim().slice(0, 100);
  if (!text) return res.status(400).json({ error: "说点什么再回嘴" });
  if (!Array.isArray(games) || games.length === 0 || !persona?.voice || !Array.isArray(card?.lines)) {
    return res.status(400).json({ error: "先让锐评官锐评一次" });
  }
  try {
    const data = { games: cleanGames(games) };
    const names = { voice: String(persona.voice), form: String(persona.form ?? ""), tone: String(persona.tone ?? "") };
    const lines = card.lines.slice(0, 9).map((l) => String(l).slice(0, 60));
    const past = (Array.isArray(history) ? history : []).slice(-6).map((h) => ({
      from: h?.from === "user" ? "user" : "roaster",
      text: String(h?.text ?? "").slice(0, 120),
    }));
    res.json(await replyToUser(data, summarize(data.games), names, { lines }, past, text));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "服务器出错了，稍后再试" });
  }
});

app.post("/api/report", limit(1), async (req, res) => {
  const raw = req.body?.game;
  if (!raw || typeof raw !== "object") return res.status(400).json({ error: "缺少对局数据" });
  const game = {
    ...cleanStats(raw),
    win: Boolean(raw.win),
    opponent: raw.opponent ? cleanStats(raw.opponent) : null,
  };
  try {
    res.json(await generateReport(game));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "生成报告失败，稍后再试" });
  }
});

app.listen(PORT, () => {
  console.log(`LOL 锐评已启动：http://localhost:${PORT}`);
  if (!RIOT_API_KEY) console.log("未设置 RIOT_API_KEY，当前只能用演示数据");
});
