# quiz-publish-bot

블로그 포스트 발행을 퀴즈로 통제하는 Telegram 봇. 초안 push → 퀴즈 → 통과 → 자동 발행.

[blog-starter](https://github.com/YOUR_USERNAME/blog-starter)와 함께 사용합니다.

---

## 동작 방식

```
blog-starter: drafts/post.md push
  ↓
GitHub Actions: OpenAI로 퀴즈 생성 → Cloudflare KV 저장
  ↓
quiz-publish-bot (Cloudflare Worker)
  → 오후 6시 KST: Telegram으로 퀴즈 전송
  → 70점 이상 통과: 다음날 오전 8시 자동 발행
  → 미통과: 30분 후 재시도
  → 미응시: 1시간마다 알림, /postpone으로 내일로 미루기
```

---

## ⚠️ 보안 — 시작 전 반드시 읽기

**토큰을 코드나 설정 파일에 직접 붙여넣지 마세요.**

모든 시크릿은 Cloudflare Worker 환경변수에만 저장해야 합니다. `wrangler.jsonc`에 넣거나 `.env` 파일을 git에 커밋하면 절대 안 됩니다.

토큰을 실수로 커밋했다면:
1. 즉시 해당 서비스에서 토큰 폐기
2. 새 토큰 발급
3. git 히스토리에서 제거

자세한 내용 → [docs/security.md](docs/security.md)

---

## 필요한 것

| 도구 | 버전 | 설치 |
|------|------|------|
| Node.js | 18 이상 | [nodejs.org](https://nodejs.org) |
| Wrangler CLI | 최신 | `npm install -g wrangler` |
| Cloudflare 계정 | 무료 | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) |
| Telegram Bot | — | [@BotFather](https://t.me/BotFather) |
| OpenAI API 키 | — | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| GitHub PAT | repo 권한 | [github.com/settings/tokens](https://github.com/settings/tokens) |

---

## 시작하기

전체 단계별 가이드 → **[SETUP.ko.md](SETUP.ko.md)** (Mac / Windows 각각 안내)

---

## 환경변수

**Cloudflare Dashboard → Workers & Pages → quiz-publish-bot → Settings → Variables** 에서 설정합니다.

| 변수 | 설명 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | @BotFather에서 발급한 토큰 |
| `OPENAI_API_KEY` | 서술형 채점용 |
| `GITHUB_TOKEN` | Personal Access Token (repo 권한) |
| `GITHUB_REPO` | `유저명/블로그-레포-이름` |

---

## 봇 명령어

| 명령어 | 설명 |
|--------|------|
| `/start` | 봇 상태 및 큐 확인 |
| `/postpone` 또는 `/미루기` | 현재 퀴즈를 내일 오후 6시로 미루기 |

---

## 설정 변경

**통과 점수:** `src/index.js` 상단의 `PASS_SCORE` 수정 (기본값: 70)

**퀴즈 시간:** `wrangler.jsonc`의 cron 표현식 수정
- `0 9 * * *` = 오후 6시 KST (퀴즈 전송)
- `0 23 * * *` = 다음날 오전 8시 KST (발행)

**큐 상한:** `blog-starter/scripts/generate-quiz.py`의 `QUEUE_MAX` 수정
