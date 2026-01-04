STUDY PLANNER AGENT (CLOUDFLARE AI)

Repo: cf_ai_study_planner_agent

This project is a chat-based study planning assistant built on Cloudflare. It demonstrates how to build a stateful AI-powered application using Workers AI, Durable Objects, and a React frontend.

The agent helps users plan studying for exams by asking clarifying questions, generating time-boxed study plans, and updating plans when constraints change. Memory is preserved per session using Durable Objects.

TECHNOLOGIES USED

- Cloudflare Workers
- Workers AI (Llama 3.3)
- Durable Objects for per-session memory and state
- Cloudflare Pages (React / Vite frontend)

ARCHITECTURE OVERVIEW

User
→ Cloudflare Pages (React chat UI)
→ Cloudflare Worker API (POST /api/chat)
→ Durable Object (StudySessionDO)
   - stores goals, constraints, deadlines, weekly plan, and chat history
   - builds prompts using current memory
   - coordinates AI calls
→ Workers AI (Llama 3.3)
→ Durable Object updates memory
→ Worker returns response
→ UI displays reply

FEATURES

- Conversational chat interface
- Asks clarifying questions when information is missing
- Generates concrete, day-by-day study plans
- Remembers context across messages using sessionId
- Updates plans when availability or deadlines change
- Reset Session button to start a new study session

RUN LOCALLY

WORKER (API + DURABLE OBJECT)

1. Navigate to the worker directory:
   cd worker
2. Install dependencies:
   npm install
3. Start the worker:
   npx wrangler dev

WEB (FRONTEND UI)

1. Navigate to the web directory:
   cd web
2. Install dependencies:
   npm install
3. Create a .env file with the following line:
   VITE_API_BASE=http://localhost:8787
4. Start the frontend:
   npm run dev

Open the URL printed by Vite (usually http://localhost:5173).

LIVE DEPLOYMENT

API (Cloudflare Worker):
https://cf-ai-study-planner-worker.scottowandmore.workers.dev

The frontend can be deployed to Cloudflare Pages and configured to point to the deployed Worker API.

NOTES

- The sessionId determines which Durable Object instance is used.
- Using the same sessionId allows the agent to remember prior context and plans.
- Workers AI is accessed through the env.AI binding.
