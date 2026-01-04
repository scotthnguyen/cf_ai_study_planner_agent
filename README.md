# Study Planner Agent (Cloudflare AI)

Repo: `cf_ai_study_planner_agent`

A chat-based study planning assistant running on Cloudflare:
- Workers AI (Llama 3.3) for responses
- Durable Objects for per-session memory (goals, constraints, deadlines, weekly plan, chat history)
- Pages frontend chat UI

## Architecture
Pages (UI) -> Worker API (/api/chat) -> Durable Object (session brain) -> Workers AI (Llama 3.3)

## Prereqs
- Node.js 18+
- Cloudflare account
- Wrangler CLI

## Setup
### 1) Worker (API + Durable Object)
```bash
cd worker
npm install
npx wrangler dev
