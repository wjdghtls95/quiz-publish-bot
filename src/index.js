const PASS_SCORE = 70;
const CATEGORY_ORDER = ['learning', 'project', 'devlog'];

function sortQueue(queue, lastCategory) {
  if (!queue.length) return queue;
  let ordered = [...CATEGORY_ORDER];
  if (lastCategory && CATEGORY_ORDER.includes(lastCategory)) {
    const start = (CATEGORY_ORDER.indexOf(lastCategory) + 1) % CATEGORY_ORDER.length;
    ordered = [...CATEGORY_ORDER.slice(start), ...CATEGORY_ORDER.slice(0, start)];
  }
  return [...queue].sort((a, b) => {
    const ai = ordered.indexOf(a.category || 'learning');
    const bi = ordered.indexOf(b.category || 'learning');
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return (a.part || 99) - (b.part || 99);
  });
}

// KV 키 목록
// 'USER_CHAT_ID'        → 유저 Telegram chat ID (첫 /start 시 저장)
// 'PENDING_QUEUE'       → [{file, title, quizKey}] 대기 큐 (최대 5개)
// 'NEXT_QUIZ_DATE'      → "2026-07-22" (KST) 다음 퀴즈 시작 예정일
// 'SCHEDULE_STATE'      → 현재 스케줄 상태 JSON
// 'BOT_LANG'            → 'ko' (기본) | 'en' — /lang 명령어로 변경
// 'pending_quiz_{key}'  → 퀴즈 데이터 (Python이 저장, Worker가 읽음)
// '{chatId}'            → 활성 퀴즈 세션 (기존 형식)

// ===== i18n =====
// 언어 우선순위: KV 'BOT_LANG' → env.BOT_LANG → 'ko'
// 변경: /lang ko | /lang en (재배포 불필요)

