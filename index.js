// ...existing code...
const API_BASE = 'http://localhost:8080/quiz';

let questions = [];
let current = 0;
let score = 0;
let timerInterval = null;
let feedbackTimeout = null;
let timeLeft = 300;
const TIME_PER_Q = 300;

const els = {
  questionTitle: document.getElementById('questionTitle'),
  options: document.getElementById('options'),
  timer: document.getElementById('timer'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  nextBtn: document.getElementById('nextBtn'),
  card: document.getElementById('card'),
  result: document.getElementById('result'),
  resultText: document.getElementById('resultText'),
  retryBtn: document.getElementById('retryBtn')
};

document.addEventListener('DOMContentLoaded', init);
els.nextBtn.addEventListener('click', () => gotoQuestion(current + 1));
els.retryBtn.addEventListener('click', startQuiz);

async function init() {
  try {
    const res = await fetch(`${API_BASE}/all`);
    questions = await res.json();
  } catch (e) {
    console.error('Failed to fetch questions', e);
    questions = [];
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    els.questionTitle.textContent = 'No questions available. Start backend and refresh.';
    els.options.innerHTML = '';
    return;
  }

  startQuiz();
}

function startQuiz() {
  // remove any end-theme classes when restarting
  document.body.classList.remove('theme-pass', 'theme-fail');

  current = 0;
  score = 0;
  els.result.classList.add('hidden');
  els.card.classList.remove('hidden');
  // remove any residual percent element
  const oldPct = document.getElementById('resultPercent');
  if (oldPct && oldPct.parentNode) oldPct.parentNode.removeChild(oldPct);

  updateProgress();
  renderQuestion();
}

function updateProgress() {
  els.progressText.textContent = `${Math.min(current + 1, questions.length)} / ${questions.length}`;
  const pct = ((current) / questions.length) * 100;
  els.progressFill.style.width = `${pct}%`;
}

function renderQuestion() {
  clearTimer();
  const q = questions[current];
  timeLeft = TIME_PER_Q;
  els.timer.textContent = timeLeft;
  els.questionTitle.textContent = q.questionTilte || q.questionTitle || 'Untitled question';
  els.options.innerHTML = '';

  const opts = [
    { key: 'option1', text: q.option1 },
    { key: 'option2', text: q.option2 },
    { key: 'option3', text: q.option3 },
    { key: 'option4', text: q.option4 }
  ];

  opts.forEach(opt => {
    if (!opt.text) return;
    const b = document.createElement('button');
    b.className = 'option';
    b.type = 'button';
    b.dataset.key = opt.key;
    b.textContent = opt.text;
    b.addEventListener('click', () => onSelect(b, q));
    els.options.appendChild(b);
  });

  els.nextBtn.disabled = true;
  updateProgress();
  startTimer();
}

function startTimer() {
  els.timer.textContent = timeLeft;
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    els.timer.textContent = timeLeft;
    const pct = ((TIME_PER_Q - timeLeft) / TIME_PER_Q) * 100;
    els.progressFill.style.width = `${((current) / questions.length) * 100 + (pct / questions.length)}%`;
    if (timeLeft <= 0) {
      clearTimer();
      handleTimeout();
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function onSelect(button, question) {
  if (button.classList.contains('disabled')) return;
  clearTimer();
  disableOptions();

  const selectedText = button.textContent;
  let correct = false;
  try {
    const res = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: question.id, answer: selectedText })
    });
    const payload = await res.json().catch(() => null);
    if (typeof payload === 'boolean') correct = payload;
    else if (payload && typeof payload === 'object') {
      if (typeof payload.correct === 'boolean') correct = payload.correct;
      else correct = Boolean(payload);
    } else {
      const txt = await res.text().catch(() => '');
      correct = txt.trim().toLowerCase() === 'true';
    }
  } catch (e) {
    console.error('submit error', e);
    correct = false;
  }

  if (correct) {
    score += 1;
    button.classList.add('correct');
    showFeedback('WOW BUBU! ', 'correct');
  } else {
    button.classList.add('wrong');
    markCorrectOption(question, selectedText);
    showFeedback('BAD BUBU!! ', 'wrong');
  }

  // prevent manual Next while feedback is visible
  els.nextBtn.disabled = true;
  // auto advance after feedback (3 seconds)
  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    feedbackTimeout = null;
    gotoQuestion(current + 1);
  }, 1000);
}

