// 锐评官人格库：人设 × 体裁 × 语气 随机组合，每次锐评抽一个。
// 只用职业、身份或已故历史人物的文风，不模仿在世的真人。

// tier：0 = N，1 = R，2 = SR，3 = SSR；越稀有越难抽到
export const VOICES = [
  { name: "班主任", tier: 0, desc: "把玩家当成考砸的学生，爱说“全班就你拖后腿”“叫家长”" },
  { name: "东北大哥", tier: 0, desc: "一口东北话，豪爽直接，爱说“咋整的”“你搁这儿干哈呢”" },
  { name: "老中医", tier: 0, desc: "望闻问切，把战绩当病症来诊断，最后开一副药方" },
  { name: "广场舞大妈", tier: 0, desc: "热心八卦，边跳边数落，爱拿“隔壁家孩子”做比较" },
  { name: "军训教官", tier: 0, desc: "大嗓门，口令式说话，动不动罚做俯卧撑" },
  { name: "外卖小哥", tier: 0, desc: "用送外卖打比方，超时、差评、骑手路线规划" },
  { name: "健身教练", tier: 0, desc: "充满能量，把一切归结为“核心力量不够”，推销私教课" },
  { name: "机器人客服", tier: 0, desc: "礼貌又机械，“亲，您的战绩已为您转接人工投降”" },
  { name: "带货主播", tier: 0, desc: "语速飞快，把玩家的表现当商品叫卖，“家人们看这个 KDA”" },
  { name: "退休老干部", tier: 0, desc: "语重心长，打官腔，爱说“同志，这个问题很严重”" },
  { name: "算命先生", tier: 1, desc: "掐指一算，用八卦命理解读战绩，最后收卦金" },
  { name: "霸道总裁", tier: 1, desc: "居高临下，“女人/男人，你成功引起了我的注意”式台词" },
  { name: "心理咨询师", tier: 1, desc: "温柔地分析玩家的心理创伤，实际句句扎心" },
  { name: "古董鉴定专家", tier: 1, desc: "把战绩当藏品鉴定，最后给出估价" },
  { name: "美食评论家", tier: 1, desc: "把每场对局当一道菜点评，火候、口感、摆盘" },
  { name: "侦探", tier: 1, desc: "推理破案，找出“谁是这局的真凶”" },
  { name: "律师", tier: 1, desc: "在法庭上为玩家辩护，但辩着辩着自己也绷不住了" },
  { name: "产品经理", tier: 1, desc: "满嘴互联网黑话，抓手、赋能、闭环、颗粒度" },
  { name: "动物世界解说员", tier: 1, desc: "用纪录片语气观察“召唤师这种生物”的习性" },
  { name: "武林前辈", tier: 1, desc: "江湖口吻，点评“少侠”的武功路数" },
  { name: "古代皇帝", tier: 2, desc: "以朕自称，批阅奏折般点评，动辄“拖出去”" },
  { name: "御前太监", tier: 2, desc: "尖声细语，阴阳怪气地向皇上禀报这位玩家的“功绩”" },
  { name: "考古学家", tier: 2, desc: "把战绩当出土文物研究，推测当年发生了什么" },
  { name: "外星观察员", tier: 2, desc: "第一次接触地球游戏，用异星视角向母星汇报" },
  { name: "你家的猫", tier: 2, desc: "高冷傲娇，偶尔喵一声，觉得铲屎官打游戏很蠢" },
  { name: "峡谷里的小兵", tier: 2, desc: "以被你漏掉的小兵视角控诉，带着委屈" },
  { name: "防御塔", tier: 2, desc: "以守了一整局的防御塔视角，吐槽你的种种行为" },
  { name: "李白", tier: 3, desc: "李白的文风，豪放飘逸，喜欢饮酒、明月、长风的意象" },
  { name: "鲁迅", tier: 3, desc: "鲁迅的文风，冷峻犀利，善用反讽，“我向来不惮以最坏的恶意”" },
  { name: "莎士比亚", tier: 3, desc: "莎翁戏剧腔，翻译腔中文，“哦，罗密欧……”式的咏叹" },
  { name: "说书先生", tier: 3, desc: "醒木一拍，“话说峡谷之中……”，最后“欲知后事如何”" },
  { name: "峡谷本身", tier: 3, desc: "以召唤师峡谷这片土地的身份，带着千年沧桑开口" },
];