const MESSAGES = {
  ko: {
    start: (q, state, title) =>
      `퀴즈 봇 준비됐습니다 📚\n큐 대기: ${q}개\n` +
      (state ? `현재 상태: ${state} — ${title}` : '진행 중인 퀴즈 없음'),
    langCurrent: (label) => `현재 언어: ${label}\n/lang en 또는 /lang ko 로 변경 가능`,
    langChanged: (label) => `언어를 ${label}으로 변경했습니다`,
    langInvalid: '/lang ko 또는 /lang en 을 입력해주세요',
    postponeNone: '현재 진행 중인 퀴즈가 없습니다',
    postponeDone: (title) => `⏭️ 내일 오후 6시로 미뤘습니다\n_${title}_`,
    quizActive: (title) => `📝 *${title}* 퀴즈 진행 중입니다`,
    quizEmpty: '대기 중인 글이 없습니다\ndrafts/ 에 초안을 push해주세요',
    quizExpired: '⚠️ 퀴즈 데이터가 만료됐습니다. drafts/에 다시 push해주세요',
    quizStart: (title) => `📝 *퀴즈 시작: ${title}*\n\n글을 잘 읽었는지 확인해볼게요`,
    skipNone: '현재 진행 중인 퀴즈가 없습니다',
    skipDone: (title) => `⏭️ 퀴즈 건너뛰었습니다\n내일 오전 8시에 게시됩니다 🚀\n_${title}_`,
    publishNone: '진행 중인 퀴즈가 없습니다',
    publishNotPassed: (s) => `현재 상태: ${s}\n퀴즈를 통과하거나 /건너뛰기 후 사용하세요`,
    publishDone: (title) => `🚀 즉시 게시했습니다!\n_${title}_`,
    queueEmpty: '대기 중인 글이 없습니다',
    queueList: (items) =>
      `📋 *대기 목록 (${items.length}개)*\n\n` +
      items.map((it, i) => `${i + 1}. ${it.title}`).join('\n') +
      '\n\n순서 변경: /먼저 N  (예: /먼저 2)',
    firstUsage: '/먼저 N — 숫자를 입력하세요  (예: /먼저 2)',
    firstRange: (n, max) => `${n}번 항목이 없습니다 (1~${max})`,
    firstAlready: '이미 1번입니다',
    firstDone: (title) => `✅ "${title}" 를 1번으로 이동했습니다`,
    scheduledStart: (title) => `📝 *퀴즈 시작: ${title}*\n\n글을 잘 읽었는지 확인해볼게요`,
    scheduledPublish: (title) => `🚀 게시됐습니다!\n_${title}_`,
    retryExpired: '⚠️ 퀴즈 데이터가 만료됐습니다. drafts/에 다시 push해주세요',
    retryStart: (n) => `🔄 *재시도 (${n}회차)*\n처음부터 다시 시작합니다`,
    reminder: '⏰ 퀴즈가 아직 완료되지 않았습니다\n계속 답하거나 /미루기 로 내일로 미룰 수 있습니다',
    mcLabel: (done, total, diff) => `*Q${done}/${total} [${diff}] (객관식)*`,
    essayLabel: (done, total, diff) => `*서술형 ${done}/${total} [${diff}]*`,
    essayHint: '_자유롭게 답변해주세요_',
    essayModelAnswer: answer => `📖 *모범 답안*\n\n${answer}\n\n이 내용을 이해했나요?`,
    essaySelfYes: '✅ 이해했어요',
    essaySelfNo: '❌ 다시 볼게요',
    essaySelfYesCb: '✅ 이해한 것으로 기록됨',
    essaySelfNoCb: '❌ 재검토 항목으로 기록됨',
    modelAnswerLabel: '모범 답안',
    passed: (pct, c, tot) => `✅ *${pct}점 통과!* (${c}/${tot})\n\n내일 오전 8시에 게시됩니다 🚀`,
    failedHeader: (pct, c, tot) => `❌ *${pct}점 — 70점 미달* (${c}/${tot})\n\n*틀린 문제:*\n\n`,
    sectionWord: '섹션',
    correctLabel: '정답',
    yourAnswerLabel: '내 답',
    wrongEssayHint: '→ 이 섹션 내용을 다시 읽고 핵심 개념을 정리해보세요',
    reviewHeader: '📖 *다시 읽어볼 섹션:*\n',
    retryLater: '_30분 후 재시도됩니다_',
    cbSelected: (a) => `${a} 선택`,
  },
  en: {
    start: (q, state, title) =>
      `Quiz bot ready 📚\nQueue: ${q} item(s)\n` +
      (state ? `Current: ${state} — ${title}` : 'No active quiz'),
    langCurrent: (label) => `Current language: ${label}\nUse /lang ko or /lang en to change`,
    langChanged: (label) => `Language set to ${label}`,
    langInvalid: 'Use /lang ko or /lang en',
    postponeNone: 'No active quiz',
    postponeDone: (title) => `⏭️ Postponed to tomorrow 18:00\n_${title}_`,
    quizActive: (title) => `📝 *${title}* quiz in progress`,
    quizEmpty: 'No drafts in queue\nPush a file to drafts/ to get started',
    quizExpired: '⚠️ Quiz data expired. Push the draft again.',
    quizStart: (title) => `📝 *Quiz: ${title}*\n\nLet's check how well you read it`,
    skipNone: 'No active quiz',
    skipDone: (title) => `⏭️ Quiz skipped\nPublishing tomorrow at 08:00 🚀\n_${title}_`,
    publishNone: 'No active quiz',
    publishNotPassed: (s) => `Current state: ${s}\nPass the quiz or /skip first`,
    publishDone: (title) => `🚀 Published!\n_${title}_`,
    queueEmpty: 'No drafts in queue',
    queueList: (items) =>
      `📋 *Queue (${items.length})*\n\n` +
      items.map((it, i) => `${i + 1}. ${it.title}`).join('\n') +
      '\n\nReorder: /first N  (e.g. /first 2)',
    firstUsage: '/first N — provide a number  (e.g. /first 2)',
    firstRange: (n, max) => `Item ${n} not found (1~${max})`,
    firstAlready: 'Already #1',
    firstDone: (title) => `✅ "${title}" moved to #1`,
    scheduledStart: (title) => `📝 *Quiz: ${title}*\n\nLet's check how well you read it`,
    scheduledPublish: (title) => `🚀 Published!\n_${title}_`,
    retryExpired: '⚠️ Quiz data expired. Push the draft again.',
    retryStart: (n) => `🔄 *Retry #${n}*\nStarting from the beginning`,
    reminder: '⏰ Quiz not yet completed\nContinue or use /postpone to delay until tomorrow',
    mcLabel: (done, total, diff) => `*Q${done}/${total} [${diff}] (Multiple Choice)*`,
    essayLabel: (done, total, diff) => `*Essay ${done}/${total} [${diff}]*`,
    essayHint: '_Answer freely_',
    essayModelAnswer: answer => `📖 *Model Answer*\n\n${answer}\n\nDid you understand this?`,
    essaySelfYes: '✅ Got it',
    essaySelfNo: '❌ Need to review',
    essaySelfYesCb: '✅ Marked as understood',
    essaySelfNoCb: '❌ Marked for review',
    modelAnswerLabel: 'Model answer',
    passed: (pct, c, tot) => `✅ *${pct}% — Passed!* (${c}/${tot})\n\nPublishing tomorrow at 08:00 🚀`,
    failedHeader: (pct, c, tot) => `❌ *${pct}% — Below 70%* (${c}/${tot})\n\n*Wrong answers:*\n\n`,
    sectionWord: 'section',
    correctLabel: 'Correct',
    yourAnswerLabel: 'Your answer',
    wrongEssayHint: '→ Re-read this section and review the key concepts',
    reviewHeader: '📖 *Sections to review:*\n',
    retryLater: '_Retrying in 30 minutes_',
    cbSelected: (a) => `Selected ${a}`,
  },
};

// KV 'BOT_LANG' → env.BOT_LANG → 'ko' 순서로 읽음
async function getLang(env) {
  const stored = await env.QUIZ_SESSIONS.get('BOT_LANG');
  if (stored === 'en' || stored === 'ko') return stored;
  return env.BOT_LANG === 'en' ? 'en' : 'ko';
}

function msgs(lang) {
  return MESSAGES[lang] ?? MESSAGES.ko;
}

