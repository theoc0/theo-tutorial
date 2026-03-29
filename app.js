const TOTAL_LEVELS = 50;
const QUESTIONS_PER_LEVEL = 30;
const OPTION_KEYS = ["A", "B", "C", "D"];
const PASS_ACCURACY = 70;
const STORAGE_KEY = "chinese_quiz_progress_v2";

const bankSelect = document.getElementById("bankSelect");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const submitBtn = document.getElementById("submitBtn");
const nextLevelBtn = document.getElementById("nextLevelBtn");
const retryBtn = document.getElementById("retryBtn");

const welcomeCard = document.getElementById("welcomeCard");
const notOpenCard = document.getElementById("notOpenCard");
const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");

const quizForm = document.getElementById("quizForm");
const reviewWrap = document.getElementById("reviewWrap");

const currentLevelDisplay = document.getElementById("currentLevelDisplay");
const highestPassedLevel = document.getElementById("highestPassedLevel");
const answeredCount = document.getElementById("answeredCount");
const progressText = document.getElementById("progressText");
const quizSubtitle = document.getElementById("quizSubtitle");

const scoreBadge = document.getElementById("scoreBadge");
const correctCount = document.getElementById("correctCount");
const wrongCount = document.getElementById("wrongCount");
const accuracyText = document.getElementById("accuracyText");
const resultLevelText = document.getElementById("resultLevelText");

const bankLabelTop = document.getElementById("bankLabelTop");
const levelLabelTop = document.getElementById("levelLabelTop");

const passBanner = document.getElementById("passBanner");
const passStatusText = document.getElementById("passStatusText");

let currentLevel = 1;
let currentBank = null;
let currentQuestions = [];
let lastResult = null;

init();

function init() {
  renderBankOptions();
  restoreProgress();
  bindEvents();
  updateTopInfo();
  updateLevelDisplay();
  updateHighestPassedDisplay();
}

function bindEvents() {
  bankSelect.addEventListener("change", () => {
    const selectedId = bankSelect.value;
    currentBank = getBankById(selectedId);
    loadBankProgress();
    updateTopInfo();
    updateLevelDisplay();
    updateHighestPassedDisplay();
    resetView();
  });

  startBtn.addEventListener("click", () => {
    if (!currentBank) currentBank = getBankById(bankSelect.value);
    startLevel();
  });

  restartBtn.addEventListener("click", () => {
    if (!currentBank) currentBank = getBankById(bankSelect.value);
    startLevel();
  });

  submitBtn.addEventListener("click", submitQuiz);

  nextLevelBtn.addEventListener("click", () => {
    if (!lastResult || !lastResult.passed) return;
    if (currentLevel >= TOTAL_LEVELS) return;

    currentLevel += 1;
    saveProgress();
    updateLevelDisplay();
    updateTopInfo();
    updateHighestPassedDisplay();
    startLevel();
  });

  retryBtn.addEventListener("click", () => {
    startLevel();
  });

  quizForm.addEventListener("change", () => {
    updateAnsweredProgress();
  });
}

function renderBankOptions() {
  bankSelect.innerHTML = "";

  if (!Array.isArray(QUESTION_BANKS) || QUESTION_BANKS.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "沒有可用題庫";
    bankSelect.appendChild(option);
    currentBank = null;
    return;
  }

  QUESTION_BANKS.forEach((bank, index) => {
    const option = document.createElement("option");
    option.value = bank.id || `bank_${index}`;
    option.textContent = bank.name || `題庫 ${index + 1}`;
    bankSelect.appendChild(option);
  });

  currentBank = QUESTION_BANKS[0];
  bankSelect.value = currentBank.id || "bank_0";
}

function getBankById(id) {
  if (!Array.isArray(QUESTION_BANKS)) return null;
  return QUESTION_BANKS.find((bank, index) => (bank.id || `bank_${index}`) === id) || null;
}

function updateTopInfo() {
  bankLabelTop.textContent = currentBank ? (currentBank.name || "未命名題庫") : "尚未選擇題庫";
  levelLabelTop.textContent = `第 ${currentLevel} 關`;
}

function updateLevelDisplay() {
  currentLevelDisplay.textContent = currentLevel;
}

function updateHighestPassedDisplay() {
  highestPassedLevel.textContent = getCurrentHighestPassedLevel();
}

