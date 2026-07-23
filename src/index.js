const PASS_SCORE = 70;

// KV key reference
// 'USER_CHAT_ID'        → user's Telegram chat ID (saved on first /start)
// 'PENDING_QUEUE'       → [{file, title, quizKey}] queue (max 5)
// 'NEXT_QUIZ_DATE'      → "2026-07-22" (KST) next quiz date
// 'SCHEDULE_STATE'      → current schedule state JSON
// 'pending_quiz_{key}'  → quiz data (written by blog-starter, read by this Worker)
// '{chatId}'            → active quiz session

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

// 09:00 UTC (18:00 KST) — start quiz
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
  if (!quizRaw) return;

  const quiz = JSON.parse(quizRaw);
  quiz.userAnswers = {};

  await env.QUIZ_SESSIONS.put(chatId, JSON.stringify(quiz), { expirationTtl: 86400 });
  await saveScheduleState({
    file: item.file,
    title: item.title,
    quizKey: item.quizKey,
    state: 'quiz_active',
    retryCount: 0,
    lastActivityAt: Date.now(),
    lastReminderAt: null,
  }, env);

  const token = env.TELEGRAM_BOT_TOKEN;
  await sendTelegram(chatId, `📝 *Quiz: ${item.title}*\n\nLet's check if you read the post carefully`, token);
  await sendNext(chatId, quiz, token, env);
}

// 23:00 UTC (08:00 KST) — publish
async function handlePublish(env) {
  const state = await getScheduleState(env);
  if (!state || state.state !== 'passed') return;
  if (state.publishDate !== getKSTDateString()) return;

  const chatId = await env.QUIZ_SESSIONS.get('USER_CHAT_ID');
  await triggerPublish(state.file, env);
  await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');

  if (chatId) {
    await sendTelegram(chatId, `🚀 Published!\n_${state.title}_`, env.TELEGRAM_BOT_TOKEN);
  }
}

// every 30min — retry and reminder
async function handleRetryAndReminder(env) {
  const state = await getScheduleState(env);
  if (!state) return;

  const chatId = await env.QUIZ_SESSIONS.get('USER_CHAT_ID');
  if (!chatId) return;

  const token = env.TELEGRAM_BOT_TOKEN;
  const now = Date.now();

  if (state.state === 'failed' && now >= state.retryAt) {
    let session = await getSession(chatId, env);
    if (!session) {
      const quizRaw = await env.QUIZ_SESSIONS.get(state.quizKey);
      if (!quizRaw) {
        await sendTelegram(chatId, '⚠️ Quiz data expired. Please push to drafts/ again', token);
        await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');
        return;
      }
      session = JSON.parse(quizRaw);
    }
    session.userAnswers = {};
    await saveSession(chatId, session, env);
    await saveScheduleState({ ...state, state: 'quiz_active', lastActivityAt: now, lastReminderAt: null }, env);
    await sendTelegram(chatId, `🔄 *Retry (attempt ${state.retryCount})*\nStarting from the beginning`, token);
    await sendNext(chatId, session, token, env);
    return;
  }

  if (state.state === 'quiz_active' || state.state === 'no_show') {
    const timeSinceActivity = now - (state.lastActivityAt ?? now);
    const timeSinceReminder = state.lastReminderAt ? now - state.lastReminderAt : Infinity;

    if (timeSinceActivity >= 60 * 60 * 1000 && timeSinceReminder >= 60 * 60 * 1000) {
      await sendTelegram(chatId, `⏰ Quiz still pending\nContinue answering or use /postpone to defer to tomorrow`, token);
      await saveScheduleState({ ...state, state: 'no_show', lastReminderAt: now }, env);
    }
  }
}

// ===== Telegram Message Handlers =====