const LANG_LABELS = { ko: '한국어 🇰🇷', en: 'English 🇺🇸' };

// 한국어 명령어 → 영어 정규 명령어로 정규화
const CMD_ALIASES = {
  '/퀴즈': '/quiz',
  '/건너뛰기': '/skip',
  '/발행': '/publish',
  '/미루기': '/postpone',
  '/큐': '/queue',
  '/언어': '/lang',
  '/상태': '/status',
};

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('OK');
    const body = await request.json();
    if (body.callback_query) await handleCallbackQuery(body.callback_query, env);
    else if (body.message?.text) await handleMessage(body.message, env);
    return new Response('OK');
  },

  async scheduled(event, env) {
    if (event.cron === '0 9 * * *') await handleQuizStart(env);
    else if (event.cron === '0 23 * * *') await handlePublish(env);
    else await handleRetryAndReminder(env);
  },
};

// ===== Scheduled Handlers =====

// 09:00 UTC (18:00 KST) — 퀴즈 시작
async function handleQuizStart(env) {
  const state = await getScheduleState(env);
  if (state && ['quiz_active', 'failed', 'no_show'].includes(state.state)) return;

  const today = getKSTDateString();
  const nextQuizDate = await env.QUIZ_SESSIONS.get('NEXT_QUIZ_DATE');
  if (nextQuizDate && nextQuizDate > today) return;

  const queue = await getPendingQueue(env);
  if (queue.length === 0) return;

  const item = queue.shift();
  await savePendingQueue(queue, env);

  const chatId = await env.QUIZ_SESSIONS.get('USER_CHAT_ID');
  if (!chatId) return;

  const quizRaw = await env.QUIZ_SESSIONS.get(item.quizKey);
  if (!quizRaw) {
    // 만료된 퀴즈 — 사용자에게 알림
    const lang = await getLang(env);
    await sendTelegram(chatId, msgs(lang).quizExpired, env.TELEGRAM_BOT_TOKEN);
    return;
  }

  const quiz = JSON.parse(quizRaw);
  quiz.userAnswers = {};
  quiz.essayGrades = {};

  await env.QUIZ_SESSIONS.put(chatId, JSON.stringify(quiz), { expirationTtl: 86400 });
  await saveScheduleState({
    file: item.file,
    title: item.title,
    quizKey: item.quizKey,
    category: item.category || 'learning',
    state: 'quiz_active',
    retryCount: 0,
    lastActivityAt: Date.now(),
    lastReminderAt: null,
  }, env);

  const lang = await getLang(env);
  const token = env.TELEGRAM_BOT_TOKEN;
  await sendTelegram(chatId, msgs(lang).scheduledStart(item.title), token);
  await sendNext(chatId, quiz, token, lang, env);
}

// 23:00 UTC (08:00 KST) — 발행
async function handlePublish(env) {
  const state = await getScheduleState(env);
  if (!state || state.state !== 'passed') return;
  if (state.publishDate !== getKSTDateString()) return;

  const chatId = await env.QUIZ_SESSIONS.get('USER_CHAT_ID');
  await triggerPublish(state.file, env);
  await env.QUIZ_SESSIONS.put('LAST_PUBLISHED_CATEGORY', state.category || 'learning');
  await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');

  if (chatId) {
    const lang = await getLang(env);
    await sendTelegram(chatId, msgs(lang).scheduledPublish(state.title), env.TELEGRAM_BOT_TOKEN);
  }
}

// 30분마다 — 재시도 및 미응시 알림
async function handleRetryAndReminder(env) {
  const state = await getScheduleState(env);
  if (!state) return;

  const chatId = await env.QUIZ_SESSIONS.get('USER_CHAT_ID');
  if (!chatId) return;

  const token = env.TELEGRAM_BOT_TOKEN;
  const now = Date.now();
  const lang = await getLang(env);
  const m = msgs(lang);

  if (state.state === 'failed' && now >= state.retryAt) {
    let session = await getSession(chatId, env);
    if (!session) {
      const quizRaw = await env.QUIZ_SESSIONS.get(state.quizKey);
      if (!quizRaw) {
        await sendTelegram(chatId, m.retryExpired, token);
        await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');
        return;
      }
      session = JSON.parse(quizRaw);
    }
    session.userAnswers = {};
    session.essayGrades = {};
    await saveSession(chatId, session, env);
    await saveScheduleState({ ...state, state: 'quiz_active', lastActivityAt: now, lastReminderAt: null }, env);
    await sendTelegram(chatId, m.retryStart(state.retryCount), token);
    await sendNext(chatId, session, token, lang, env);
    return;
  }

  if (state.state === 'quiz_active' || state.state === 'no_show') {
    const timeSinceActivity = now - (state.lastActivityAt ?? now);
    const timeSinceReminder = state.lastReminderAt ? now - state.lastReminderAt : Infinity;

    if (timeSinceActivity >= 60 * 60 * 1000 && timeSinceReminder >= 60 * 60 * 1000) {
      await sendTelegram(chatId, m.reminder, token);
      await saveScheduleState({ ...state, state: 'no_show', lastReminderAt: now }, env);
    }
  }
}

