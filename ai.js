// 调用大模型并拿回 JSON。锐评、赛后报告和截图识别共用。
// 配置了 DASHSCOPE_API_KEY 就用阿里云百炼的通义千问，否则用 Claude；都不可用时返回 null，由调用方用模板兜底。
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// qwen3.7-plus 关掉深度思考后又快又准；锐评和报告可以分别换模型
const QWEN_MODELS = {
  creative: process.env.QWEN_MODEL ?? "qwen3.7-plus",
  accurate: process.env.QWEN_REPORT_MODEL ?? "qwen3.7-plus",
  vision: process.env.QWEN_VL_MODEL ?? "qwen3-vl-plus",
};
const CLAUDE_MODEL = process.env.ROAST_MODEL ?? "claude-opus-5-5";
const DASHSCOPE_BASE_URL = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";

export const PROVIDER = process.env.DASHSCOPE_API_KEY ? "qwen" : "claude";

let qwen = null;
let claude = null;
let unavailable = false;

// task："creative"（锐评）、"accurate"（报告）或 "vision"（识图），只影响千问选哪个模型
// image：可选，{ mediaType: "image/jpeg", base64: "..." }
export async function askAIJSON(system, userContent, task = "creative", image = null) {
  if (unavailable) return null;
  try {
    const text =
      PROVIDER === "qwen"
        ? await callQwen(system, userContent, QWEN_MODELS[task], image)
        : await callClaude(system, userContent, image);
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch (error) {
    handleError(error);
    return null;
  }
}

async function callQwen(system, userContent, model, image) {
  qwen ??= new OpenAI({ apiKey: process.env.DASHSCOPE_API_KEY, baseURL: DASHSCOPE_BASE_URL });
  const completion = await qwen.chat.completions.create({
    model,
    // 视觉模型不一定支持 json_object 模式，只在纯文本时开启（要求提示词里出现“JSON”字样，SYSTEM 里已经有了）
    ...(image ? {} : { response_format: { type: "json_object" } }),
    temperature: image ? 0 : 1,
    // qwen3 系列默认会先深度思考，要等一两分钟；锐评用不着，关掉后几秒出结果
    enable_thinking: false,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: image
          ? [
              { type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
              { type: "text", text: userContent },
            ]
          : userContent,
      },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function callClaude(system, userContent, image) {
  // SDK 会自动读取 ANTHROPIC_API_KEY 或 `ant auth login` 的登录信息
  claude ??= new Anthropic();
  const response = await claude.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [
      {
        role: "user",
        content: image
          ? [
              { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
              { type: "text", text: userContent },
            ]
          : userContent,
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude 拒绝了这次请求");
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function handleError(error) {
  const authFailed =
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError ||
    isMissingCredentials(error);
  if (authFailed) {
    console.warn(
      PROVIDER === "qwen"
        ? "百炼 API key 无效，改用模板。检查 .env 里的 DASHSCOPE_API_KEY 后重启。"
        : "没有可用的 Claude 凭证，改用模板。设置 DASHSCOPE_API_KEY（百炼）或 ANTHROPIC_API_KEY 后重启即可启用 AI。",
    );
    unavailable = true;
  } else if (error instanceof Anthropic.RateLimitError || error instanceof OpenAI.RateLimitError) {
    console.warn("AI 接口限流了，这次先用模板");
  } else if (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError) {
    console.error(`AI 接口出错 ${error.status}:`, error.message);
  } else {
    console.error("调用 AI 失败:", error.message);
  }
}

function isMissingCredentials(error) {
  // 没配置任何凭证时，SDK 在发请求前就会抛出普通 Error
  return (
    !(error instanceof Anthropic.APIError) &&
    !(error instanceof OpenAI.APIError) &&
    /api.?key|auth/i.test(error.message)
  );
}
