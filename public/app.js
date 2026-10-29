const $ = (id) => document.getElementById(id);

// 建元素的小工具：el("div", "cls", "文字", [子元素...])
function el(tag, cls, text, children) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  if (children) e.append(...children.filter(Boolean));
  return e;
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "出错了，稍后再试");
  return data;
}

const TONES = [
  ["random", "🎲 随机"],
  ["savage", "🔥 毒舌"],
  ["yinyang", "🙂 阴阳怪气"],
  ["gentle", "🤗 温柔吐槽"],
];
const TONE_NAMES = { savage: "毒舌", yinyang: "阴阳怪气", gentle: "温柔吐槽" };
const GLOW = { N: "#9aa3b5", R: "#4ea1ff", SR: "#b77bff", SSR: "#f0c568" };

const state = {
  tone: { roast: "random", blame: "random" },
  image: { roast: null, blame: null },
  nameMode: false,
  last: null, // 上一次锐评结果
  chat: [],
  catalog: null,
};

/* ---------- 背景：缓缓上升的金色、青色光点 ---------- */
(function sparks() {
  const canvas = $("sparks");
  const ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, dots;
  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: Math.random() * 1.8 + 0.4,
    vy: Math.random() * 0.35 + 0.1,
    vx: (Math.random() - 0.5) * 0.15,
    phase: Math.random() * Math.PI * 2,
    gold: Math.random() < 0.7,
  });
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: Math.round((w * h) / 18000) }, () => spawn(true));
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      if (!still) {
        d.y -= d.vy;
        d.x += d.vx + Math.sin(t / 2000 + d.phase) * 0.1;
        if (d.y < -10) Object.assign(d, spawn(false));
      }
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(t / 900 + d.phase));
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.gold ? `rgba(240, 200, 110, ${twinkle})` : `rgba(10, 200, 185, ${twinkle * 0.8})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = d.gold ? "#f0c868" : "#0ac8b9";
      ctx.fill();
    }
    if (!still) requestAnimationFrame(draw);
  };
  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
})();

/* ---------- 标签页 ---------- */
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    for (const name of ["roast", "blame", "dex"]) $("tab-" + name).hidden = name !== t.dataset.tab;
    if (t.dataset.tab === "dex") renderDex();
  }),
);

/* ---------- 语气选择 ---------- */
document.querySelectorAll("[data-tones]").forEach((box) => {
  const key = box.dataset.tones;
  for (const [value, label] of TONES) {
    const b = el("button", "tone" + (value === state.tone[key] ? " on" : ""), label);
    b.type = "button";
    b.addEventListener("click", () => {
      state.tone[key] = value;
      box.querySelectorAll(".tone").forEach((x) => x.classList.toggle("on", x === b));
    });
    box.append(b);
  }
});

/* ---------- 上传截图：压缩到最长边 1600px ---------- */
document.querySelectorAll("[data-drop]").forEach((drop) => {
  const key = drop.dataset.drop;
  const input = drop.querySelector("input");
  const img = drop.querySelector("img");
  const hint = drop.querySelector(".drop-hint");
  const load = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const raw = new Image();
    raw.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(raw.width, raw.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(raw.width * scale);
      canvas.height = Math.round(raw.height * scale);
      canvas.getContext("2d").drawImage(raw, 0, 0, canvas.width, canvas.height);
      state.image[key] = canvas.toDataURL("image/jpeg", 0.85);
      img.src = state.image[key];
      img.hidden = false;
      hint.hidden = true;
      URL.revokeObjectURL(raw.src);
    };
    raw.src = URL.createObjectURL(file);
  };
  input.addEventListener("change", () => load(input.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); load(e.dataTransfer.files[0]); });
});

$("toNameMode").addEventListener("click", () => { state.nameMode = true; $("roastImageMode").hidden = true; $("roastNameMode").hidden = false; });
$("toImageMode").addEventListener("click", () => { state.nameMode = false; $("roastImageMode").hidden = false; $("roastNameMode").hidden = true; });

fetch("/api/config").then((r) => r.json()).then((cfg) => {
  $("server").replaceChildren(...cfg.servers.map((s) => Object.assign(el("option", null, s.label), { value: s.id })));
  $("demoNotice").hidden = cfg.riotEnabled;
});
fetch("/api/catalog").then((r) => r.json()).then((c) => { state.catalog = c; updateDexBadge(); });

/* ---------- 加载动画 ---------- */
let loadingTimer = null;
function showLoading(messages) {
  let i = 0;
  $("loadingText").textContent = messages[0];
  $("loading").hidden = false;
  loadingTimer = setInterval(() => { $("loadingText").textContent = messages[++i % messages.length]; }, 1800);
}
function hideLoading() {
  clearInterval(loadingTimer);
  $("loading").hidden = true;
}

/* ---------- 锐评 ---------- */
async function roast(reroll) {
  $("roastError").textContent = "";
  const tone = state.tone.roast;
  let request;
  if (reroll && state.last) {
    // 再抽一次：复用已识别的数据，不重新识图
    request = post("/api/roast", { games: state.last.games, player: state.last.player, source: state.last.server, style: tone })
      .then((d) => ({ ...d, fromScreenshot: state.last.fromScreenshot }));
  } else if (!state.nameMode) {
    if (!state.image.roast) return ($("roastError").textContent = "先选一张战绩截图");
    request = post("/api/roast-image", { image: state.image.roast, style: tone });
  } else {
    request = post("/api/roast", { riotId: $("riotId").value, server: $("server").value, style: tone });
  }

  showLoading(
    reroll
      ? ["正在召唤下一位锐评官…", "锐评官正在研墨…", "正在给你想称号…"]
      : ["正在识别你的战绩…", "正在召唤锐评官…", "锐评官正在翻你的黑历史…", "正在数你送了几个头…", "正在给你想称号…"],
  );
  try {
    const data = await request;
    state.last = data;
    state.chat = [];
    showRoast(data);
  } catch (e) {
    $("roastError").textContent = e.message;
  } finally {
    hideLoading();
  }
}
$("roastBtn").addEventListener("click", () => roast(false));
$("rerollBtn").addEventListener("click", () => roast(true));

function showRoast(data) {
  const isNew = collect(data.roast.persona);
  const card = buildCard(data, isNew);
  const rarity = data.roast.persona.rarity;

  const back = el("div", "card-back r-" + rarity, null, [el("div", "q", "?"), el("div", "tap", "点击翻开")]);
  back.style.setProperty("--glow", GLOW[rarity]);
  const flip = el("div", "flip", null, [back, card]);
  $("stage").replaceChildren(flip);

  const open = () => {
    if (flip.classList.contains("flipped")) return;
    flip.classList.add("flipped");
    setTimeout(() => flip.classList.add("done"), 850);
  };
  back.addEventListener("click", open);
  // 稀有度越高，悬念留得越久
  setTimeout(open, { N: 500, R: 700, SR: 1000, SSR: 1500 }[rarity]);

  $("roastResult").hidden = false;
  $("bubbles").replaceChildren();
  $("chatText").disabled = false;
  $("chatText").placeholder = "比如：我玩辅助的补刀低很正常好吧";
  renderMatches(data);
  setTimeout(() => $("stage").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

function buildCard(data, isNew) {
  const r = data.roast;
  const p = r.persona;
  const s = data.summary;

  const rarity = el("span", "rarity " + p.rarity, p.rarity);
  const head = el("div", "card-head", null, [
    el("div", "avatar", p.emoji || "🎙️"),
    el("div", "who", null, [
      el("div", "who-name", null, [document.createTextNode(p.voice), isNew && el("span", "new-tag", "NEW")]),
      el("div", "who-form", `${p.form} · ${TONE_NAMES[p.tone] || ""}`),
    ]),
    rarity,
  ]);

  const ring = el("div", "score-ring", null, [el("span", null, String(r.score))]);
  ring.style.setProperty("--s", r.score);
  const titleRow = el("div", "card-head", null, [
    el("div", "who", null, [el("div", "card-title", r.title), el("div", "card-sub", `${data.player} · ${data.server} · 最近 ${s.games} 场`)]),
    ring,
  ]);

  const chip = (v, label) => el("div", "chip", null, [el("b", null, v ?? "—"), el("small", null, label)]);
  const chips = el("div", "chips", null, [
    chip(s.winRate + "%", "胜率"),
    chip(s.kda, "KDA"),
    chip(s.avgDeaths, "场均阵亡"),
    chip(s.avgCsPerMin, "分均补刀"),
  ]);

  const card = el("div", "card r-" + p.rarity, null, [
    head,
    titleRow,
    chips,
    buildBody(r, p),
    r.tags.length && el("div", "tags", null, r.tags.map((t) => el("span", "tag", "#" + t))),
    r.advice && el("div", "advice", "💡 " + r.advice),
    el("div", "card-foot", null, [
      el("span", null, r.source === "ai" ? `共 ${p.totalCombos} 种锐评官，你抽到了这位` : "模板锐评（AI 未连接）"),
      el("span", null, "峡谷锐评官"),
    ]),
  ]);
  card.id = "card";
  return card;
}

/* ---------- 按体裁排版 ---------- */
function buildBody(r, p) {
  const lines = r.lines.filter((l) => l.trim());
  const ps = (arr) => arr.map((t) => el("p", null, t));
  const builders = { classical, official, sheet, broadcast, social, poster, verse };
  return (builders[p.layout] || plain)(lines, r, p, ps);
}

function plain(lines, r, p, ps) {
  return el("div", "body plain", null, ps(lines));
}

function verse(lines, r, p, ps) {
  return el("div", "body verse", null, ps(lines));
}

function classical(lines, r, p) {
  const isNote = (l) => /^(白话|注|译|【?注解|白话注解)/.test(l);
  const isHead = (l) => /^《.+》$/.test(l.trim());
  const notes = lines.filter(isNote);
  const head = lines.find(isHead);
  const verses = lines.filter((l) => !isNote(l) && !isHead(l));

  const seal = el("div", "seal", [...p.voice].slice(0, 4).join("\n"));
  seal.style.whiteSpace = "pre";
  const body = el("div", "body classical", null, [seal]);

  // 句子都不长才竖排，文言长句横排更好读
  if (verses.length && verses.every((l) => [...l].length <= 12)) {
    const col = (text, cls) => el("div", "col" + (cls ? " " + cls : ""), null, [...text].map((ch) => el("span", null, ch)));
    // 竖排时去掉句末标点，更像书法作品
    const cols = [head && col(head.replace(/[《》]/g, ""), "head"), ...verses.map((l) => col(l.replace(/[，。、！？；,.!?;\s]+$/, "")))];
    body.append(el("div", "vert", null, cols));
  } else {
    body.append(el("div", "prose", null, [head && el("p", null, head), ...verses.map((t) => el("p", null, t))]));
  }
  if (notes.length) body.append(el("div", "note", notes.join(" ")));
  return body;
}

function official(lines, r, p, ps) {
  const isVerdict = p.form === "判决书";
  const no = `（2026）峡锐字第 ${String(Math.floor(Math.random() * 9000) + 1000)} 号`;
  return el("div", "body official", null, [
    el("div", "doc-head", isVerdict ? "峡谷人民法院 判决书" : "检 讨 书"),
    isVerdict && el("div", "doc-no", no),
    ...ps(lines),
    el("div", "stamp", null, [el("span", null, isVerdict ? "峡谷法院" : "锐评专用")]),
  ]);
}

function sheet(lines, r, p) {
  const titles = { 体检报告: ["峡谷第一人民医院 · 体检报告", "门诊号 LOL-0001"], 产品说明书: ["产品说明书", "请仔细阅读"], 菜谱: ["今日菜谱", "难度 ★★★★★"] };
  const [t, sub] = titles[p.form] || [p.form, ""];
  const rows = lines.map((l) => {
    const m = /^【(.{1,8}?)】\s*(.*)$/.exec(l) || /^(.{1,6})[：:]\s*(.+)$/.exec(l);
    return m ? el("div", "r", null, [el("div", "k", m[1]), el("div", null, m[2])]) : el("div", "r full", l);
  });
  return el("div", "body sheet", null, [el("div", "sheet-head", null, [el("span", null, t), el("small", null, sub)]), el("div", "rows", null, rows)]);
}

function broadcast(lines, r, p, ps) {
  const titles = { 新闻播报: "峡谷新闻联播", 天气预报: "峡谷天气预报", 体育解说: "峡谷体育频道" };
  return el("div", "body broadcast", null, [
    el("div", "tv-head", null, [el("span", "live", "LIVE"), el("span", null, titles[p.form] || p.form)]),
    el("div", "tv-lines", null, ps(lines)),
    el("div", "ticker", "滚动快讯：" + [...r.tags, r.advice].filter(Boolean).join(" ｜ ")),
  ]);
}

function social(lines, r, p, ps) {
  const xhs = p.form === "小红书笔记";
  const likes = xhs ? `❤️ ${(Math.random() * 9 + 1).toFixed(1)}w` : `👍 ${Math.floor(Math.random() * 90 + 10)}`;
  return el("div", "body social" + (xhs ? " xhs" : ""), null, [
    el("div", "post-head", null, [
      el("div", "post-avatar", p.emoji),
      el("div", null, null, [el("div", "post-name", p.voice), el("div", "post-time", "刚刚 · 来自峡谷")]),
    ]),
    ...ps(lines),
    el("div", "post-foot", null, [el("span", null, likes), el("span", null, "💬 999+"), el("span", null, "↗ 转发")]),
  ]);
}

function poster(lines, r, p, ps) {
  return el("div", "body poster", null, [
    el("div", "poster-head", p.form === "招聘启事" ? "招 聘" : "寻 人 启 事"),
    ...ps(lines),
    el("div", "tear", null, [1, 2, 3, 4].map(() => el("span", null, `📞 ${p.voice}`))),
  ]);
}

/* ---------- 保存图片 ---------- */
async function saveImage(node, filename) {
  if (!node || !window.html2canvas) return;
  const canvas = await html2canvas(node, { backgroundColor: "#0b0f17", scale: 2 });
  const a = document.createElement("a");
  a.download = filename;
  a.href = canvas.toDataURL("image/png");
  a.click();
}
$("saveCard").addEventListener("click", () => {
  const flip = document.querySelector(".flip");
  flip?.classList.add("flipped", "done");
  saveImage($("card"), "峡谷锐评.png");
});
$("saveBlame").addEventListener("click", () => saveImage($("blameCard").firstElementChild, "战犯评选.png"));

/* ---------- 和锐评官对线 ---------- */
const MAX_ROUNDS = 5;
$("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("chatText").value.trim();
  if (!text || !state.last) return;
  const p = state.last.roast.persona;
  $("chatText").value = "";
  $("bubbles").append(el("div", "bubble user", text));
  const typing = el("div", "bubble roaster typing", `${p.emoji} ${p.voice}正在输入…`);
  $("bubbles").append(typing);
  $("chatText").disabled = true;
  try {
    const res = await post("/api/reply", {
      games: state.last.games,
      persona: { voice: p.voice, form: p.form, tone: p.tone },
      card: { lines: state.last.roast.lines },
      history: state.chat,
      message: text,
    });
    state.chat.push({ from: "user", text }, { from: "roaster", text: res.lines.join(" ") });
    typing.replaceWith(el("div", "bubble roaster", null, [el("div", "who-mini", `${p.emoji} ${p.voice}`), ...res.lines.map((l) => el("div", null, l))]));
  } catch (err) {
    typing.replaceWith(el("div", "bubble roaster", err.message));
  }
  if (state.chat.length / 2 >= MAX_ROUNDS) {
    $("chatText").placeholder = `${p.voice}说累了，再抽一位接着吵`;
  } else {
    $("chatText").disabled = false;
    $("chatText").focus();
  }
});

/* ---------- 图鉴（存在本机浏览器里） ---------- */
const DEX_KEY = "lolroast.dex.v1";
function loadDex() {
  try { return JSON.parse(localStorage.getItem(DEX_KEY)) || {}; } catch { return {}; }
}
function saveDex(dex) {
  try { localStorage.setItem(DEX_KEY, JSON.stringify(dex)); } catch {}
}
// 记录抽到的“人设 × 体裁”，返回是不是第一次抽到
function collect(p) {
  const dex = loadDex();
  const entry = (dex[p.voice] ??= { forms: [], first: Date.now() });
  const isNew = !entry.forms.includes(p.form);
  if (isNew) entry.forms.push(p.form);
  saveDex(dex);
  updateDexBadge();
  return isNew;
}
function updateDexBadge() {
  const n = Object.values(loadDex()).reduce((s, v) => s + v.forms.length, 0);
  $("dexBadge").textContent = n;
}

function renderDex() {
  const c = state.catalog;
  if (!c) return;
  const dex = loadDex();
  const total = c.voices.length * c.forms.length;
  const got = Object.values(dex).reduce((s, v) => s + v.forms.length, 0);
  const byRarity = ["N", "R", "SR", "SSR"].map((r) => {
    const all = c.voices.filter((v) => v.rarity === r);
    return el("div", null, null, [el("b", null, `${all.filter((v) => dex[v.name]).length}/${all.length}`), document.createTextNode(r + " 锐评官")]);
  });
  const bar = el("div", "dex-bar", null, [el("i")]);
  bar.firstChild.style.width = Math.max(1, (got / total) * 100) + "%";
  $("dexHead").replaceChildren(
    el("div", "dex-progress", null, [
      el("span", null, "已收集的锐评官组合"),
      el("span", null, null, [el("b", null, String(got)), document.createTextNode(` / ${total}`)]),
    ]),
    bar,
    el("div", "dex-rarities", null, byRarity),
  );

  $("dexGrid").replaceChildren(
    ...c.voices.map((v) => {
      const mine = dex[v.name];
      const tile = el("button", `dex-tile ${v.rarity}${mine ? "" : " locked"}`, null, [
        el("span", "e", v.emoji),
        el("span", "n", mine ? v.name : "？？？"),
        el("span", "c", mine ? `${mine.forms.length}/${c.forms.length}` : v.rarity),
      ]);
      tile.type = "button";
      tile.addEventListener("click", () => {
        document.querySelectorAll(".dex-tile").forEach((x) => x.classList.toggle("sel", x === tile));
        showDexDetail(v, mine);
      });
      return tile;
    }),
  );
  $("dexDetail").hidden = true;
}

function showDexDetail(v, mine) {
  const c = state.catalog;
  $("dexDetail").replaceChildren(
    el("h4", null, mine ? `${v.emoji} ${v.name}` : "🔒 还没抽到"),
    el("p", null, mine ? `${v.rarity} · 已收集 ${mine.forms.length} 种体裁` : `一位 ${v.rarity} 锐评官，多抽几次也许就来了`),
    el("div", "form-chips", null, c.forms.map((f) => el("span", "form-chip" + (mine?.forms.includes(f.name) ? " got" : ""), f.name))),
  );
  $("dexDetail").hidden = false;
}

/* ---------- 战犯评选 ---------- */
$("blameBtn").addEventListener("click", async () => {
  $("blameError").textContent = "";
  if (!state.image.blame) return ($("blameError").textContent = "先选一张结算截图");
  showLoading(["正在调取比赛录像…", "正在审讯五位嫌疑人…", "正在核对伤害和参团…", "正在评选战犯…"]);
  try {
    const data = await post("/api/blame", { image: state.image.blame, style: state.tone.blame });
    renderBlame(data);
  } catch (e) {
    $("blameError").textContent = e.message;
  } finally {
    hideLoading();
  }
});

function renderBlame(d) {
  const last = d.players.length;
  const rows = d.players.map((pl) => {
    const isMvp = pl.rank === 1;
    const isWorst = pl.rank === last;
    const stats = [`KDA ${pl.kda}`, `参团 ${pl.killParticipation}%`, pl.damageShare !== null && `伤害占比 ${pl.damageShare}%`].filter(Boolean).join(" · ");
    return el("div", "blame-row", null, [
      el("div", "medal" + (isMvp ? " m1" : isWorst ? " last" : ""), String(pl.rank)),
      el("div", null, null, [
        el("div", "blame-line1", null, [
          el("span", "blame-champ", pl.champion),
          pl.name && el("span", "blame-name", pl.name),
          el("span", "label-pill" + (isMvp ? " mvp" : isWorst ? " worst" : ""), pl.label),
          el("span", "blame-kda", `${pl.kills}/${pl.deaths}/${pl.assists}`),
        ]),
        el("div", "blame-stats", stats),
        pl.comment && el("div", "blame-comment", pl.comment),
      ]),
    ]);
  });
  const card = el("div", "blame-card", null, [
    el("div", "blame-title", null, [
      el("h2", null, "战犯评选"),
      d.win !== null && el("span", "result-pill " + (d.win ? "win" : "loss"), d.win ? "胜利" : "失败"),
    ]),
    el("div", "blame-headline", d.headline),
    el("div", "blame-host", null, [
      el("span", "rarity " + d.persona.rarity, d.persona.rarity),
      el("span", null, `主评：${d.persona.emoji} ${d.persona.voice} · ${TONE_NAMES[d.persona.tone] || ""}`),
    ]),
    ...rows,
    el("div", "card-foot", null, [el("span", null, d.source === "ai" ? "排名按参团、伤害、KDA 计算" : "模板点评（AI 未连接）"), el("span", null, "峡谷锐评官")]),
  ]);
  $("blameCard").replaceChildren(card);
  $("blameResult").hidden = false;
  setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

/* ---------- 赛后报告（召唤师名 / 演示模式才有） ---------- */
function renderMatches(data) {
  const games = data.games || [];
  const usable = !data.fromScreenshot && games.some((g) => g.opponent || Number.isFinite(g.goldPerMin));
  $("reportArea").hidden = !usable;
  $("report").hidden = true;
  if (!usable) return;
  $("matches").replaceChildren(
    ...games.map((g, i) => {
      const when = g.playedAt
        ? " · " + new Date(g.playedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";
      const kda = el("div", "kda", `${g.kills}/${g.deaths}/${g.assists}`);
      const btn = el("button", "match " + (g.win ? "win" : "loss"), null, [
        el("div", "bar"),
        el("div", null, null, [el("b", null, `${g.champion} · ${g.position}`), el("small", null, `${g.win ? "胜利" : "失败"} · ${g.queue} · ${g.minutes} 分钟${when}`)]),
        kda,
      ]);
      btn.type = "button";
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".match").forEach((b) => b.classList.toggle("active", b === btn));
        kda.textContent = "分析中…";
        btn.disabled = true;
        try {
          renderReport(await post("/api/report", { game: games[i] }));
        } catch (e) {
          $("roastError").textContent = e.message;
        } finally {
          kda.textContent = `${g.kills}/${g.deaths}/${g.assists}`;
          btn.disabled = false;
        }
      });
      return btn;
    }),
  );
}

function renderReport({ game: g, metrics, analysis: a }) {
  const metricRows = metrics.map((m) => {
    const max = Math.max(m.me, m.opponent ?? 0, m.benchmark ?? 0) || 1;
    const bars = el("div", "metric-bars");
    const bar = (cls, v) => {
      const b = el("div", "mbar " + cls, null, [el("span", null, String(v))]);
      b.style.width = (v / max) * 100 + "%";
      bars.append(b);
    };
    bar("me", m.me);
    if (m.opponent !== null) bar("op", m.opponent);
    if (m.benchmark !== null) {
      const line = el("div", "bench");
      line.style.left = (m.benchmark / max) * 100 + "%";
      bars.append(line);
    }
    return el("div", "metric", null, [el("div", "metric-label", m.label), bars]);
  });
  const li = (t) => el("li", null, t);
  const report = el("div", "report", null, [
    el("div", "r-head", null, [
      el("div", "grade" + (/[CD]/.test(a.grade) ? " bad" : ""), a.grade),
      el("div", null, null, [
        el("div", "r-meta", `${g.win ? "胜利" : "失败"} · ${g.champion} · ${g.position} · ${g.kills}/${g.deaths}/${g.assists}` + (g.opponent ? ` · 对位 ${g.opponent.champion}` : "")),
        el("div", "r-headline", a.headline),
      ]),
    ]),
    el("div", "r-section", null, [el("h4", null, "数据对比（金色是你，灰色是对位，虚线是位置参考线）"), ...metricRows]),
    el("div", "r-section", null, [el("h4", null, "做得好的"), el("ul", "list", null, a.highlights.map(li))]),
    el("div", "r-section", null, [el("h4", null, "主要问题"), ...a.problems.map((p) => el("div", "problem", null, [el("b", null, p.title), document.createTextNode(p.detail)]))]),
    el("div", "r-section", null, [el("h4", null, "下一局这样打"), el("ul", "list", null, a.suggestions.map(li))]),
  ]);
  $("report").replaceChildren(report);
  $("report").hidden = false;
  report.scrollIntoView({ behavior: "smooth", block: "start" });
}