function resetView() {
  welcomeCard.classList.remove("hidden");
  notOpenCard.classList.add("hidden");
  quizCard.classList.add("hidden");
  resultCard.classList.add("hidden");
  quizForm.innerHTML = "";
  reviewWrap.innerHTML = "";
  currentQuestions = [];
  lastResult = null;
  answeredCount.textContent = "0";
  progressText.textContent = `0 / ${QUESTIONS_PER_LEVEL} 已作答`;
  passBanner.className = "pass-banner";
  passStatusText.textContent = "未判定";
}

function startLevel() {
  if (!currentBank || !Array.isArray(currentBank.questions)) {
    resetView();
    return;
  }

  const selectedQuestions = generateLevelQuestions(currentBank.questions, currentLevel, QUESTIONS_PER_LEVEL);

  if (!selectedQuestions || selectedQuestions.length < QUESTIONS_PER_LEVEL) {
    welcomeCard.classList.add("hidden");
    quizCard.classList.add("hidden");
    resultCard.classList.add("hidden");
    notOpenCard.classList.remove("hidden");
    currentQuestions = [];
    return;
  }

  currentQuestions = selectedQuestions;
  lastResult = null;
  renderQuiz(currentQuestions);

  welcomeCard.classList.add("hidden");
  notOpenCard.classList.add("hidden");
  resultCard.classList.add("hidden");
  quizCard.classList.remove("hidden");

  quizSubtitle.textContent = `${currentBank.name || "題庫"}｜第 ${currentLevel} 關｜請完成 ${QUESTIONS_PER_LEVEL} 題後交卷`;
  updateAnsweredProgress();

  setTimeout(() => {
    quizCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 60);
}

function generateLevelQuestions(allQuestions, level, count) {
  if (!Array.isArray(allQuestions) || allQuestions.length < count) return [];

  const normalized = allQuestions.filter(isValidQuestion);

  if (normalized.length < count) return [];

  const buckets = {
    1: normalized.filter((q) => Number(q.diff) === 1),
    2: normalized.filter((q) => Number(q.diff) === 2),
    3: normalized.filter((q) => Number(q.diff) === 3)
  };

  const plan = getLevelPlan(level);
  let result = [];

  result = result.concat(sampleQuestions(buckets[1], plan[1]));
  result = result.concat(sampleQuestions(buckets[2], plan[2]));
  result = result.concat(sampleQuestions(buckets[3], plan[3]));

  if (result.length < count) {
    const usedSet = new Set(result.map((q) => getQuestionKey(q)));
    const remain = normalized.filter((q) => !usedSet.has(getQuestionKey(q)));
    result = result.concat(sampleQuestions(remain, count - result.length));
  }

  if (result.length < count) return [];

  return shuffleArray(result).slice(0, count);
}

function getLevelPlan(level) {
  if (level <= 10) return { 1: 18, 2: 9, 3: 3 };
  if (level <= 20) return { 1: 14, 2: 10, 3: 6 };
  if (level <= 30) return { 1: 10, 2: 12, 3: 8 };
  if (level <= 40) return { 1: 6, 2: 12, 3: 12 };
  return { 1: 3, 2: 9, 3: 18 };
}

function isValidQuestion(q) {
  return (
    q &&
    q.q &&
    Array.isArray(q.opts) &&
    q.opts.length === 4 &&
    q.opts.every((opt) => typeof opt === "string") &&
    q.ans !== undefined
  );
}

function sampleQuestions(arr, n) {
  if (!Array.isArray(arr) || arr.length === 0 || n <= 0) return [];
  return shuffleArray([...arr]).slice(0, Math.min(n, arr.length));
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getQuestionKey(q) {
  return `${q.q}__${(q.opts || []).join("|")}`;
}

function renderQuiz(questions) {
  quizForm.innerHTML = "";

  questions.forEach((question, index) => {
    const card = document.createElement("section");
    card.className = "question-card";

    const head = document.createElement("div");
    head.className = "question-head";

    const no = document.createElement("div");
    no.className = "q-no";
    no.textContent = index + 1;

    const titleWrap = document.createElement("div");
    titleWrap.className = "question-title";

    const title = document.createElement("h3");
    title.textContent = question.q;

    titleWrap.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "q-meta";

    const diffChip = document.createElement("span");
    diffChip.className = "q-chip";
    diffChip.textContent = `難度 ${question.diff || "-"}`;

    meta.appendChild(diffChip);

    head.appendChild(no);

    const rightBlock = document.createElement("div");
    rightBlock.style.flex = "1";
    rightBlock.appendChild(titleWrap);
    rightBlock.appendChild(meta);

    head.appendChild(rightBlock);
    card.appendChild(head);

    const options = document.createElement("div");
    options.className = "options";

    question.opts.forEach((opt, optIndex) => {
      const label = document.createElement("label");
      label.className = "option-label";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question_${index}`;
      input.value = String(optIndex);

      const key = document.createElement("span");
      key.className = "option-key";
      key.textContent = `${OPTION_KEYS[optIndex]}.`;

      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = opt;

      label.appendChild(input);
      label.appendChild(key);
      label.appendChild(text);

      options.appendChild(label);
    });

    card.appendChild(options);
    quizForm.appendChild(card);
  });
}

function updateAnsweredProgress() {
  let count = 0;
  currentQuestions.forEach((_, index) => {
    const checked = quizForm.querySelector(`input[name="question_${index}"]:checked`);
    if (checked) count += 1;
  });

  answeredCount.textContent = String(count);
  progressText.textContent = `${count} / ${QUESTIONS_PER_LEVEL} 已作答`;
}

function submitQuiz() {
  if (!currentQuestions.length) return;

  const details = currentQuestions.map((question, index) => {
    const checked = quizForm.querySelector(`input[name="question_${index}"]:checked`);
    const userAnswerIndex = checked ? Number(checked.value) : -1;
    const correctAnswerIndex = normalizeAnswerIndex(question.ans);
    const isCorrect = userAnswerIndex === correctAnswerIndex;

    return {
      index,
      question,
      userAnswerIndex,
      correctAnswerIndex,
      isCorrect
    };
  });

  const correct = details.filter((item) => item.isCorrect).length;
  const wrongItems = details.filter((item) => !item.isCorrect);
  const wrong = wrongItems.length;
  const score = Math.round((correct / currentQuestions.length) * 100);
  const accuracy = (correct / currentQuestions.length) * 100;
  const passed = accuracy >= PASS_ACCURACY;

  lastResult = {
    correct,
    wrong,
    score,
    accuracy,
    passed
  };

  if (passed) {
    updateHighestPassedLevel(currentLevel);
  }

  scoreBadge.textContent = `${score} 分`;
  correctCount.textContent = String(correct);
  wrongCount.textContent = String(wrong);
  accuracyText.textContent = `${accuracy.toFixed(1)}%`;
  resultLevelText.textContent = String(currentLevel);

  updatePassBanner(passed, accuracy);
  renderWrongReviews(wrongItems);
  updateResultActionState(passed);

  quizCard.classList.add("hidden");
  notOpenCard.classList.add("hidden");
  welcomeCard.classList.add("hidden");
  resultCard.classList.remove("hidden");

  saveProgress();
  updateHighestPassedDisplay();

  setTimeout(() => {
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

function updatePassBanner(passed, accuracy) {
  passBanner.className = `pass-banner ${passed ? "pass" : "fail"}`;
  if (passed) {
    passStatusText.textContent = `已過關｜正確率 ${accuracy.toFixed(1)}%`;
  } else {
    passStatusText.textContent = `未過關｜需達 ${PASS_ACCURACY}%（目前 ${accuracy.toFixed(1)}%）`;
  }
}

function updateResultActionState(passed) {
  if (passed) {
    nextLevelBtn.disabled = currentLevel >= TOTAL_LEVELS;
    nextLevelBtn.textContent = currentLevel >= TOTAL_LEVELS ? "已完成全部關卡" : "下一關";
    nextLevelBtn.style.opacity = currentLevel >= TOTAL_LEVELS ? "0.55" : "1";
    nextLevelBtn.style.cursor = currentLevel >= TOTAL_LEVELS ? "not-allowed" : "pointer";
    retryBtn.textContent = "重玩本關";
  } else {
    nextLevelBtn.disabled = true;
    nextLevelBtn.textContent = `未達 ${PASS_ACCURACY}% 無法進下一關`;
    nextLevelBtn.style.opacity = "0.55";
    nextLevelBtn.style.cursor = "not-allowed";
    retryBtn.textContent = "再挑戰一次";
  }
}

function normalizeAnswerIndex(ans) {
  if (typeof ans === "number") return ans;

  if (typeof ans === "string") {
    const trimmed = ans.trim().toUpperCase();

    if (/^\d+$/.test(trimmed)) return Number(trimmed);

    const index = OPTION_KEYS.indexOf(trimmed);
    if (index >= 0) return index;
  }

  return -999;
}

function renderWrongReviews(wrongItems) {
  reviewWrap.innerHTML = "";

  if (!wrongItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-review";
    empty.textContent = "恭喜，全對！本關沒有錯題需要複習。";
    reviewWrap.appendChild(empty);
    return;
  }

  wrongItems.forEach((item, wrongIndex) => {
    const { question, userAnswerIndex, correctAnswerIndex } = item;

    const card = document.createElement("div");
    card.className = "review-card";

    const title = document.createElement("h4");
    title.textContent = `錯題 ${wrongIndex + 1}｜${question.q}`;
    card.appendChild(title);

    const userRow = document.createElement("div");
    userRow.className = "review-row";
    userRow.innerHTML = `
      <span class="review-label">你的答案：</span>
      <span class="review-user-answer">${formatAnswerText(question, userAnswerIndex)}</span>
    `;
    card.appendChild(userRow);

    const correctRow = document.createElement("div");
    correctRow.className = "review-row";
    correctRow.innerHTML = `
      <span class="review-label">正確答案：</span>
      <span class="review-correct-answer">${formatAnswerText(question, correctAnswerIndex)}</span>
    `;
    card.appendChild(correctRow);

    const expRow = document.createElement("div");
    expRow.className = "review-row";
    expRow.innerHTML = `
      <span class="review-label">解釋：</span>
      <span class="review-exp">${question.exp ? escapeHtml(question.exp) : "本題暫無解釋。"}</span>
    `;
    card.appendChild(expRow);

    reviewWrap.appendChild(card);
  });
}

function formatAnswerText(question, index) {
  if (index === -1) return "未作答";
  if (!question || !Array.isArray(question.opts) || index < 0 || index >= question.opts.length) return "無法判定";
  return `${OPTION_KEYS[index]}. ${question.opts[index]}`;
}

function saveProgress() {
  if (!currentBank) return;

  const data = readProgressData();
  const bankId = getCurrentBankId();

  data.selectedBankId = bankId;
  data.banks = data.banks || {};

  const oldBankData = data.banks[bankId] || {};

  data.banks[bankId] = {
    currentLevel,
    highestPassedLevel: Math.max(oldBankData.highestPassedLevel || 0, getCurrentHighestPassedLevel()),
    lastResult: lastResult || null
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreProgress() {
  if (!currentBank) return;

  const data = readProgressData();

  if (data.selectedBankId) {
    const found = getBankById(data.selectedBankId);
    if (found) {
      currentBank = found;
      bankSelect.value = getCurrentBankId();
    }
  }

  loadBankProgress();
}

function loadBankProgress() {
  if (!currentBank) {
    currentLevel = 1;
    lastResult = null;
    return;
  }

  const data = readProgressData();
  const bankId = getCurrentBankId();
  const bankProgress = data.banks && data.banks[bankId];

  if (bankProgress && Number.isInteger(bankProgress.currentLevel) && bankProgress.currentLevel >= 1) {
    currentLevel = Math.min(bankProgress.currentLevel, TOTAL_LEVELS);
    lastResult = bankProgress.lastResult || null;
  } else {
    currentLevel = 1;
    lastResult = null;
  }
}

function readProgressData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { selectedBankId: null, banks: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      selectedBankId: parsed.selectedBankId || null,
      banks: parsed.banks || {}
    };
  } catch {
    return { selectedBankId: null, banks: {} };
  }
}

function getCurrentBankId() {
  if (!currentBank) return "";
  const fallbackIndex = QUESTION_BANKS.indexOf(currentBank);
  return currentBank.id || `bank_${fallbackIndex}`;
}

function getCurrentHighestPassedLevel() {
  if (!currentBank) return 0;
  const data = readProgressData();
  const bankId = getCurrentBankId();
  return (data.banks && data.banks[bankId] && data.banks[bankId].highestPassedLevel) || 0;
}

function updateHighestPassedLevel(level) {
  if (!currentBank) return;
  const data = readProgressData();
  const bankId = getCurrentBankId();

  data.selectedBankId = bankId;
  data.banks = data.banks || {};
  data.banks[bankId] = data.banks[bankId] || {};

  data.banks[bankId].highestPassedLevel = Math.max(data.banks[bankId].highestPassedLevel || 0, level);

  if (!data.banks[bankId].currentLevel || data.banks[bankId].currentLevel < currentLevel) {
    data.banks[bankId].currentLevel = currentLevel;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
