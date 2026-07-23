# 설치 가이드

> **⚠️ 보안 우선:** 실제 토큰을 git에 커밋하는 파일에 절대 붙여넣지 마세요.
> 모든 시크릿은 Cloudflare Worker 환경변수에만 저장합니다. [docs/security.md](docs/security.md) 참고.

---

## 1단계 — 필수 도구 설치

### Mac

```bash
# Homebrew 설치 (없으면)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node

# Wrangler CLI 설치
npm install -g wrangler

# 확인
node --version   # 18 이상이어야 함
wrangler --version
```

### Windows

```powershell
# winget은 Windows 11에 기본 포함, 없으면 Microsoft Store에서 'App Installer' 설치

# Node.js 설치
winget install OpenJS.NodeJS.LTS

# 터미널 재시작 후 Wrangler 설치
npm install -g wrangler

# 확인
node --version
wrangler --version
```

---

## 2단계 — Telegram 봇 생성

1. Telegram에서 **@BotFather** 검색 → `/start`
2. `/newbot` 전송
3. 봇 이름 입력 (예: `내 퀴즈 봇`)
4. 봇 유저네임 입력 (반드시 `bot`으로 끝나야 함, 예: `myquiz_bot`)
5. **토큰** 복사 — `123456789:ABCdef...` 형태

> ⚠️ 이 토큰이 있으면 누구나 내 봇을 제어할 수 있습니다. Cloudflare 환경변수에만 저장하세요.

---

## 3단계 — OpenAI API 키 발급

1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) 접속
2. **Create new secret key** 클릭
3. 키 복사 — `sk-`로 시작

> ⚠️ 이 키는 한 번만 볼 수 있습니다. 즉시 안전한 곳에 저장하세요.

---

## 4단계 — GitHub Personal Access Token 발급

1. [github.com/settings/tokens](https://github.com/settings/tokens) 접속
2. **Generate new token (classic)** 클릭
3. 만료일 설정 (90일 권장)
4. **repo** 권한만 체크
5. **Generate token** 클릭 후 복사

> ⚠️ 이 토큰은 내 레포지토리에 쓰기 권한이 있습니다. 절대 커밋하지 마세요.

---

## 5단계 — Cloudflare 설정

### 계정 생성 및 KV 네임스페이스 만들기

1. [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 에서 무료 계정 생성
2. **Workers & Pages → KV** 이동
3. **Create namespace** 클릭
4. 이름을 `QUIZ_SESSIONS`으로 입력
5. **Namespace ID** 복사 (다음 단계에서 사용)

### Wrangler 로그인

```bash
wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 승인합니다.

---

## 6단계 — 프로젝트 설정

### Mac / Windows 동일

```bash
# 레포 클론
git clone https://github.com/YOUR_USERNAME/quiz-publish-bot.git
cd quiz-publish-bot
```

`wrangler.jsonc` 파일을 열어 `YOUR_KV_NAMESPACE_ID`를 5단계에서 복사한 ID로 교체합니다:

```jsonc
"kv_namespaces": [
  {
    "binding": "QUIZ_SESSIONS",
    "id": "여기에-KV-네임스페이스-ID-붙여넣기"
  }
]
```

---

## 7단계 — Cloudflare에 시크릿 추가

**.env 파일을 배포 시크릿으로 사용하지 마세요.**
Cloudflare 대시보드에서 직접 설정합니다:

1. **Workers & Pages → quiz-publish-bot → Settings → Variables** 이동
2. 각 변수를 추가하고 **Encrypt** 클릭:

| 변수 | 값 |
|------|-----|
| `TELEGRAM_BOT_TOKEN` | 2단계에서 받은 토큰 |
| `OPENAI_API_KEY` | 3단계에서 받은 키 |
| `GITHUB_TOKEN` | 4단계에서 받은 토큰 |
| `GITHUB_REPO` | `유저명/블로그-레포-이름` |

---

## 8단계 — 배포

```bash
wrangler deploy
```

정상 출력:
```
✅ Deployed quiz-publish-bot to https://quiz-publish-bot.YOUR_SUBDOMAIN.workers.dev
```

---

## 9단계 — Telegram Webhook 등록

`YOUR_BOT_TOKEN`과 `YOUR_WORKER_URL`을 실제 값으로 교체하세요.

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

## 10단계 — 테스트

1. Telegram에서 내 봇 검색 → `/start` 전송
2. 이런 응답이 오면 성공: `Quiz bot ready — Queue: 0 items — No active quiz`

**완료!** 이제 [blog-starter](https://github.com/YOUR_USERNAME/blog-starter)를 설정해서 블로그 발행을 시작하세요.
