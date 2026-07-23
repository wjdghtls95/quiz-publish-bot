# quiz-publish-bot

[🇺🇸 English](../README.md)

> 퀴즈 통과 후 블로그 포스트를 발행하는 Cloudflare Worker Telegram 봇.
> 초안 push → 퀴즈 풀기 → 통과 → 포스트 자동 발행.

---

## 동작 방식

```
GitHub에 초안 push
    ↓
퀴즈 자동 생성 (blog-starter 담당)
    ↓  ← 이 봇이 아래를 처리
퀴즈가 Cloudflare KV에 저장됨
Telegram 알림 수신
    ↓
Telegram에서 퀴즈 풀기
    ↓
/publish → blog-starter GitHub Actions가 빌드 후 배포
```

---

## 시작 전 체크리스트

명령어 실행 전에 아래를 먼저 준비하세요:

| # | 필요한 것 | 발급처 | 소요 시간 |
|---|----------|--------|---------|
| 1 | Telegram 계정 | [telegram.org](https://telegram.org) | 2분 |
| 2 | Telegram 봇 토큰 | [@BotFather](https://t.me/BotFather) → `/newbot` | 2분 |
| 3 | Telegram 채팅 ID | [@userinfobot](https://t.me/userinfobot) | 1분 |
| 4 | GitHub Personal Access Token | [github.com/settings/tokens](https://github.com/settings/tokens) → repo 권한 | 3분 |
| 5 | Cloudflare 계정 (무료) | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) | 3분 |
| 6 | Cloudflare API 토큰 | Cloudflare → My Profile → API Tokens | 2분 |
| 7 | KV 네임스페이스 ID | Workers & Pages → KV → 네임스페이스 생성 | 2분 |

> ⚠️ **토큰은 비밀입니다.** git이 추적하는 파일에 절대 붙여넣지 마세요.
> Cloudflare Worker 환경변수에만 저장하세요. → [security.md](security.md)

---

## Cloudflare를 쓰는 이유 (무료 플랜으로 충분)

Cloudflare Workers 무료 플랜이 이 봇을 충분히 감당합니다:

| 리소스 | 무료 한도 | 이 봇 사용량 |
|--------|----------|------------|
| Worker 요청 수 | 하루 100,000회 | 하루 ~10회 (Telegram 메시지당 1회) |
| KV 읽기 | 하루 100,000회 | 하루 ~50회 |
| KV 쓰기 | 하루 1,000회 | 하루 ~10회 |
| KV 저장 용량 | 1 GB | 1 MB 미만 |

신용카드 없이 무료 플랜 사용 가능. → [cloudflare.com/plans](https://www.cloudflare.com/plans/)

---

## 설치

### Mac

```bash
# 1. Node.js 설치 (이미 있으면 생략)
brew install node

# 2. Wrangler CLI 설치
npm install -g wrangler

# 3. Cloudflare 로그인
wrangler login

# 4. 레포 클론
git clone https://github.com/wjdghtls95/quiz-publish-bot.git
cd quiz-publish-bot
```

### Windows (PowerShell)

```powershell
# 1. Node.js 설치
winget install OpenJS.NodeJS.LTS

# 터미널 재시작 후:

# 2. Wrangler CLI 설치
npm install -g wrangler

# 3. Cloudflare 로그인
wrangler login

# 4. 레포 클론
git clone https://github.com/wjdghtls95/quiz-publish-bot.git
cd quiz-publish-bot
```

---

## 설정

### 1. KV 네임스페이스 ID 설정

`wrangler.jsonc` 에서 `YOUR_KV_NAMESPACE_ID` 를 실제 ID로 교체:

```jsonc
"kv_namespaces": [
  {
    "binding": "QUIZ_SESSIONS",
    "id": "여기에-네임스페이스-ID-붙여넣기"
  }
]
```

### 2. 시크릿 추가

**배포 시 `.env` 파일은 사용하지 마세요.** Cloudflare 대시보드 또는 Wrangler CLI 사용:

**Cloudflare 대시보드**
Workers & Pages → quiz-publish-bot → Settings → Variables → Add variable → ✅ Encrypt

| 변수 | 값 |
|------|-----|
| `TELEGRAM_BOT_TOKEN` | BotFather에서 발급한 토큰 |
| `GITHUB_TOKEN` | `repo` 권한의 GitHub PAT |
| `GITHUB_REPO` | `유저명/블로그-레포-이름` |

**또는 터미널 (Mac / Windows 동일)**
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_REPO
```

---

## 배포

```bash
wrangler deploy
```

정상 출력:
```
✅ Deployed quiz-publish-bot to https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev
```

---

## Telegram Webhook 등록

`YOUR_BOT_TOKEN` 과 `YOUR_SUBDOMAIN` 을 실제 값으로 교체하세요.

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

## 봇 명령어

| 명령어 | 설명 |
|--------|------|
| `/start` | 봇 상태 및 큐 확인 |
| `/퀴즈` | 지금 바로 퀴즈 시작 (18:00 크론 기다리지 않고) |
| `/건너뛰기` | 퀴즈 스킵 → 내일 08:00 발행 예약 |
| `/발행` | 즉시 발행 (퀴즈 통과 or 건너뛰기 후) |
| `/미루기` | 오늘 퀴즈를 내일 18:00으로 미루기 |

### Telegram에 명령어 등록

`/` 자동완성이 뜨도록 한 번만 실행하면 됩니다:

**Mac**
```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "봇 상태 및 큐 확인"},
      {"command": "퀴즈", "description": "지금 바로 퀴즈 시작"},
      {"command": "건너뛰기", "description": "퀴즈 스킵 후 내일 08:00 발행"},
      {"command": "발행", "description": "즉시 발행"},
      {"command": "미루기", "description": "내일 18:00으로 미루기"}
    ]
  }'
```

**Windows (PowerShell)**
```powershell
Invoke-RestMethod `
  -Uri "https://api.telegram.org/botYOUR_BOT_TOKEN/setMyCommands" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"commands":[{"command":"start","description":"봇 상태 및 큐 확인"},{"command":"퀴즈","description":"지금 바로 퀴즈 시작"},{"command":"건너뛰기","description":"퀴즈 스킵 후 내일 08:00 발행"},{"command":"발행","description":"즉시 발행"},{"command":"미루기","description":"내일 18:00으로 미루기"}]}'
```

---

## 문서

- [SETUP.md](SETUP.md) — 상세 설치 가이드 (영어)
- [SETUP.ko.md](SETUP.ko.md) — 상세 설치 가이드 (한국어)
- [security.md](security.md) — 토큰 보안 규칙

---

## 관련 레포

- [blog-starter](https://github.com/wjdghtls95/blog-starter) — 이 봇을 트리거하는 GitHub Pages 블로그 템플릿
