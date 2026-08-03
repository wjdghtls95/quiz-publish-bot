# quiz-publish-bot

[🇺🇸 English](../README.md)

> 블로그 발행 알림과 발행 후 7일 복습을 담당하는 Cloudflare Worker Telegram 봇.
> 글 작성 → 발행 → 7일 후 Telegram으로 개념 재설명 요청.

---

## 동작 방식

```
drafts/에 글 저장 후 push
    ↓
publish.yml 트리거 → GitHub Actions 빌드 + 배포
    ↓  ← 이 봇이 아래를 처리
Telegram: 발행 완료 알림 + 링크
    ↓
7일 후: Telegram이 "이 개념을 다시 설명해보세요" 질문
    ↓
텍스트 답변 → 복습 완료
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

한국어·영어 명령어가 항상 동시에 작동합니다. 기본 언어는 한국어 — `/lang en`으로 변경 가능.

| 한국어 | 영어 | 설명 |
|--------|------|------|
| `/start` | `/start` | 봇 상태 및 큐 확인 |
| `/퀴즈` | `/quiz` | 지금 바로 퀴즈 시작 (18:00 크론 기다리지 않고) |
| `/건너뛰기` | `/skip` | 퀴즈 스킵 → 내일 08:00 발행 예약 |
| `/발행` | `/publish` | 즉시 발행 (퀴즈 통과 or 건너뛰기 후) |
| `/미루기` | `/postpone` | 오늘 퀴즈를 내일 18:00으로 미루기 |
| `/큐` | `/queue` | 대기 중인 초안 목록 (번호 포함) |
| `/먼저 N` | `/first N` | N번 초안을 맨 앞으로 이동 (예: `/먼저 2`) |
| `/언어 ko\|en` | `/lang ko\|en` | 봇 언어 변경 (`/언어 en` 또는 `/언어 ko`) |

### Telegram 명령어 자동 등록

수동 설정 불필요. 봇에게 `/start`를 보내면 `/` 자동완성 목록이 자동으로 등록됩니다. `/언어 en`으로 언어를 변경하면 자동완성도 즉시 영어로 갱신됩니다.

---

## 문서

- [SETUP.md](SETUP.md) — 상세 설치 가이드 (영어)
- [SETUP.ko.md](SETUP.ko.md) — 상세 설치 가이드 (한국어)
- [security.md](security.md) — 토큰 보안 규칙

---

## 관련 레포

- [blog-starter](https://github.com/wjdghtls95/blog-starter) — 이 봇을 트리거하는 GitHub Pages 블로그 템플릿
