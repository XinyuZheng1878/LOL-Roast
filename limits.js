// 防刷：每个 IP 限制请求频率，全站限制每天的 AI 调用次数，避免 API key 被刷爆。
// 数据存在内存里，重启服务会清零，对小规模试用足够了。

const PER_IP_LIMIT = Number(process.env.PER_IP_LIMIT ?? 20); // 每个 IP 每小时最多几次
const DAILY_AI_LIMIT = Number(process.env.DAILY_AI_LIMIT ?? 1000); // 全站每天最多几次 AI 调用
const WINDOW_MS = 60 * 60 * 1000;

const hits = new Map(); // ip -> 时间戳数组
let day = today();
let aiCallsToday = 0;

function today() {
  return new Date().toISOString().slice(0, 10);
}

// cost：这个接口大约会调用几次 AI（截图锐评 = 识图 + 锐评 = 2）
export function limit(cost = 1) {
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= PER_IP_LIMIT) {
      return res.status(429).json({ error: "锐评官累了，休息一会儿再来（每小时次数已用完）" });
    }

    if (day !== today()) {
      day = today();
      aiCallsToday = 0;
    }
    if (aiCallsToday + cost > DAILY_AI_LIMIT) {
      return res.status(429).json({ error: "今天的锐评名额用完了，明天再来吧" });
    }

    recent.push(now);
    hits.set(req.ip, recent);
    aiCallsToday += cost;
    next();
  };
}

// 定期清理不活跃的 IP，防止内存一直涨
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(ip);
  }
}, WINDOW_MS).unref();
