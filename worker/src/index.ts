import { StudySessionDO } from "./studySessionDO";

export { StudySessionDO };

type Env = {
  AI: any;
  STUDY_SESSION: DurableObjectNamespace;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(req.url);

    if (url.pathname === "/api/health") {
      return new Response("ok");
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as
        | { sessionId?: string; message?: string }
        | null;

      const sessionId = body?.sessionId?.trim();
      const message = body?.message?.trim();

      if (!sessionId || !message) {
        return json({ error: "sessionId and message are required" }, 400);
      }

      const id = env.STUDY_SESSION.idFromName(sessionId);
      const stub = env.STUDY_SESSION.get(id);

      const resp = await stub.fetch("https://do.chat/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: { ...corsHeaders(), "content-type": "application/json; charset=utf-8" },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};