async function handleTimeout() {
  // when time runs out, treat as incorrect and move on
  disableOptions();
  els.nextBtn.disabled = true;
  showFeedback('BAD BUBU!! ', 'wrong');

  try {
    await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: questions[current].id, answer: null })
    }).catch(()=>{});
  } catch {}

  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    feedbackTimeout = null;
    gotoQuestion(current + 1);
  }, 3000);
}

function showFeedback(message, type) {
  const fb = document.getElementById('feedback');
  const fbImg = document.getElementById('feedbackImg');
  const fbText = document.getElementById('feedbackText');
  if (!fb || !fbImg || !fbText) return;

  // reset classes
  fb.className = 'feedback';
  fb.classList.add(type === 'correct' ? 'correct' : 'wrong');

  // choose animated emoji "images"
  if (type === 'correct') {
    fbImg.textContent = '😄'; // smiling emoji (animated via CSS)
  } else {
    fbImg.textContent = '😡'; // angry emoji
  }
  fbText.textContent = message;

  // show
  fb.classList.remove('hidden');
  requestAnimationFrame(() => fb.classList.add('show'));

  // clear previous hide timer
  if (fb._hideTimer) {
    clearTimeout(fb._hideTimer);
    fb._hideTimer = null;
  }
  // hide after 3s (visual only; navigation handled elsewhere)
  fb._hideTimer = setTimeout(() => {
    fb.classList.remove('show');
    fb._hideTimer = setTimeout(() => {
      fb.classList.add('hidden');
      fb._hideTimer = null;
    }, 220);
  }, 3000);
}

function markCorrectOption(question, selectedText) {
  // try to find which option text might be correct by testing each option with submit
  // lightweight approach: check other buttons for the one not selected and assume one that returns true
  const buttons = Array.from(document.querySelectorAll('.option'));
  buttons.forEach(btn => {
    if (btn.textContent === selectedText) return;
    // do nothing here (leaving as visual cue only if you want to call submit again)
  });
}

function disableOptions() {
  document.querySelectorAll('.option').forEach(b => {
    b.classList.add('disabled');
    b.disabled = true;
  });
}

function gotoQuestion(index) {
  if (index >= questions.length) {
    finishQuiz();
    return;
  }
  current = index;
  renderQuestion();
}

function finishQuiz() {
  clearTimer();
  els.card.classList.add('hidden');
  els.result.classList.remove('hidden');

  const total = questions.length || 1;
  const pct = Math.round((score / total) * 100);

  const resultImg = document.getElementById('resultImg');

  // set theme on body and percent-circle style
  document.body.classList.remove('theme-pass', 'theme-fail');
  const isPass = pct >= 70;
  document.body.classList.add(isPass ? 'theme-pass' : 'theme-fail');

  // update teddy / animation
  if (isPass) {
    resultImg.className = 'result-img happy';
    resultImg.textContent = '😄'; // animated/styled via CSS
  } else {
    resultImg.className = 'result-img angry';
    resultImg.textContent = '😡';
  }

  // create or update percent-circle element
  let pctEl = document.getElementById('resultPercent');
  if (!pctEl) {
    pctEl = document.createElement('div');
    pctEl.id = 'resultPercent';
    pctEl.className = 'percent-circle';
    // insert percent circle above resultText, grouped with resultImg
    const summary = document.createElement('div');
    summary.className = 'result-summary';
    // move resultImg into summary
    summary.appendChild(resultImg.cloneNode(true));
    // remove original resultImg from DOM to avoid duplicate
    resultImg.parentNode.replaceChild(summary, resultImg);
    // append percent circle and leave space for resultText below
    summary.appendChild(pctEl);
  }

  // set classes and text for percent
  pctEl.classList.remove('pass', 'fail', 'neutral');
  pctEl.classList.add(isPass ? 'pass' : 'fail');
  pctEl.textContent = `${pct}%`;

  // update result text with score details
  els.resultText.textContent = `You scored ${score} out of ${total} — ${pct}%`;

  // ensure progress bar shows complete and uses accent
  els.progressFill.style.width = '100%';
  els.progressFill.style.background = 'linear-gradient(90deg,var(--accent), #7c3aed)';
}