// ===== Telegram Message Handlers =====

async function handleCallbackQuery(query, env) {
  const chatId = query.message.chat.id.toString();
  const token = env.TELEGRAM_BOT_TOKEN;
  const data = JSON.parse(query.data);
  const lang = await getLang(env);
  const m = msgs(lang);

  // 개선 제안 승인/거절 버튼 — 퀴즈 세션 없어도 처리 (session check 전에)
  if (data.a === 'approve') {
    const pendingKey = `pending_approval_${data.k}`;
    const raw = await env.QUIZ_SESSIONS.get(pendingKey);
    if (!raw) {
      await answerCallbackQuery(query.id, '⚠️ 데이터가 만료됐습니다. 다시 push해주세요', token);
      return;
    }
    const result = JSON.parse(raw);
    await env.QUIZ_SESSIONS.delete(pendingKey);

    const queueRaw = await env.QUIZ_SESSIONS.get('PENDING_QUEUE');
    const queue = queueRaw ? JSON.parse(queueRaw) : [];
    const quizKey = `pending_quiz_${data.k}`;

    await env.QUIZ_SESSIONS.put(quizKey, JSON.stringify({
      title: result.title,
      questions: result.questions,
      draftFile: result.file || result.draftFile,
      userAnswers: {},
    }), { expirationTtl: 7 * 86400 });

    queue.push({
      file: result.file || result.draftFile,
      title: result.title,
      quizKey,
      category: result.category || 'learning',
      tags: result.tags || [],
      series: result.series || null,
      part: result.part || null,
    });
    const lastCategory = await env.QUIZ_SESSIONS.get('LAST_PUBLISHED_CATEGORY');
    const sortedQueue = sortQueue(queue, lastCategory);
    await env.QUIZ_SESSIONS.put('PENDING_QUEUE', JSON.stringify(sortedQueue));

    const existingDate = await env.QUIZ_SESSIONS.get('NEXT_QUIZ_DATE');
    const nextDate = existingDate || getKSTDateString();
    if (!existingDate) await env.QUIZ_SESSIONS.put('NEXT_QUIZ_DATE', nextDate);

    const queuePos = sortedQueue.findIndex(q => q.quizKey === quizKey) + 1;
    const studyLine = result.study ? `\n📚 *퀴즈 전에 읽어보세요:*\n  \`${result.study}\`` : '';

    await answerCallbackQuery(query.id, '✅ 큐에 등록됐습니다', token);
    await sendTelegram(chatId,
      `📥 *퀴즈 등록됐습니다*\n\n제목: _${result.title}_${studyLine}\n📋 큐 순서: ${queuePos}/${sortedQueue.length}\n퀴즈 예정: ${nextDate} 18:00 KST`,
      token
    );
    return;
  }

  if (data.a === 'reject') {
    const pendingKey = `pending_approval_${data.k}`;
    const raw = await env.QUIZ_SESSIONS.get(pendingKey);
    const draftFile = raw ? (JSON.parse(raw).file || JSON.parse(raw).draftFile) : null;
    await env.QUIZ_SESSIONS.delete(pendingKey);

    // REVISION_LIST에 추가 → 다음 cron 실행 시 .processed-drafts에서 제거해 재처리
    if (draftFile) {
      const listRaw = await env.QUIZ_SESSIONS.get('REVISION_LIST');
      const revList = listRaw ? JSON.parse(listRaw) : [];
      if (!revList.includes(draftFile)) revList.push(draftFile);
      await env.QUIZ_SESSIONS.put('REVISION_LIST', JSON.stringify(revList), { expirationTtl: 7 * 86400 });
    }

    await answerCallbackQuery(query.id, '✏️ 파일 수정 후 내일 7:30에 자동 재처리', token);
    await sendTelegram(chatId,
      `✏️ *수정 모드*\n\n\`${draftFile || '파일'}\` 수정하면 됩니다\n\npush 불필요 — 내일 7:30 AM에 자동으로 재처리됩니다`,
      token
    );
    return;
  }

  // 이하 퀴즈 관련 — 세션 필요
  const session = await getSession(chatId, env);
  if (!session) return;

  if (data.eg !== undefined) {
    // 서술형 자가 채점 버튼
    await answerCallbackQuery(query.id, data.eg ? m.essaySelfYesCb : m.essaySelfNoCb, token);
    session.essayGrades = session.essayGrades ?? {};
    session.essayGrades[data.q] = data.eg === 1;
  } else {
    // 객관식 선택 버튼
    await answerCallbackQuery(query.id, m.cbSelected(data.a), token);
    session.userAnswers[data.q] = data.a;
  }

  await saveSession(chatId, session, env);

  const schedState = await getScheduleState(env);
  if (schedState && ['quiz_active', 'no_show'].includes(schedState.state)) {
    await saveScheduleState({ ...schedState, state: 'quiz_active', lastActivityAt: Date.now(), lastReminderAt: null }, env);
  }

  await sendNext(chatId, session, token, lang, env);
}

