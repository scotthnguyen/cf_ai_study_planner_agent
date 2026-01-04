# Study Planner Agent (Cloudflare AI)

**Repo:** `cf_ai_study_planner_agent`

A chat-based study planning assistant built on Cloudflare that:
- Uses **Workers AI (Llama 3.3)** for responses
- Uses a **Durable Object** per session for **memory/state** (goals, constraints, deadlines, weekly plan, chat history)
- Provides a simple **Pages (React) chat UI**

## Architecture
Pages (React UI) → Worker API (`/api/chat`) → Durable Object (session memory + orchestration) → Workers AI (Llama 3.3)

## Features
- Clarifies missing info (course/subject, deadline) when needed
- Produces a time-boxed weekly plan
- Remembers context across messages (same `sessionId`)
- Supports updating constraints (e.g., hours/week) and revising the plan

## Run locally

### Worker (API + Durable Object)
```bash
cd worker
npm install
npx wrangler dev


User → Pages UI → Worker → Durable Object (memory) → Workers AI → Durable Object → Worker → UI