async function handleCallbackQuery(query, env) {
  const chatId = query.message.chat.id.toString();
  const token = env.TELEGRAM_BOT_TOKEN;
  const { q: qIndex, a: answer } = JSON.parse(query.data);

  await answerCallbackQuery(query.id, `Selected: ${answer}`, token);

  const session = await getSession(chatId, env);
  if (!session) return;

  session.userAnswers[qIndex] = answer;
  await saveSession(chatId, session, env);

  const schedState = await getScheduleState(env);
  if (schedState && ['quiz_active', 'no_show'].includes(schedState.state)) {
    await saveScheduleState({ ...schedState, state: 'quiz_active', lastActivityAt: Date.now(), lastReminderAt: null }, env);
  }

  await sendNext(chatId, session, token, env);
}

async function handleMessage(message, env) {
  const chatId = message.chat.id.toString();
  const token = env.TELEGRAM_BOT_TOKEN;
  const text = (message.text ?? '').trim();

  await env.QUIZ_SESSIONS.put('USER_CHAT_ID', chatId);

  if (text === '/start') {
    const queue = await getPendingQueue(env);
    const state = await getScheduleState(env);
    let statusMsg = '📚 Quiz bot ready\n';
    statusMsg += `Queue: ${queue.length} items\n`;
    statusMsg += state ? `Current: ${state.state} — ${state.title}` : 'No active quiz';
    await sendTelegram(chatId, statusMsg, token);
    return;
  }

  // /postpone (or Korean alias /미루기)
  if (text === '/postpone' || text === '/미루기') {
    const schedState = await getScheduleState(env);
    if (!schedState || !['quiz_active', 'failed', 'no_show'].includes(schedState.state)) {
      await sendTelegram(chatId, 'No active quiz to postpone', token);
      return;
    }

    const queue = await getPendingQueue(env);
    const session = await getSession(chatId, env);

    if (session) {
      session.userAnswers = {};
      await env.QUIZ_SESSIONS.put(schedState.quizKey, JSON.stringify(session), { expirationTtl: 7 * 86400 });
    }

    queue.unshift({ file: schedState.file, title: schedState.title, quizKey: schedState.quizKey });
    await savePendingQueue(queue, env);
    await env.QUIZ_SESSIONS.put('NEXT_QUIZ_DATE', getKSTDateString(1));
    await env.QUIZ_SESSIONS.delete('SCHEDULE_STATE');
    await env.QUIZ_SESSIONS.delete(chatId);

    await sendTelegram(chatId, `⏭️ Deferred to tomorrow 6pm\n_${schedState.title}_`, token);
    return;
  }

  const session = await getSession(chatId, env);
  if (!session) return;

  const mcTotal = session.questions.filter(q => q.type === 'multiple').length;
  const mcDone = Object.keys(session.userAnswers).filter(k => session.questions[+k]?.type === 'multiple').length;
  if (mcDone < mcTotal) return;

  const idx = findPending(session, 'essay');
  if (idx === null) return;

  session.userAnswers[idx] = text;
  await saveSession(chatId, session, env);

  const schedState = await getScheduleState(env);
  if (schedState && ['quiz_active', 'no_show'].includes(schedState.state)) {
    await saveScheduleState({ ...schedState, state: 'quiz_active', lastActivityAt: Date.now(), lastReminderAt: null }, env);
  }

  await sendNext(chatId, session, token, env);
}

// ===== Quiz Flow =====

