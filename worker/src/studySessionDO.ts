import { SYSTEM_PROMPT } from "./prompts";

type Env = {
  AI: any;
};

type Memory = {
  goals: string[];
  constraints: string[];
  deadlines: string[];
  plan: Record<string, string[]>;
  chat: { role: "user" | "assistant"; content: string }[];
};

function toText(result: any): string {
  if (typeof result === "string") return result;

  if (result && typeof result === "object") {
    // Common Workers AI shapes
    if (typeof result.response === "string") return result.response;
    if (typeof result.result === "string") return result.result;
    if (typeof result.output_text === "string") return result.output_text;

    // Some wrappers return: { message: { content: "..." } }
    if (result.message && typeof result.message.content === "string") {
      return result.message.content;
    }

    // Last resort: stringify
    try {
      return JSON.stringify(result);
    } catch {
      return String(result);
    }
  }

  return String(result);
}

function extractJSONObject(input: any): any | null {
  const text = typeof input === "string" ? input : toText(input);

  // 1) Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // 2) Scan for first valid {...} block
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (depth === 0) {
      const candidate = text.slice(start, i + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // keep scanning
      }
    }
  }
  return null;
}

export class StudySessionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private async loadMemory(): Promise<Memory> {
    const mem = await this.state.storage.get<Memory>("mem");
    return (
      mem ?? {
        goals: [],
        constraints: [],
        deadlines: [],
        plan: {},
        chat: [],
      }
    );
  }

  private async saveMemory(mem: Memory) {
    await this.state.storage.put("mem", mem);
  }

  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = (await req.json().catch(() => null)) as { message?: string } | null;
    const message = body?.message?.trim();
    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const mem = await this.loadMemory();

    // Keep chat context short to control token usage
    const recentChat = mem.chat.slice(-12);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content:
          "Current memory:\n" +
          JSON.stringify(
            {
              goals: mem.goals,
              constraints: mem.constraints,
              deadlines: mem.deadlines,
              plan: mem.plan,
            },
            null,
            2
          ),
      },
      ...recentChat,
      { role: "user", content: message },
    ];

    const result = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages,
      temperature: 0.6,
      max_tokens: 600,
    });

    // --- Robust payload extraction (handles object and text responses) ---
    let payload: any = null;

    // Case A: Workers AI returns { response: { reply, memory_update, ... }, ... }
    if (result && typeof result === "object" && result.response && typeof result.response === "object") {
      payload = result.response;
    }

    // Case B: parse JSON from returned text (or stringified object)
    if (!payload) {
      const rawText = toText(result);
      const maybeObj = extractJSONObject(rawText);

      // Some returns are { response: {...} }
      if (maybeObj?.response && typeof maybeObj.response === "object") {
        payload = maybeObj.response;
      } else {
        payload = maybeObj;
      }
    }

    const replyText =
      (payload && typeof payload.reply === "string" && payload.reply) ||
      toText(result) ||
      "Sorry — I had trouble generating a response.";

    // Update memory if provided
    const update = payload?.memory_update;
    if (update && typeof update === "object") {
      if (Array.isArray(update.goals)) mem.goals = update.goals;
      if (Array.isArray(update.constraints)) mem.constraints = update.constraints;
      if (Array.isArray(update.deadlines)) mem.deadlines = update.deadlines;
      if (update.plan && typeof update.plan === "object") mem.plan = update.plan;
    }

    mem.chat.push({ role: "user", content: message });
    mem.chat.push({ role: "assistant", content: replyText });

    // Basic trimming
    if (mem.chat.length > 40) mem.chat = mem.chat.slice(-40);

    await this.saveMemory(mem);

    return new Response(
      JSON.stringify({
        reply: replyText,
        memory: {
          goals: mem.goals,
          constraints: mem.constraints,
          deadlines: mem.deadlines,
          plan: mem.plan,
        },
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
