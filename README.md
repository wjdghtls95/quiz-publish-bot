# quiz-publish-bot

A Telegram quiz bot that gates blog post publishing. Push a draft → get quizzed → pass → post auto-publishes.

Works together with [blog-starter](https://github.com/YOUR_USERNAME/blog-starter).

---

## How It Works

```
blog-starter: push drafts/post.md
  ↓
GitHub Actions: generate quiz via OpenAI → store in Cloudflare KV
  ↓
quiz-publish-bot (Cloudflare Worker)
  → 6pm KST: send quiz via Telegram
  → Pass (70%+): publish post at 8am next day
  → Fail: retry in 30 minutes
  → No-show: hourly reminder, /postpone to defer
```

---

## ⚠️ Security — Read Before Setup

**Never paste tokens directly into code or config files.**

All secrets must be stored in Cloudflare Worker Environment Variables — not in `wrangler.jsonc`, not in `.env` committed to git.

If you accidentally commit a token:
1. Revoke it immediately from the issuing service
2. Generate a new one
3. Clean it from git history

Full guidance → [docs/security.md](docs/security.md)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Wrangler CLI | latest | `npm install -g wrangler` |
| Cloudflare account | free | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) |
| Telegram Bot | — | [@BotFather](https://t.me/BotFather) |
| OpenAI API key | — | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| GitHub PAT | repo scope | [github.com/settings/tokens](https://github.com/settings/tokens) |

---

## Quick Start

See **[SETUP.md](SETUP.md)** for full step-by-step instructions (Mac and Windows).

---

## Environment Variables

Set these in **Cloudflare Dashboard → Workers & Pages → quiz-publish-bot → Settings → Variables**.

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `OPENAI_API_KEY` | For essay grading |
| `GITHUB_TOKEN` | Personal access token (repo scope) |
| `GITHUB_REPO` | `username/blog-repo-name` |

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Check bot status and queue length |
| `/postpone` | Defer current quiz to tomorrow 6pm |

---

## Configuration

**Pass score:** Edit `PASS_SCORE` at the top of `src/index.js` (default: 70)

**Quiz time:** Edit cron expressions in `wrangler.jsonc`
- `0 9 * * *` = 18:00 KST (quiz delivery)
- `0 23 * * *` = 08:00 KST next day (publish)

**Queue cap:** Edit `QUEUE_MAX` in `blog-starter/scripts/generate-quiz.py`
