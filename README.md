# quiz-publish-bot

[🇰🇷 한국어](docs/README.ko.md)

> A Cloudflare Worker Telegram bot that manages a quiz-based blog publishing queue.
> Answer a quiz about your draft → pass → post goes live on your blog.

---

## What this does

```
Draft pushed to GitHub
    ↓
Quiz auto-generated (via blog-starter)
    ↓  ← this bot handles everything below
Quiz stored in Cloudflare KV
Telegram notification sent
    ↓
You answer the quiz in Telegram
    ↓
/publish → blog-starter GitHub Actions builds and deploys the post
```

---

## Before you start — checklist

Gather these before running any commands:

| # | What you need | Where to get it | Takes |
|---|--------------|-----------------|-------|
| 1 | Telegram account | [telegram.org](https://telegram.org) | 2 min |
| 2 | Telegram bot token | [@BotFather](https://t.me/BotFather) → `/newbot` | 2 min |
| 3 | Telegram chat ID | [@userinfobot](https://t.me/userinfobot) | 1 min |
| 4 | GitHub Personal Access Token | [github.com/settings/tokens](https://github.com/settings/tokens) → repo scope | 3 min |
| 5 | Cloudflare account (free) | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) | 3 min |
| 6 | Cloudflare API token | Cloudflare → My Profile → API Tokens | 2 min |
| 7 | KV namespace ID | Workers & Pages → KV → Create namespace | 2 min |

> ⚠️ **Tokens are secrets.** Never paste them into files tracked by git.
> Store them in Cloudflare Worker environment variables only. → [docs/security.md](docs/security.md)

---

## Why Cloudflare? (free tier is enough)

Cloudflare Workers free plan covers this bot with room to spare:

| Resource | Free allowance | This bot uses |
|----------|---------------|---------------|
| Worker requests | 100,000 / day | ~10 / day (one per Telegram message) |
| KV reads | 100,000 / day | ~50 / day |
| KV writes | 1,000 / day | ~10 / day |
| KV storage | 1 GB | < 1 MB |

No credit card required for the free plan. → [cloudflare.com/plans](https://www.cloudflare.com/plans/)

---

## Install

### Mac

```bash
# 1. Install Node.js (skip if already installed)
brew install node

# 2. Install Wrangler CLI
npm install -g wrangler

# 3. Log in to Cloudflare
wrangler login

# 4. Clone this repo
git clone https://github.com/wjdghtls95/quiz-publish-bot.git
cd quiz-publish-bot
```

### Windows (PowerShell)

```powershell
# 1. Install Node.js
winget install OpenJS.NodeJS.LTS

# Restart terminal, then:

# 2. Install Wrangler CLI
npm install -g wrangler

# 3. Log in to Cloudflare
wrangler login

# 4. Clone this repo
git clone https://github.com/wjdghtls95/quiz-publish-bot.git
cd quiz-publish-bot
```

---

## Configure

### 1. Set your KV namespace ID

Open `wrangler.jsonc` and replace `YOUR_KV_NAMESPACE_ID`:

```jsonc
"kv_namespaces": [
  {
    "binding": "QUIZ_SESSIONS",
    "id": "paste-your-namespace-id-here"
  }
]
```

### 2. Add secrets

**Do not use `.env` for deployment.** Use Cloudflare Dashboard or Wrangler CLI:

**Cloudflare Dashboard**
Workers & Pages → quiz-publish-bot → Settings → Variables → Add variable → ✅ Encrypt

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope |
| `GITHUB_REPO` | `your-username/your-blog-repo` |

**Or via terminal (Mac / Windows — same command)**
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_REPO
```

---

## Deploy

```bash
wrangler deploy
```

Expected output:
```
✅ Deployed quiz-publish-bot to https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev
```

---

## Register Telegram webhook

Replace `YOUR_BOT_TOKEN` and `YOUR_SUBDOMAIN`.

**Mac**
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev"}'
```

**Windows (PowerShell)**
```powershell
Invoke-RestMethod `
  -Uri "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"url": "https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev"}'
```

---

## Bot commands

| Command | What it does |
|---------|-------------|
| `/start` | Show status and queue info |
| `/quiz` | Start the current quiz |
| `/publish` | Publish the front-of-queue post |
| `/skip` | Skip the current quiz |
| `/postpone` | Move the quiz to tomorrow |

---

## Docs

- [docs/README.ko.md](docs/README.ko.md) — 한국어 가이드
- [docs/SETUP.md](docs/SETUP.md) — Detailed setup guide (EN)
- [docs/SETUP.ko.md](docs/SETUP.ko.md) — 상세 설치 가이드 (한국어)
- [docs/security.md](docs/security.md) — Token security rules

---

## Related

- [blog-starter](https://github.com/wjdghtls95/blog-starter) — the GitHub Pages blog template that triggers this bot