async function handleMessage(message, env) {
  const chatId = message.chat.id.toString();
  const token = env.TELEGRAM_BOT_TOKEN;
  const rawText = (message.text ?? '').trim();

  // 한국어 명령어를 영어 정규 명령어로 정규화
  const text = CMD_ALIASES[rawText] ?? rawText;

  await env.QUIZ_SESSIONS.put('USER_CHAT_ID', chatId);

  const lang = await getLang(env);
  const m = msgs(lang);

  if (text === '/start') {
    const queue = await getPendingQueue(env);
    const state = await getScheduleState(env);
    await Promise.all([
      sendTelegram(chatId, m.start(queue.length, state?.state, state?.title), token),
      registerCommands(token, lang),
    ]);
    return;
  }

  // /lang [ko|en] 또는 /언어 [ko|en]
  if (text === '/lang' || rawText === '/언어') {
    await sendTelegram(chatId, m.langCurrent(LANG_LABELS[lang]), token);
    return;
  }

  const langMatch = rawText.match(/^\/(?:lang|언어)\s+(ko|en)$/i);
  if (langMatch) {
    const newLang = langMatch[1].toLowerCase();
    await env.QUIZ_SESSIONS.put('BOT_LANG', newLang);
    await Promise.all([
      sendTelegram(chatId, msgs(newLang).langChanged(LANG_LABELS[newLang]), token),
      registerCommands(token, newLang),
    ]);
    return;
  }

  if (rawText.match(/^\/(?:lang|언어)\s+\S+/)) {
    await sendTelegram(chatId, m.langInvalid, token);
    return;
  }

  if (text === '/postpone') {
    const schedState = await getScheduleState(env);
    if (!schedState || !['quiz_active', 'failed', 'no_show'].includes(schedState.state)) {
      await sendTelegram(chatId, m.postponeNone, token);
      return;
    }

    const queue = await getPendingQueue(env);
    const session = await getSession(chatId, env);

    if (session) {
      session.userAnswers = {};
      session.essayGrades = {};
      await env.QUIZ_SESSIONS.put(schedState.quizKey, JSON.stringify(session), { expirationTtl: 7 * 86400 });
    }

    queue.unshift({ file: schedState.file, title: schedState.title, quizKey: schedState.quizKey });
    await savePendingQueue(queue, env);
    await env.QUIZ_SESSIONS.put('NEXT_QUIZ_DATE', getKSTDateString(1));
    await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');
    await env.QUIZ_SESSIONS.delete(chatId);

    await sendTelegram(chatId, m.postponeDone(schedState.title), token);
    return;
  }

  if (text === '/quiz') {
    const existingState = await getScheduleState(env);
    if (existingState && ['quiz_active', 'no_show'].includes(existingState.state)) {
      const session = await getSession(chatId, env);
      if (session) {
        await sendTelegram(chatId, m.quizActive(existingState.title), token);
        await sendNext(chatId, session, token, lang, env);
        return;
      }
    }

    const queue = await getPendingQueue(env);
    if (queue.length === 0) {
      await sendTelegram(chatId, m.quizEmpty, token);
      return;
    }

    const item = queue.shift();
    await savePendingQueue(queue, env);

    const quizRaw = await env.QUIZ_SESSIONS.get(item.quizKey);
    if (!quizRaw) {
      await sendTelegram(chatId, m.quizExpired, token);
      return;
    }

    const quiz = JSON.parse(quizRaw);
    quiz.userAnswers = {};
    quiz.essayGrades = {};

    await env.QUIZ_SESSIONS.put(chatId, JSON.stringify(quiz), { expirationTtl: 86400 });
    await saveScheduleState({
      file: item.file,
      title: item.title,
      quizKey: item.quizKey,
      category: item.category || 'learning',
      state: 'quiz_active',
      retryCount: 0,
      lastActivityAt: Date.now(),
      lastReminderAt: null,
    }, env);

    await sendTelegram(chatId, m.quizStart(item.title), token);
    await sendNext(chatId, quiz, token, lang, env);
    return;
  }

  if (text === '/skip') {
    const schedState = await getScheduleState(env);
    if (!schedState) {
      await sendTelegram(chatId, m.skipNone, token);
      return;
    }

    const publishDate = getKSTDateString(1);
    await saveScheduleState({ ...schedState, state: 'passed', publishDate, lastActivityAt: Date.now() }, env);
    await env.QUIZ_SESSIONS.put('NEXT_QUIZ_DATE', getKSTDateString(2));
    await env.QUIZ_SESSIONS.put('LAST_PUBLISHED_CATEGORY', schedState.category || 'learning');
    await env.QUIZ_SESSIONS.delete(chatId);
    await sendTelegram(chatId, m.skipDone(schedState.title), token);
    return;
  }

  if (text === '/publish') {
    const schedState = await getScheduleState(env);
    if (!schedState || schedState.state !== 'passed') {
      const hint = schedState ? m.publishNotPassed(schedState.state) : m.publishNone;
      await sendTelegram(chatId, hint, token);
      return;
    }

    await triggerPublish(schedState.file, env);
    await env.QUIZ_SESSIONS.put('LAST_PUBLISHED_CATEGORY', schedState.category || 'learning');
    await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');
    await sendTelegram(chatId, m.publishDone(schedState.title), token);
    return;
  }

  if (text === '/queue') {
    const queue = await getPendingQueue(env);
    if (queue.length === 0) {
      await sendTelegram(chatId, m.queueEmpty, token);
      return;
    }
    await sendTelegram(chatId, m.queueList(queue), token);
    return;
  }

  if (text === '/error') {
    const raw = await env.QUIZ_SESSIONS.get('LAST_ERROR');
    if (!raw) {
      await sendTelegram(chatId, '✅ 최근 에러 없음', token);
      return;
    }
    const err = JSON.parse(raw);
    if (!err.time || !err.message) {
      await sendTelegram(chatId, '✅ 최근 에러 없음', token);
      return;
    }
    await sendTelegram(chatId, `🔴 *마지막 에러*\n\n🕐 ${err.time}\n\n\`\`\`\n${err.message}\n\`\`\``, token);
    return;
  }

  if (text === '/status') {
    const [queueRaw, stateRaw, errorRaw, nextDate] = await Promise.all([
      env.QUIZ_SESSIONS.get('PENDING_QUEUE'),
      env.QUIZ_SESSIONS.get('SCHEDULE_STATE'),
      env.QUIZ_SESSIONS.get('LAST_ERROR'),
      env.QUIZ_SESSIONS.get('NEXT_QUIZ_DATE'),
    ]);

    const queue = queueRaw ? JSON.parse(queueRaw) : [];
    const state = stateRaw ? JSON.parse(stateRaw) : null;
    const err = errorRaw ? JSON.parse(errorRaw) : null;

    // 큐 섹션
    const queueSection = queue.length === 0
      ? '없음'
      : queue.map((it, i) => `  ${i + 1}. _${it.title}_ (${it.category ?? '?'})`).join('\n');

    // 현재 퀴즈 섹션
    let quizSection = '없음';
    if (state) {
      const stateLabel = {
        quiz_active: '진행 중',
        passed: '통과 ✅',
        failed: '실패 — 재시도 대기',
        no_show: '미응시',
      }[state.state] ?? state.state;
      quizSection = `_${state.title}_\n  상태: ${stateLabel}`;
      if (state.publishDate) quizSection += `\n  발행 예정: ${state.publishDate} 08:00 KST`;
    }

    // 다음 퀴즈 예정일
    const nextSection = nextDate ? `${nextDate} 18:00 KST` : '미정';

    // 에러 섹션
    const errSection = (err?.time && err?.message)
      ? `🔴 ${err.time}\n  \`${err.message.slice(0, 80)}${err.message.length > 80 ? '...' : ''}\``
      : '없음 ✅';

    await sendTelegram(
      chatId,
      `📊 *블로그 현황*\n\n` +
      `📋 *대기 큐* (${queue.length}개)\n${queueSection}\n\n` +
      `🎯 *현재 퀴즈*\n  ${quizSection}\n\n` +
      `📅 *다음 퀴즈 예정*\n  ${nextSection}\n\n` +
      `⚠️ *마지막 에러*\n  ${errSection}`,
      token,
    );
    return;
  }

  // /먼저 N 또는 /first N — 큐 순서 변경
  const firstMatch = rawText.match(/^\/(?:먼저|first)\s+(\d+)$/);
  if (firstMatch) {
    const n = parseInt(firstMatch[1], 10);
    const queue = await getPendingQueue(env);

    if (queue.length === 0) {
      await sendTelegram(chatId, m.queueEmpty, token);
      return;
    }
    if (n < 1 || n > queue.length) {
      await sendTelegram(chatId, m.firstRange(n, queue.length), token);
      return;
    }
    if (n === 1) {
      await sendTelegram(chatId, m.firstAlready, token);
      return;
    }

    const [item] = queue.splice(n - 1, 1);
    queue.unshift(item);
    await savePendingQueue(queue, env);
    await sendTelegram(chatId, m.firstDone(item.title), token);
    return;
  }

  // 서술형 답변 처리
  const session = await getSession(chatId, env);
  if (!session) return;

  const mcTotal = session.questions.filter(q => q.type === 'multiple').length;
  const mcDone = Object.keys(session.userAnswers).filter(k => session.questions[+k]?.type === 'multiple').length;
  if (mcDone < mcTotal) return;

  const idx = findPendingEssayText(session);
  if (idx === null) return;

  session.userAnswers[idx] = rawText;
  await saveSession(chatId, session, env);

  const schedState = await getScheduleState(env);
  if (schedState && ['quiz_active', 'no_show'].includes(schedState.state)) {
    await saveScheduleState({ ...schedState, state: 'quiz_active', lastActivityAt: Date.now(), lastReminderAt: null }, env);
  }

  // 모범 답안 + 자가 채점 버튼
  const q = session.questions[idx];
  const buttons = [[
    { text: m.essaySelfYes, callback_data: JSON.stringify({ q: idx, eg: 1 }) },
    { text: m.essaySelfNo, callback_data: JSON.stringify({ q: idx, eg: 0 }) },
  ]];
  await sendTelegram(chatId, m.essayModelAnswer(q.modelAnswer ?? '—'), token, { inline_keyboard: buttons });
}

