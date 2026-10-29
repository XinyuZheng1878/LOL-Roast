// 单场赛后分析报告：数据对比 + 亮点、问题、改进建议。
import { askAIJSON } from "./ai.js";

// 各位置的参考线（大致是钻石段位水平），用来判断哪项拖了后腿
const BENCHMARKS = {
  上单: { csPerMin: 7, visionPerMin: 0.7, killParticipation: 45, damageShare: 20 },
  打野: { csPerMin: 6, visionPerMin: 1.0, killParticipation: 60, damageShare: 18 },
  中单: { csPerMin: 7.5, visionPerMin: 0.7, killParticipation: 50, damageShare: 25 },
  ADC: { csPerMin: 8, visionPerMin: 0.6, killParticipation: 50, damageShare: 27 },
  辅助: { csPerMin: 1.5, visionPerMin: 2.0, killParticipation: 60, damageShare: 10 },
};
const DEFAULT_BENCHMARK = { csPerMin: 6.5, visionPerMin: 0.8, killParticipation: 50, damageShare: 20 };

const SYSTEM = `你是一位专业的英雄联盟教练，根据一场对局的数据写赛后分析报告。

要求：
- 结合位置和英雄特点来分析，比如辅助补刀低是正常的，坦克伤害低不一定是问题
- 和对位玩家、位置参考线对比，指出最关键的差距，别面面俱到
- 每条结论都要引用给出的具体数字
- 严禁编造数据里没有的信息：没有技能命中率、团战过程、插眼位置、击杀时间、录像等数据，就不要提；推测原因时要说“可能”
- 建议要具体可执行（比如“每波回城前插一个真眼”），不要“多练习”这种空话
- 语气专业、直接，可以带一点幽默，但不要嘲讽
- 中文

只输出一个 JSON 对象，不要任何其他文字，格式：
{"grade": "S/A/B/C/D 之一", "headline": "一句话总结本局，不超过 25 字", "highlights": ["做得好的地方，1-3 条"], "problems": [{"title": "问题，不超过 12 字", "detail": "具体分析，不超过 60 字"}]（1-3 条）, "suggestions": ["下一局就能用的建议，2-3 条，每条不超过 40 字"]}`;

export async function generateReport(game) {
  const metrics = buildMetrics(game);
  const r = await askAIJSON(
    SYSTEM,
    `本局数据：${JSON.stringify(game)}
与对位/参考线对比：${JSON.stringify(metrics)}`,
    "accurate",
  );
  const analysis =
    r?.grade && Array.isArray(r.problems)
      ? {
          grade: String(r.grade).slice(0, 1),
          headline: String(r.headline ?? ""),
          highlights: (r.highlights ?? []).slice(0, 3).map(String),
          problems: r.problems.slice(0, 3).map((p) => ({ title: String(p.title), detail: String(p.detail) })),
          suggestions: (r.suggestions ?? []).slice(0, 3).map(String),
          source: "ai",
        }
      : { ...templateReport(game, metrics), source: "template" };
  return { game, metrics, analysis };
}

// 自己 vs 对位 vs 参考线，前端画对比条也用这份数据
function buildMetrics(g) {
  const bench = BENCHMARKS[g.position] ?? DEFAULT_BENCHMARK;
  const o = g.opponent;
  const m = (key, label, opts = {}) => ({
    key,
    label,
    me: g[key],
    opponent: o?.[key] ?? null,
    benchmark: opts.benchmark ?? null,
    lowerIsBetter: Boolean(opts.lowerIsBetter),
  });
  return [
    m("csPerMin", "分均补刀", { benchmark: bench.csPerMin }),
    m("goldPerMin", "分均经济"),
    m("damagePerMin", "分均伤害"),
    m("visionPerMin", "分均视野", { benchmark: bench.visionPerMin }),
    m("deaths", "阵亡次数", { benchmark: 5, lowerIsBetter: true }),
    m("killParticipation", "参团率 %", { benchmark: bench.killParticipation }),
    m("damageShare", "伤害占比 %", { benchmark: bench.damageShare }),
    m("buildingDamage", "推塔伤害"),
  ];
}

