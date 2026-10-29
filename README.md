# 峡谷锐评官

上传战绩截图（国服外服都行）或输入召唤师名，随机抽一位锐评官（2112 种人设 × 体裁 × 语气组合）锐评你的 LOL 战绩，生成一张可以发群里的分享卡片。

功能：

- **抽卡锐评**：卡背 → 翻牌揭晓，稀有度光效；诗词竖排宣纸、判决书红章、体检报告、新闻联播、小红书等 7 种排版
- **和锐评官对线**：不服可以回嘴，锐评官用同一人设接着怼（最多 5 轮）
- **战犯评选**：上传一局结算截图，给我方五人排名，评出 MVP 和战犯
- **锐评官图鉴**：收集抽到过的“人设 × 体裁”组合（704 种），存在本机浏览器
- **赛后分析报告**：召唤师名 / 演示模式下，点开任意一场看评级、数据对比和改进建议

## 运行

```bash
npm install
npm start
```

打开 http://localhost:3000 。

不配置任何 key 也能跑：用演示数据 + 模板锐评。

## 配置（可选）

把 `.env.example` 复制成 `.env`，填入：

- `RIOT_API_KEY`：在 https://developer.riotgames.com 用 Riot 账号登录后获取。开发者 key 每 24 小时过期，要正式上线需申请 Production key。
- `DASHSCOPE_API_KEY`：阿里云百炼的 key，在 https://bailian.console.aliyun.com 获取。填了就用通义千问生成锐评和报告（推荐）。
- `ANTHROPIC_API_KEY`：Claude API key，没填百炼 key 时才会用。注意 Claude Code 订阅套餐不能当 API key 用。

两个 AI key 都没填时，用模板锐评和规则报告。

改完 `.env` 要重启服务。

## 部署

见 [DEPLOY.md](DEPLOY.md)。

## 注意

- Riot API 只覆盖外服（韩服、日服、美服、欧服、东南亚、台服等），**不包含国服**。
- 公开上线前请阅读 Riot 的开发者政策，产品里不要使用 Riot 的商标和美术素材作为自己的品牌。

## 文件结构

- `server.js`：网页服务和接口
- `riot.js`：拉取对局数据并汇总统计
- `ai.js`：调用通义千问或 Claude，并解析返回的 JSON
- `personas.js`：锐评官人格库（人设 × 体裁 × 语气）和稀有度
- `roast.js`：生成锐评（AI 不可用时用模板）
- `report.js`：生成单场赛后报告（AI 不可用时按规则分析）
- `screenshot.js`：用视觉模型识别战绩截图
- `blame.js`：战犯评选（识别结算截图、计算排名、生成点评）
- `limits.js`：防刷（每 IP 频率限制 + 每日 AI 调用上限）
- `demo.js`：演示数据
- `public/`：前端页面（`index.html` 结构、`style.css` 样式和动态背景、`app.js` 交互逻辑）
