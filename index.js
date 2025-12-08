// ...existing code...
const API_BASE = 'http://localhost:8080/quiz';

let questions = [];
let current = 0;
let score = 0;
let timerInterval = null;
let timeLeft = 15;
const TIME_PER_Q = 15;

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
  current = 0;
  score = 0;
  els.result.classList.add('hidden');
  els.card.classList.remove('hidden');
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
    // backend may return boolean or JSON; handle both
    const payload = await res.json().catch(() => null);
    if (typeof payload === 'boolean') correct = payload;
    else if (payload && typeof payload === 'object') {
      // try to find boolean inside returned object
      if (typeof payload.correct === 'boolean') correct = payload.correct;
      else correct = Boolean(payload);
    } else {
      // fallback to string value like "true"/"false"
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
  } else {
    button.classList.add('wrong');
    // mark correct option visually if it matches one of option texts (optional)
    markCorrectOption(question, selectedText);
  }

  els.nextBtn.disabled = false;
  // auto advance short delay so user sees feedback
  setTimeout(() => gotoQuestion(current + 1), 900);
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

async function handleTimeout() {
  // when time runs out, treat as incorrect and move on
  disableOptions();
  els.nextBtn.disabled = false;
  // optionally attempt to submit empty selection to backend
  try {
    await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: questions[current].id, answer: null })
    }).catch(()=>{});
  } catch {}
  setTimeout(() => gotoQuestion(current + 1), 600);
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
  els.resultText.textContent = `You scored ${score} out of ${questions.length}`;
    // reset progress fill to 100%
  els.progressFill.style.width = '100%';
}