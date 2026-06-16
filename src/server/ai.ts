export type AISource = "openrouter" | "mock";

export const DEFAULT_MODEL = "anthropic/claude-3-haiku";

export const ALLOWED_MODELS = [
  "anthropic/claude-3-haiku",
  "anthropic/claude-3.5-haiku",
  "google/gemini-flash-1.5",
  "google/gemini-2.0-flash-lite",
  "mistral/mistral-small",
  "openai/gpt-4o-mini",
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

/**
 * Validates required AI-related environment variables at the start of each
 * request. Cloudflare Workers have no module-level startup hook, so this is
 * the earliest feasible validation point — it runs before any route handler.
 *
 * Checks:
 *   1. AI provider: either OPENROUTER_API_KEY (production) or MOCK_AI=1 (local dev)
 *   2. ANTHROPIC_API_KEY: required for the inbox organiser agent; validated here
 *      so a typo surfaces on the first request rather than at agent run time.
 *
 * Throws an explicit, actionable Error for each missing variable so operators
 * are never left guessing why an AI feature is silent.
 */
export function assertAIEnv(env: {
  OPENROUTER_API_KEY?: string;
  MOCK_AI?: string;
  ANTHROPIC_API_KEY?: string;
}): void {
  if (!env.OPENROUTER_API_KEY && env.MOCK_AI !== "1") {
    throw new Error(
      "Worker configuration error: no AI provider configured. " +
      "Set OPENROUTER_API_KEY as a Worker secret (wrangler secret put OPENROUTER_API_KEY), " +
      "or set MOCK_AI=1 in .dev.vars for local development."
    );
  }

  if (!env.ANTHROPIC_API_KEY && env.MOCK_AI !== "1") {
    throw new Error(
      "Worker configuration error: ANTHROPIC_API_KEY is not set. " +
      "Set it as a Worker secret (wrangler secret put ANTHROPIC_API_KEY). " +
      "It is required for the inbox organiser agent."
    );
  }
}

export interface AIResult {
  text: string;
  source: AISource;
}

export interface AIOptions {
  system: string;
  prompt: string;
  model?: string;
}

export async function aiComplete(
  env: { OPENROUTER_API_KEY?: string; MOCK_AI?: string },
  opts: AIOptions
): Promise<AIResult> {
  if (env.OPENROUTER_API_KEY) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://travis.app",
        "X-Title": "Travis Field Service",
      },
      body: JSON.stringify({
        model: opts.model ?? "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${resp.status}: ${body || "no response body"}`);
    }

    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, source: "openrouter" };
  }

  if (env.MOCK_AI === "1") {
    return {
      text: `[Mock AI response to: ${opts.prompt.slice(0, 120)}${opts.prompt.length > 120 ? "..." : ""}]`,
      source: "mock",
    };
  }

  throw new Error(
    "No AI provider configured. Set OPENROUTER_API_KEY in Worker secrets, " +
    "or set MOCK_AI=1 in .dev.vars for local development."
  );
}