// ===== Quiz Flow =====

async function sendNext(chatId, session, token, lang, env) {
  const questions = session.questions;
  const mcTotal = questions.filter(q => q.type === 'multiple').length;
  const essayTotal = questions.filter(q => q.type === 'essay').length;
  const m = msgs(lang);

  const nextMC = findPending(session, 'multiple');
  if (nextMC !== null) {
    const q = questions[nextMC];
    const mcDone = Object.keys(session.userAnswers).filter(k => questions[+k]?.type === 'multiple').length;
    const buttons = q.options.map(opt => [{ text: opt, callback_data: JSON.stringify({ q: nextMC, a: opt[0] }) }]);
    await sendTelegram(chatId, `${m.mcLabel(mcDone + 1, mcTotal, q.difficulty)}\n\n${q.q}`, token, { inline_keyboard: buttons });
    return;
  }

  const nextEssayText = findPendingEssayText(session);
  if (nextEssayText !== null) {
    const q = questions[nextEssayText];
    const essayGrades = session.essayGrades ?? {};
    const essayDone = Object.keys(essayGrades).filter(k => questions[+k]?.type === 'essay').length;
    await sendTelegram(chatId, `${m.essayLabel(essayDone + 1, essayTotal, q.difficulty)}\n\n${q.q}\n\n${m.essayHint}`, token);
    return;
  }

  const nextEssayGrade = findPendingEssayGrade(session);
  if (nextEssayGrade !== null) {
    const q = questions[nextEssayGrade];
    const buttons = [[
      { text: m.essaySelfYes, callback_data: JSON.stringify({ q: nextEssayGrade, eg: 1 }) },
      { text: m.essaySelfNo, callback_data: JSON.stringify({ q: nextEssayGrade, eg: 0 }) },
    ]];
    await sendTelegram(chatId, m.essayModelAnswer(q.modelAnswer ?? '—'), token, { inline_keyboard: buttons });
    return;
  }

  await grade(chatId, session, token, lang, env);
}

