// AI provider abstraction for Travis.
//
// Single provider: OpenRouter — handles both general assistant (aiComplete)
// and autonomous programmer build planning (aiBuild). Both use the same key
// and degrade gracefully to clearly-labelled mock responses when the key is
// absent. On provider failure both throw a real error — never a silent fake.

export interface AIEnv {
  OPENROUTER_API_KEY?: string;
  AI_MODEL?: string;
}

export interface AICompleteOptions {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResult {
  text: string;
  source: "openrouter" | "mock";
  model: string;
}

export interface BuildStep {
  step: number;
  title: string;
  detail: string;
  code?: string;
}

export interface BuildResult {
  steps: BuildStep[];
  summary: string;
  source: "openrouter" | "mock";
  model: string;
}

// ── OpenRouter shared config ──────────────────────────────────────

const DEFAULT_MODEL = "openrouter/owl-alpha";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function aiConfigured(env: AIEnv): boolean {
  return Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim());
}

// Alias so server routes that imported anthropicConfigured still compile
export const anthropicConfigured = aiConfigured;

async function orFetch(
  env: AIEnv,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages }),
    });
  } catch (err) {
    throw new Error(`OpenRouter request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned an empty response");
  return text;
}

// ── General assistant ─────────────────────────────────────────────

export async function aiComplete(env: AIEnv, opts: AICompleteOptions): Promise<AIResult> {
  const model = opts.model || env.AI_MODEL || DEFAULT_MODEL;
  if (!aiConfigured(env)) {
    return { text: mockAnswer(opts.prompt), source: "mock", model };
  }
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: opts.prompt },
  ];
  const text = await orFetch(env, model, messages, opts.maxTokens ?? 600, opts.temperature ?? 0.4);
  return { text, source: "openrouter", model };
}

// ── Autonomous programmer (build planner) ─────────────────────────

const BUILD_MODEL = DEFAULT_MODEL;
const BUILD_SYSTEM = `You are an autonomous programmer embedded in Travis, a field-service business platform.
When given a build task, respond with a structured step-by-step implementation plan in valid JSON only.
Format your entire response as a JSON object:
{
  "steps": [
    { "step": 1, "title": "Short step title", "detail": "What to do and why", "code": "optional code snippet" }
  ],
  "summary": "One-sentence summary of what was built"
}
Be concrete, production-ready, and specific to a UK trades/field-service context.
Use TypeScript, Hono, D1 SQLite, and Preact where relevant to this stack.`;

export async function aiBuild(env: AIEnv, task: string): Promise<BuildResult> {
  if (!aiConfigured(env)) {
    return mockBuild(task);
  }
  const model = env.AI_MODEL || BUILD_MODEL;
  const messages = [
    { role: "system", content: BUILD_SYSTEM },
    { role: "user", content: task },
  ];
  const raw = await orFetch(env, model, messages, 2048, 0.3);
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: { steps: BuildStep[]; summary: string };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { steps: [{ step: 1, title: "Build output", detail: raw }], summary: task };
  }
  return { ...parsed, source: "openrouter", model };
}

// ── Mock fallbacks ────────────────────────────────────────────────

function mockAnswer(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("quote")) {
    return "Here's a draft quote outline: itemise labour and materials, apply your 35% target margin, and add 20% VAT. (Demo mode — connect an OpenRouter key for live AI drafting.)";
  }
  if (p.includes("invoice") || p.includes("overdue") || p.includes("chase")) {
    return "Suggested reminder: a polite, firm nudge referencing the invoice number, amount due and a clear payment link. (Demo mode — connect an OpenRouter key for live AI drafting.)";
  }
  if (p.includes("call") || p.includes("summary") || p.includes("summarise")) {
    return "Call summary: capture caller, intent, and any follow-up action, then route to the right module. (Demo mode — connect an OpenRouter key for live AI summaries.)";
  }
  return "I'm Travis, your AI co-worker. I can draft quotes, chase invoices, and summarise calls. (Demo mode — add an OpenRouter API key to enable live responses.)";
}

function mockBuild(task: string): BuildResult {
  return {
    steps: [
      { step: 1, title: "Define the schema", detail: "Add the relevant table(s) to schema.sql with appropriate columns. (Demo mode — connect an OpenRouter key for live build plans.)" },
      { step: 2, title: "Create the API endpoint", detail: "Add a Hono OpenAPI route in src/server/index.ts with validation and D1 queries." },
      { step: 3, title: "Build the UI component", detail: "Create a Preact component in src/client/components/ that fetches and displays the data." },
    ],
    summary: `Demo build plan for: ${task.slice(0, 80)}`,
    source: "mock",
    model: BUILD_MODEL,
  };
}