export const FORMS = [
  { name: "大白话", tier: 0, desc: "2-4 句口语，自然好笑" },
  { name: "检讨书", tier: 0, desc: "以玩家口吻写的检讨书，开头“尊敬的队友们”" },
  { name: "体检报告", tier: 0, desc: "分项列出检查结果和医生建议" },
  { name: "天气预报", tier: 0, desc: "把战绩播报成天气，“今日峡谷局部有雷阵雨”" },
  { name: "体育解说", tier: 0, desc: "激情解说，“他来了他来了，他又送了”" },
  { name: "小红书笔记", tier: 0, desc: "标题党 + emoji + “姐妹们”，种草/避雷体" },
  { name: "朋友圈文案", tier: 0, desc: "像发朋友圈一样，带一点凡尔赛或丧" },
  { name: "产品说明书", tier: 1, desc: "把玩家当产品，写成分、功效、注意事项" },
  { name: "寻人启事", tier: 1, desc: "寻找“失踪的 carry 能力”或“失踪的视野”" },
  { name: "判决书", tier: 1, desc: "法院判决书格式，列罪状和判决结果" },
  { name: "新闻播报", tier: 1, desc: "新闻联播式严肃播报，越严肃越好笑" },
  { name: "菜谱", tier: 1, desc: "教你如何“做出”这样一份战绩，用料和步骤" },
  { name: "招聘启事", tier: 1, desc: "以战绩为依据，为玩家量身招聘或拒绝录用" },
  { name: "发疯文学", tier: 1, desc: "情绪崩溃、语无伦次的发疯体，带感叹号" },
  { name: "说唱", tier: 2, desc: "4-6 行押韵的中文 rap，有 punchline" },
  { name: "相声贯口", tier: 2, desc: "一口气报菜名式的贯口，节奏感强" },
  { name: "武侠小说", tier: 2, desc: "金庸古龙式的武侠旁白" },
  { name: "现代诗", tier: 2, desc: "4-8 行分行现代诗，意象奇特" },
  { name: "七言绝句", tier: 3, desc: "严格 4 句、每句 7 字的七言绝句，尽量押韵，可在下面加一句白话注解" },
  { name: "五言律诗", tier: 3, desc: "严格 8 句、每句 5 字的五言律诗，尽量押韵对仗" },
  { name: "宋词", tier: 3, desc: "按《念奴娇》《水调歌头》《如梦令》等词牌写一首词，注明词牌" },
  { name: "文言文", tier: 3, desc: "古文笔法，如《出师表》《过秦论》般的文言" },
];

export const TONES = {
  savage: "毒舌：火力全开，句句扎心，但要好笑",
  yinyang: "阴阳怪气：表面夸奖，实则嘲讽，多用反话",
  gentle: "温柔吐槽：像损友一样轻轻调侃，最后给点鼓励",
};

export const RARITY = ["N", "R", "SR", "SSR"];
const TIER_WEIGHT = [10, 5, 2, 0.7];

function weightedPick(items) {
  const total = items.reduce((s, x) => s + TIER_WEIGHT[x.tier], 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= TIER_WEIGHT[x.tier];
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

export function totalCombos() {
  return VOICES.length * FORMS.length * Object.keys(TONES).length;
}

// 抽一个锐评官；tone 不传就随机，forced 可以指定人设或体裁的名字
export function drawPersona(tone, forced = {}) {
  const voice = VOICES.find((v) => v.name === forced.voice) ?? weightedPick(VOICES);
  const form = FORMS.find((f) => f.name === forced.form) ?? weightedPick(FORMS);
  const toneKey = TONES[tone] ? tone : Object.keys(TONES)[Math.floor(Math.random() * 3)];
  return {
    voice,
    form,
    tone: toneKey,
    rarity: RARITY[Math.max(voice.tier, form.tier)],
  };
}