async function grade(chatId, session, token, lang, env) {
  const questions = session.questions;
  const essayGrades = session.essayGrades ?? {};
  let correct = 0;
  const wrong = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = session.userAnswers[i];
    if (q.type === 'multiple') {
      if (ans === q.answer) correct++;
      else {
        const correctFull = q.options.find(o => o[0] === q.answer) ?? q.answer;
        const userFull = q.options.find(o => o[0] === ans) ?? (ans ?? '미응답');
        wrong.push({ section: q.section, q: q.q, correct: correctFull, user: userFull });
      }
    } else {
      if (essayGrades[i] === true) correct++;
      else wrong.push({ section: q.section, q: q.q, modelAnswer: q.modelAnswer, essay: true });
    }
  }

  const percent = Math.round((correct / questions.length) * 100);
  const schedState = await getScheduleState(env);
  const m = msgs(lang);

  if (percent >= PASS_SCORE) {
    const publishDate = getKSTDateString(1);
    await saveScheduleState({ ...schedState, state: 'passed', publishDate, lastActivityAt: Date.now() }, env);
    await env.QUIZ_SESSIONS.put('NEXT_QUIZ_DATE', getKSTDateString(2));
    await env.QUIZ_SESSIONS.delete(chatId);
    await sendTelegram(chatId, m.passed(percent, correct, questions.length), token);
  } else {
    let msg = m.failedHeader(percent, correct, questions.length);
    wrong.forEach((w, i) => {
      msg += `${i + 1}. 📍 *[${w.section}]* ${m.sectionWord}\n`;
      msg += `   Q: ${w.q}\n`;
      if (w.correct) msg += `   ${m.correctLabel}: ${w.correct}\n   ${m.yourAnswerLabel}: ${w.user}\n`;
      if (w.essay) {
        if (w.modelAnswer) msg += `   📖 ${m.modelAnswerLabel}: ${w.modelAnswer}\n`;
        msg += `   ${m.wrongEssayHint}\n`;
      }
      msg += '\n';
    });
    const sections = [...new Set(wrong.map(w => w.section))];
    msg += m.reviewHeader;
    sections.forEach(s => (msg += `  • ${s}\n`));
    msg += '\n' + m.retryLater;

    session.userAnswers = {};
    session.essayGrades = {};
    await saveSession(chatId, session, env);
    await saveScheduleState({
      ...(schedState ?? { file: session.draftFile, title: session.title, quizKey: null }),
      state: 'failed',
      retryCount: (schedState?.retryCount ?? 0) + 1,
      retryAt: Date.now() + 30 * 60 * 1000,
      lastActivityAt: Date.now(),
    }, env);
    await sendTelegram(chatId, msg, token);
  }
}

// ===== KV State Helpers =====

async function getScheduleState(env) {
  const raw = await env.QUIZ_SESSIONS.get('SCHEDULE_STATE');
  return raw ? JSON.parse(raw) : null;
}

async function saveScheduleState(state, env) {
  await env.QUIZ_SESSIONS.put('SCHEDULE_STATE', JSON.stringify(state));
}

