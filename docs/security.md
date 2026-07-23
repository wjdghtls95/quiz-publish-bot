# Security Guide

## ⚠️ Token Handling Rules

**Never put tokens directly in code or config files.**

This project uses four secrets. Each one grants access to a different system:

| Secret | Access it grants | Risk if leaked |
|--------|-----------------|----------------|
| `TELEGRAM_BOT_TOKEN` | Send/receive messages as your bot | Anyone can impersonate your bot |
| `OPENAI_API_KEY` | Call OpenAI API | Unauthorized charges on your account |
| `GITHUB_TOKEN` | Write to your blog repo | Code injection, data deletion |

---

## Where to Store Secrets

### Cloudflare Worker (quiz-publish-bot)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages
2. Click `quiz-publish-bot` → Settings → Variables
3. Add each variable under **Environment Variables**
4. Click **Encrypt** for every value — this prevents the value from being displayed again

### GitHub Actions (blog-starter)

1. Go to your blog repo → Settings → Secrets and variables → Actions
2. Click **New repository secret**
3. Add each secret — GitHub masks these in logs automatically

---

## If a Token Is Accidentally Committed

Act immediately:

1. **Revoke the token** from the issuing service first — git history cleanup comes second
   - Telegram: @BotFather → `/mybots` → select bot → API Token → Revoke
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → delete key
   - GitHub: [github.com/settings/tokens](https://github.com/settings/tokens) → delete token

2. **Remove from git history** using [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) or `git filter-repo`

3. **Force push** the cleaned history

4. **Generate new tokens** and add them to the correct secret stores

---

## .gitignore Checklist

Make sure these are in your `.gitignore`:

```
.env
.env.local
.dev.vars        # Wrangler local dev vars
```

The `.env.example` file (without real values) **is safe to commit** — it documents required variables.
