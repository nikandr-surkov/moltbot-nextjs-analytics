# 🤖 Moltbot (Clawdbot) Analytics Integration for Next.js

A reference implementation demonstrating how to connect **AI Agents** (like Moltbot/Clawdbot) to a **Next.js** application for real-time data analytics.

This project solves a common problem in AI engineering: **How do you give an LLM access to your database without risking data loss?**

It features a **secure, read-only SQL interface** that allows an AI assistant to monitor performance, aggregate metrics, and answer complex business questions (e.g., "What is the retention rate today?") by querying the database directly and safely.

## 🎯 Project Goal

To demonstrate a production-ready pattern for **"AI-in-the-Loop" Analytics**, where an autonomous agent can:

1. Authenticate securely via a dedicated API route.
2. Execute safe, read-only SQL queries.
3. Analyze live user behavior and system state.

*(Note: This repository uses a simple "Dice Game" simulation to generate real-time user data for the AI to analyze.)*

## ✨ Key Features

### 🧠 The AI Architecture (Moltbot/Clawdbot)

- **Dedicated AI Interface:** A specialized `/api/moltbot` route designed for machine-to-machine communication.
- **Safety-First Design:**
  - **SQL Guardrails:** The API strictly blocks dangerous keywords (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`), ensuring the AI acts as a passive observer only.
  - **High-Entropy Auth:** Protected by a custom `x-moltbot-secret` header.
- **Natural Language Analytics:** Allows operators to ask plain English questions (*"Calculate the average transaction value for the last hour"*) which the agent translates into optimized SQL.

### 🔌 The Demo Application (Data Source)

- **Telegram Mini App:** Built with Next.js 16 and `@twa-dev/sdk`.
- **Real-Time State:** Uses a global state (Jackpot) and per-user transactional data (Bets/Balance) to give the AI meaningful data to track.
- **Provably Fair Logic:** Implements transparent RNG mechanics to generate verifiable data points.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL (via Neon Serverless)
- **ORM:** Drizzle ORM
- **Agent Runtime:** Moltbot (Clawdbot) running on Hetzner VPS

---

## 🚀 Getting Started (The App)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/moltbot-nextjs-analytics.git
cd moltbot-nextjs-analytics
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```bash
# Database Connection (Neon/Postgres)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl..."

# Secret Key for AI Access
# Generate this with: openssl rand -hex 32
MOLTBOT_SECRET="8f4b2e1c9d3a..."
```

### 3. Database Migration

Push the schema to your database:

```bash
npx drizzle-kit push
```

### 4. Run Locally

```bash
npm run dev
```

---

## 🤖 AI Agent Setup (Server Side)

To enable the AI analytics, you need a running instance of **Moltbot (Clawdbot)**. This agent will connect to your Next.js app to read data.

### 1. Install Moltbot (Clawdbot)

SSH into your server (e.g., Hetzner VPS) and run the official installer:

```bash
curl -fsSL https://molt.bot/install.sh | bash
```

### 2. Define the "Data Analyst" Skill

The agent needs a schema definition to understand your database structure.

Run these commands on your server:

```bash
# Create the skill directory
mkdir -p ~/.clawdbot/skills/analytics

# Create the skill definition file
nano ~/.clawdbot/skills/analytics/SKILL.md
```

Paste the following Skill Definition (update `YOUR-APP-DOMAIN.com`):

```markdown
---
name: app-analytics
description: Read-only access to the application database for analytics.
metadata:
  moltbot:
    emoji: "📊"
    requires:
      env: ["MOLTBOT_SECRET"]
      bins: ["curl", "jq"]
---

# App Analytics

Query the live application database to answer business intelligence questions.

**Database Schema:**
- **users**: `id`, `telegram_id`, `balance` (int), `last_active` (timestamp)
- **global_state**: `metric_value` (int)
- **transactions**: `user_id`, `amount`, `type`, `status` (bool), `created_at`

## Usage

Write a SQL query to answer the user's question. Use `curl` to send it to the API.

**Example: Check Active Users**

curl -s -X POST "https://YOUR-APP-DOMAIN.com/api/moltbot" \
  -H "Content-Type: application/json" \
  -H "x-moltbot-secret: $MOLTBOT_SECRET" \
  -d '{"query": "SELECT count(*) FROM users WHERE last_active > NOW() - INTERVAL '24 hours'"}' | jq
```

### 3. Configure Authentication

Add the secure key to the agent's configuration:

```bash
nano ~/.clawdbot/clawdbot.json
```

Add the `skills` block:

```json
{
  "gateway": { "..." : "..." },
  "skills": {
    "entries": {
      "app-analytics": {
        "enabled": true,
        "env": {
          "MOLTBOT_SECRET": "YOUR_GENERATED_SECRET_KEY"
        }
      }
    }
  }
}
```

### 4. Restart the Agent

```bash
systemctl --user restart clawdbot-gateway
```

---

## 🛡️ Security Implementation

The core value of this architecture is **safety**. The Next.js API route includes a middleware check that parses incoming SQL queries.

**The Safety Filter:**

```typescript
const forbiddenKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT'];

if (forbiddenKeywords.some(keyword => query.toUpperCase().includes(keyword))) {
  return Response.json({ error: "Forbidden: Read-only access only" }, { status: 403 });
}
```

This ensures that even if the AI hallucinates a destructive command, the application layer will reject it before it reaches the database.

---

## ⚖️ Disclaimer

**Educational Use Only:** This repository contains a simulation (Dice Game) used solely to generate data for analytics testing. It does not facilitate real-money transactions. The focus of this project is strictly on the AI-to-Database integration pattern.

## Author
### Nikandr Surkov
- 🌐 Website: https://nikandr.com
- 📺 YouTube: https://www.youtube.com/@NikandrSurkov
- 📢 Telegram Channel: https://t.me/NikandrApps
- 📱 Telegram: https://t.me/nikandr_s
- 💻 GitHub: https://github.com/nikandr-surkov
- 🐦 Twitter: https://x.com/NikandrSurkov
- 💼 LinkedIn: https://www.linkedin.com/in/nikandr-surkov/
- ✍️ Medium: https://medium.com/@NikandrSurkov
