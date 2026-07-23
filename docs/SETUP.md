# Setup Guide

> **⚠️ Security first:** Never paste real tokens into any file you commit to git.
> All secrets go into Cloudflare Worker Environment Variables only. See [docs/security.md](docs/security.md).

---

## Step 1 — Install Prerequisites

### Mac

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Wrangler
npm install -g wrangler

# Verify
node --version   # should be 18+
wrangler --version
```

### Windows

```powershell
# Install winget (comes with Windows 11, or install App Installer from Microsoft Store)

# Install Node.js
winget install OpenJS.NodeJS.LTS

# Restart terminal, then install Wrangler
npm install -g wrangler

# Verify
node --version
wrangler --version
```

---

## Step 2 — Create Telegram Bot

1. Open Telegram → search **@BotFather** → `/start`
2. Send `/newbot`
3. Enter a name (e.g. `My Quiz Bot`)
4. Enter a username ending in `bot` (e.g. `myquiz_bot`)
5. Copy the **token** — looks like `123456789:ABCdef...`

> ⚠️ This token lets anyone control your bot. Store it only in Cloudflare env vars.

---

## Step 3 — Get OpenAI API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Create new secret key**
3. Copy the key — it starts with `sk-`

> ⚠️ You can only see this key once. Store it immediately.

---

## Step 4 — Get GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Set expiration (90 days recommended)
4. Check **repo** scope only
5. Click **Generate token** and copy it

> ⚠️ This token can write to your repositories. Never commit it.

---

## Step 5 — Set Up Cloudflare

### Create account and KV namespace

1. Sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) (free)
2. Go to **Workers & Pages → KV**
3. Click **Create namespace**
4. Name it `QUIZ_SESSIONS`
5. Copy the **Namespace ID** (you'll need it in the next step)

### Login with Wrangler

```bash
wrangler login
```

A browser window will open — authorize Wrangler to access your account.

---

## Step 6 — Configure the Project

### Mac / Windows (same)

```bash
# Clone this repo
git clone https://github.com/YOUR_USERNAME/quiz-publish-bot.git
cd quiz-publish-bot
```

Edit `wrangler.jsonc` — replace `YOUR_KV_NAMESPACE_ID` with the ID from Step 5:

```jsonc
"kv_namespaces": [
  {
    "binding": "QUIZ_SESSIONS",
    "id": "paste-your-kv-namespace-id-here"
  }
]
```

---

## Step 7 — Add Secrets to Cloudflare

**Do not use `.env` files for deployment secrets.**
Set them directly in the Cloudflare dashboard:

1. Go to **Workers & Pages → quiz-publish-bot → Settings → Variables**
2. Add each variable and click **Encrypt**:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Token from Step 2 |
| `OPENAI_API_KEY` | Key from Step 3 |
| `GITHUB_TOKEN` | Token from Step 4 |
| `GITHUB_REPO` | `your-username/your-blog-repo` |

---

## Step 8 — Deploy

```bash
wrangler deploy
```

Expected output:
```
✅ Deployed quiz-publish-bot to https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 9 — Register Telegram Webhook

Replace `YOUR_BOT_TOKEN` and `YOUR_WORKER_URL` with your values:

### Mac

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev"}'
```

### Windows (PowerShell)

```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"url": "https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev"}'
```

---

## Step 10 — Test

1. Open Telegram → find your bot → send `/start`
2. You should see: `Quiz bot ready — Queue: 0 items — No active quiz`

**Done!** Now set up [blog-starter](https://github.com/YOUR_USERNAME/blog-starter) to start publishing.