async function getPendingQueue(env) {
  const raw = await env.QUIZ_SESSIONS.get('PENDING_QUEUE');
  return raw ? JSON.parse(raw) : [];
}

async function savePendingQueue(queue, env) {
  await env.QUIZ_SESSIONS.put('PENDING_QUEUE', JSON.stringify(queue));
}

async function getSession(chatId, env) {
  const raw = await env.QUIZ_SESSIONS.get(chatId);
  return raw ? JSON.parse(raw) : null;
}

async function saveSession(chatId, session, env) {
  await env.QUIZ_SESSIONS.put(chatId, JSON.stringify(session), { expirationTtl: 86400 });
}

// ===== Date Helpers =====

// KST = UTC+9. daysOffset: 0=오늘, 1=내일, 2=모레
function getKSTDateString(daysOffset = 0) {
  const now = new Date();
  const kstMs = now.getTime() + (9 * 60 * 60 + daysOffset * 24 * 60 * 60) * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

// ===== Telegram Helpers =====

// Telegram setMyCommands는 [a-z0-9_]만 허용 — 한국어 명령어 이름 등록 불가
// 영문 명령어만 자동완성에 등록; /퀴즈 등 한국어 별칭은 타이핑 시 그대로 작동
async function registerCommands(token, lang) {
  const commands = lang === 'en'
    ? [
        { command: 'start',    description: 'Status + queue count' },
        { command: 'quiz',     description: 'Start quiz immediately' },
        { command: 'skip',     description: 'Skip quiz, publish tomorrow 08:00' },
        { command: 'publish',  description: 'Publish immediately' },
        { command: 'postpone', description: 'Postpone to tomorrow 18:00' },
        { command: 'status',   description: 'Show full bot status' },
        { command: 'queue',    description: 'Show pending drafts' },
        { command: 'first',    description: 'Reorder queue — /first 2' },
        { command: 'error',    description: 'Check last pipeline error' },
        { command: 'lang',     description: 'Switch language — /lang ko' },
      ]
    : [
        { command: 'start',    description: '봇 상태 및 큐 확인' },
        { command: 'status',   description: '전체 현황 — 큐/퀴즈/에러  (/상태 도 가능)' },
        { command: 'quiz',     description: '퀴즈 시작  (/퀴즈 도 가능)' },
        { command: 'skip',     description: '퀴즈 건너뛰기  (/건너뛰기 도 가능)' },
        { command: 'publish',  description: '즉시 발행  (/발행 도 가능)' },
        { command: 'postpone', description: '미루기  (/미루기 도 가능)' },
        { command: 'queue',    description: '대기 목록  (/큐 도 가능)' },
        { command: 'first',    description: '순서 변경 — /first 2  (/먼저 2 도 가능)' },
        { command: 'error',    description: '마지막 파이프라인 에러 확인' },
        { command: 'lang',     description: '언어 변경 — /lang en  (/언어 en 도 가능)' },
      ];

  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
}

// 코드블록(```)이 인접 Markdown 서식(*/_)과 섞이면 Telegram 파서가 실패함.
// 코드블록 앞뒤에 빈 줄을 강제하고, 코드블록이 있는 메시지는 Markdown 파싱을 끈다.
function prepareMessage(text) {
  const hasCodeBlock = /```/.test(text);
  if (!hasCodeBlock) return { text, parse_mode: 'Markdown' };

  // 코드블록 앞뒤 줄바꿈 보정
  const normalized = text
    .replace(/([^\n])(\n?```)/g, '$1\n\n```')
    .replace(/(```[^\n]*\n[\s\S]*?```)([^\n])/g, '$1\n\n$2');

  // 코드블록 있으면 parse_mode 제거 — 코드는 그대로, */_는 장식 없이 노출
  return { text: normalized, parse_mode: undefined };
}

async function sendTelegram(chatId, text, token, replyMarkup) {
  const { text: finalText, parse_mode } = prepareMessage(text);
  const body = { chat_id: chatId, text: finalText };
  if (parse_mode) body.parse_mode = parse_mode;
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function answerCallbackQuery(queryId, text, token) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: queryId, text }),
  });
}

// ===== Quiz Helpers =====


async function triggerPublish(draftFile, env) {
  await fetch('https://api.github.com/repos/wjdghtls95/wjdghtls95.github.io/dispatches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' },
    body: JSON.stringify({ event_type: 'publish-post', client_payload: { draft_file: draftFile } }),
  });
}

function findPending(session, type) {
  for (let i = 0; i < session.questions.length; i++) {
    if (session.questions[i].type === type && session.userAnswers[i] === undefined) return i;
  }
  return null;
}

function findPendingEssayText(session) {
  for (let i = 0; i < session.questions.length; i++) {
    if (session.questions[i].type === 'essay' && session.userAnswers[i] === undefined) return i;
  }
  return null;
}

function findPendingEssayGrade(session) {
  const grades = session.essayGrades ?? {};
  for (let i = 0; i < session.questions.length; i++) {
    if (session.questions[i].type === 'essay' && session.userAnswers[i] !== undefined && grades[i] === undefined) return i;
  }
  return null;
}