// 不调用 AI 时按规则生成报告
function templateReport(g, metrics) {
  const highlights = [];
  const problems = [];
  const suggestions = [];
  const get = (key) => metrics.find((x) => x.key === key);
  const ratio = (x) => (x.benchmark ? x.me / x.benchmark : 1);

  const cs = get("csPerMin");
  if (g.position !== "辅助") {
    if (ratio(cs) < 0.8) {
      problems.push({
        title: "补刀偏低",
        detail: `分均补刀 ${cs.me}，${g.position}参考线是 ${cs.benchmark}，一局下来少了大约 ${Math.round((cs.benchmark - cs.me) * g.minutes)} 个兵的经济`,
      });
      suggestions.push("对线期优先补刀，打完一波团立刻去吃最近的兵线");
    } else if (ratio(cs) >= 1) {
      highlights.push(`分均补刀 ${cs.me}，达到了${g.position}的参考线`);
    }
  }

  if (g.deaths >= 7) {
    problems.push({
      title: "阵亡太多",
      detail: `本局阵亡 ${g.deaths} 次，累计黑屏约 ${Math.round(g.timeDeadSec / 60)} 分钟，这段时间里对面在拿资源`,
    });
    suggestions.push("看不到对面打野时，别压过河道；残血先回城");
  } else if (g.deaths <= 3) {
    highlights.push(`只阵亡 ${g.deaths} 次，生存做得不错`);
  }

  const vision = get("visionPerMin");
  if (ratio(vision) < 0.7) {
    problems.push({
      title: "视野不足",
      detail: `分均视野 ${vision.me}，参考线 ${vision.benchmark}；本局只买了 ${g.controlWards} 个真眼`,
    });
    suggestions.push("每次回城都买一个真眼，插在河道或龙坑附近");
  }

  const kp = get("killParticipation");
  if (ratio(kp) < 0.75) {
    problems.push({ title: "参团率低", detail: `参团率 ${kp.me}%，参考线 ${kp.benchmark}%，团战时你可能不在场` });
    suggestions.push("小龙、峡谷先锋刷新前 30 秒往那边靠");
  } else if (ratio(kp) >= 1.1) {
    highlights.push(`参团率 ${kp.me}%，团队意识在线`);
  }

  if (g.opponent && g.goldPerMin > g.opponent.goldPerMin * 1.1) {
    highlights.push(`分均经济 ${g.goldPerMin}，比对位 ${g.opponent.champion} 多 ${g.goldPerMin - g.opponent.goldPerMin}，对线打出了优势`);
  } else if (g.opponent && g.goldPerMin < g.opponent.goldPerMin * 0.9) {
    problems.push({
      title: "对线被压",
      detail: `分均经济 ${g.goldPerMin}，比对位 ${g.opponent.champion} 少 ${g.opponent.goldPerMin - g.goldPerMin}`,
    });
  }

  if (highlights.length === 0) highlights.push(g.win ? "赢下了比赛，结果最重要" : "坚持打完了这局，心态值得肯定");
  if (suggestions.length === 0) suggestions.push("保持现在的节奏，可以试试多关注地图上的资源刷新");

  const kda = (g.kills + g.assists) / Math.max(1, g.deaths);
  const points = (g.win ? 2 : 0) + (kda >= 4 ? 2 : kda >= 2.5 ? 1 : 0) - problems.length + highlights.length;
  const grade = points >= 5 ? "S" : points >= 3 ? "A" : points >= 1 ? "B" : points >= -1 ? "C" : "D";

  return {
    grade,
    headline: `${g.win ? "胜利" : "失败"} · ${g.champion} ${g.kills}/${g.deaths}/${g.assists}${problems[0] ? `，主要问题：${problems[0].title}` : ""}`,
    highlights: highlights.slice(0, 3),
    problems: problems.slice(0, 3),
    suggestions: suggestions.slice(0, 3),
  };
}
