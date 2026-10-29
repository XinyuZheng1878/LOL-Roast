// 每次随机抽一个锐评官人格，用 AI 生成锐评；AI 不可用时退回到模板锐评。
import { askAIJSON } from "./ai.js";
import { drawPersona, totalCombos, TONES } from "./personas.js";

export { TONES as STYLES } from "./personas.js";

const SYSTEM = `你是一个英雄联盟“锐评官”，根据玩家最近的战绩写好笑的锐评，让人看了想截图发群里。
每次你会被指定一个人设、一种体裁和一种语气，必须完全进入这个角色，用这种体裁来写。

规则：
- 只吐槽游戏表现（英雄选择、KDA、补刀、视野、胜率等），不攻击现实中的人身、外貌、性别、地域等
- 不用脏话和歧视性词汇；可以用 LOL 圈常见梗（如“峡谷之巅”“演员”“提款机”“孤儿”等）
- 至少引用 2 个具体数据，别说空话；场次、胜负数、英雄使用次数只能照抄【统计结果】，不要自己数；提到某一局时说“第几场”，不要出现英文字段名、变量名或编号
- 中文，正文 3-5 行，每行不超过 30 字，总共不超过 120 字，适合放在手机分享卡片上
- 诗词类体裁要守格式（字数、句数），押韵尽量做到；诗词可以额外加一行白话注解

只输出一个 JSON 对象，不要任何其他文字，格式：
{"title": "一个 4-8 字的称号，符合人设口吻，比如‘峡谷提款机’", "score": 0-100 的整数（综合实力评分，可以很低）, "lines": ["正文按行拆开，诗词一句一行，散文一句一行"], "tags": ["标签1", "标签2", "标签3"]（每个 2-6 字）, "advice": "一句真正有用的上分建议，可以带人设口吻，不超过 30 字"}`;

export async function generateRoast(data, summary, tone, forced) {
  const p = drawPersona(tone, forced);
  const persona = {
    voice: p.voice.name,
    form: p.form.name,
    tone: p.tone,
    rarity: p.rarity,
    totalCombos: totalCombos(),
  };
  const r = await askAIJSON(
    SYSTEM,
    `人设：${p.voice.name}（${p.voice.desc}）
体裁：${p.form.name}（${p.form.desc}）
语气：${TONES[p.tone]}

玩家：${data.player}（${data.server}）
${describeStats(summary, data.games)}`,
  );
  if (r?.title && Array.isArray(r.lines)) {
    return {
      title: String(r.title),
      score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
      lines: r.lines.slice(0, 9).map(String),
      tags: (r.tags ?? []).slice(0, 3).map(String),
      advice: String(r.advice ?? ""),
      persona,
      source: "ai",
    };
  }
  return { ...templateRoast(summary), persona, source: "template" };
}

// 把数据写成中文给 AI 看，避免它把英文字段名照抄进锐评
function describeStats(s, games) {
  const champs = s.champions
    .map((c) => `${c.name} ${c.games} 场（${c.wins} 胜 ${c.losses} 负，KDA ${c.kda}）`)
    .join("；");
  const lines = games.map(
    (g, i) =>
      [
        `第${i + 1}场：${g.champion}（${g.position}，${g.queue}）${g.win ? "胜" : "负"}，${g.kills}/${g.deaths}/${g.assists}`,
        // 截图识别的数据可能缺字段，没有的就不写
        Number.isFinite(g.minutes) && `${g.minutes} 分钟`,
        Number.isFinite(g.csPerMin) && `分均补刀 ${g.csPerMin}`,
        Number.isFinite(g.visionScore) && `视野得分 ${g.visionScore}`,
        Number.isFinite(g.killParticipation) && `参团率 ${g.killParticipation}%`,
        Number.isFinite(g.damageShare) && `伤害占比 ${g.damageShare}%`,
        Number.isFinite(g.damage) && `对英雄伤害 ${g.damage}`,
        g.pentaKills > 0 && "拿到五杀",
        g.firstBlood && "拿了一血",
      ]
        .filter(Boolean)
        .join("，"),
  );
  return `【统计结果，场次和胜负一律以这里为准，不要自己数明细】
最近 ${s.games} 场：${s.wins} 胜 ${s.losses} 负，胜率 ${s.winRate}%，KDA ${s.kda}，场均 ${s.avgKills}/${s.avgDeaths}/${s.avgAssists}，` +
    (s.avgCsPerMin !== null ? `分均补刀 ${s.avgCsPerMin}，` : "") +
    (s.avgVision !== null ? `场均视野得分 ${s.avgVision}，` : "") +
    `当前${s.streak.count}${s.streak.type}
各英雄战绩：${champs}

每场明细（第1场是最近一场）：
${lines.join("\n")}`;
}

// 不调用 AI 的保底锐评，按数据套模板
function templateRoast(s) {
  const lines = [];
  const tags = [];
  const main = s.topChampions[0];

  if (s.winRate < 45) {
    lines.push(`最近 ${s.games} 场胜率 ${s.winRate}%，队友看到你的名字已经开始默默点投降了`);
    tags.push("投降发起人");
  } else if (s.winRate >= 60) {
    lines.push(`胜率 ${s.winRate}%，打得不错，就是不知道是你 carry 还是队友带飞`);
    tags.push("疑似被带");
  } else {
    lines.push(`胜率 ${s.winRate}%，主打一个不上不下，段位的忠实守护者`);
    tags.push("段位守门员");
  }

  if (s.avgDeaths >= 7) {
    lines.push(`场均阵亡 ${s.avgDeaths} 次，对面的经济有一半是你赞助的`);
    tags.push("峡谷提款机");
  } else {
    lines.push(`KDA ${s.kda}，活是活下来了，就是不知道活着干了什么`);
    tags.push("惜命");
  }

  if (s.avgCsPerMin !== null && s.avgCsPerMin < 5.5) {
    lines.push(`分均补刀 ${s.avgCsPerMin}，兵线：你是来峡谷观光的吗`);
    tags.push("兵线绝缘体");
  } else if (main) {
    lines.push(`${main.name} 玩了 ${main.times} 场，绝活哥的执着令人动容`);
    tags.push("绝活哥");
  }

  return {
    title: s.avgDeaths >= 7 ? "峡谷提款机" : s.winRate < 45 ? "段位守门员" : "平平无奇召唤师",
    score: Math.max(5, Math.min(95, Math.round(s.winRate * 0.6 + s.kda * 8))),
    lines,
    tags,
    advice: s.avgVision !== null && s.avgVision < 15 ? "多买真眼，视野得分先翻一倍再说" : "少打团前的单走，跟队友一起行动",
  };
}