async function sendNext(chatId, session, token, env) {
  const questions = session.questions;
  const mcTotal = questions.filter(q => q.type === 'multiple').length;
  const essayTotal = questions.filter(q => q.type === 'essay').length;

  const nextMC = findPending(session, 'multiple');
  if (nextMC !== null) {
    const q = questions[nextMC];
    const mcDone = Object.keys(session.userAnswers).filter(k => questions[+k]?.type === 'multiple').length;
    const buttons = q.options.map(opt => [{ text: opt, callback_data: JSON.stringify({ q: nextMC, a: opt[0] }) }]);
    await sendTelegram(chatId, `*Q${mcDone + 1}/${mcTotal} [${q.difficulty}] (multiple choice)*\n\n${q.q}`, token, { inline_keyboard: buttons });
    return;
  }

  const nextEssay = findPending(session, 'essay');
  if (nextEssay !== null) {
    const q = questions[nextEssay];
    const essayDone = Object.keys(session.userAnswers).filter(k => questions[+k]?.type === 'essay').length;
    await sendTelegram(chatId, `*Essay ${essayDone + 1}/${essayTotal} [${q.difficulty}]*\n\n${q.q}\n\n_Answer freely_`, token);
    return;
  }

  await grade(chatId, session, token, env);
}

async function grade(chatId, session, token, env) {
  const questions = session.questions;
  let correct = 0;
  const wrong = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = session.userAnswers[i];
    if (q.type === 'multiple') {
      if (ans === q.answer) correct++;
      else {
        const correctFull = q.options.find(o => o[0] === q.answer) ?? q.answer;
        const userFull = q.options.find(o => o[0] === ans) ?? (ans ?? 'no answer');
        wrong.push({ section: q.section, q: q.q, correct: correctFull, user: userFull });
      }
    } else {
      const ok = await gradeEssay(q.q, ans, session.content, env);
      if (ok) correct++;
      else wrong.push({ section: q.section, q: q.q, essay: true });
    }
  }

  const percent = Math.round((correct / questions.length) * 100);
  const schedState = await getScheduleState(env);

  if (percent >= PASS_SCORE) {
    const publishDate = getKSTDateString(1);
    await saveScheduleState({ ...schedState, state: 'passed', publishDate, lastActivityAt: Date.now() }, env);
    await env.QUIZ_SESSIONS.put('NEXT_QUIZ_DATE', getKSTDateString(2));
    await env.QUIZ_SESSIONS.delete(chatId);
    await sendTelegram(chatId, `✅ *${percent}pts — Passed!* (${correct}/${questions.length})\n\nWill be published tomorrow at 8am 🚀`, token);
  } else {
    let msg = `❌ *${percent}pts — Below 70* (${correct}/${questions.length})\n\n*Wrong answers:*\n\n`;
    wrong.forEach((w, i) => {
      msg += `${i + 1}. 📍 *[${w.section}]*\n`;
      msg += `   Q: ${w.q}\n`;
      if (w.correct) msg += `   Correct: ${w.correct}\n   Your answer: ${w.user}\n`;
      if (w.essay) msg += `   → Review this section and summarize the key concepts\n`;
      msg += '\n';
    });
    const sections = [...new Set(wrong.map(w => w.section))];
    msg += `📖 *Sections to re-read:*\n`;
    sections.forEach(s => msg += `  • ${s}\n`);
    msg += '\n_Retry in 30 minutes_';

    session.userAnswers = {};
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

// KST = UTC+9. daysOffset: 0=today, 1=tomorrow, 2=day after
function getKSTDateString(daysOffset = 0) {
  const now = new Date();
  const kstMs = now.getTime() + (9 * 60 * 60 + daysOffset * 24 * 60 * 60) * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

// ===== Telegram Helpers =====

async function sendTelegram(chatId, text, token, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
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

async function gradeEssay(question, answer, content, env) {
  if (!answer?.trim()) return false;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      messages: [{ role: 'user', content: `Source: ${content.slice(0, 800)}\nQuestion: ${question}\nAnswer: ${answer}\nReturn 1 if key concepts are covered, 0 otherwise.` }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() === '1';
}

async function triggerPublish(draftFile, env) {
  // env.GITHUB_REPO format: "username/repo-name"
  await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ event_type: 'publish-post', client_payload: { draft_file: draftFile } }),
  });
}

function findPending(session, type) {
  for (let i = 0; i < session.questions.length; i++) {
    if (session.questions[i].type === type && session.userAnswers[i] === undefined) return i;
  }
  return null;
}
