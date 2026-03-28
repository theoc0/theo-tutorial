const BANK_MIN_QUESTIONS = 50;
const QUESTIONS_PER_RUN = 30;
const AUTO_NEXT_DELAY = 260;

let currentBankName = "";
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let started = false;
let submitted = false;
let startTime = null;
let timerInterval = null;

const bankSelect = document.getElementById("bankSelect");
const bankStatus = document.getElementById("bankStatus");
const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const studentNameInput = document.getElementById("studentName");
const classNameInput = document.getElementById("className");
const studentNoInput = document.getElementById("studentNo");

const quizTitle = document.getElementById("quizTitle");
const quizMeta = document.getElementById("quizMeta");
const singleQuestionWrap = document.getElementById("singleQuestionWrap");
const timerEl = document.getElementById("timer");

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const currentQNo = document.getElementById("currentQNo");
const answeredCountEl = document.getElementById("answeredCount");

const resultSection = document.getElementById("resultSection");
const levelUpBox = document.getElementById("levelUpBox");
const levelUpText = document.getElementById("levelUpText");

const currentLvEl = document.getElementById("currentLv");
const bestScoreEl = document.getElementById("bestScore");
const lastScoreEl = document.getElementById("lastScore");

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function shuffleArray(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function sampleQuestions(arr, count) {
  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function shuffleQuestionOptions(question) {
  const originalOpts = safeArray(question.opts);
  const optionObjects = originalOpts.map((text, index) => ({
    text,
    originalIndex: index
  }));
  const shuffledOptions = shuffleArray(optionObjects);
  const newAns = shuffledOptions.findIndex(item => item.originalIndex === question.ans);

  return {
    ...question,
    opts: shuffledOptions.map(item => item.text),
    ans: newAns
  };
}

function getStorageKey() {
  return "chinese_game_progress";
}

function loadProgressData() {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey())) || {
      bestScore: 0,
      lastScore: 0,
      currentLv: 0
    };
  } catch {
    return {
      bestScore: 0,
      lastScore: 0,
      currentLv: 0
    };
  }
}

function saveProgressData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

function renderProgressData() {
  const data = loadProgressData();
  currentLvEl.textContent = `LV ${data.currentLv || 0}`;
  bestScoreEl.textContent = data.bestScore || 0;
  lastScoreEl.textContent = data.lastScore || 0;
}

function getLevelFromPercentage(percentage) {
  if (percentage >= 90) return 5;
  if (percentage >= 80) return 4;
  if (percentage >= 70) return 3;
  if (percentage >= 60) return 2;
  if (percentage > 0) return 1;
  return 0;
}

function updateGameLevel(score, total) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const data = loadProgressData();
  const oldLv = data.currentLv || 0;

  data.lastScore = percentage;
  if (percentage > (data.bestScore || 0)) data.bestScore = percentage;

  const newLv = Math.max(oldLv, getLevelFromPercentage(percentage));
  data.currentLv = newLv;

  saveProgressData(data);
  renderProgressData();

  return { oldLv, newLv, percentage };
}

function getAvailableBanks() {
  if (typeof QUESTION_BANKS !== "object" || !QUESTION_BANKS) return [];
  return Object.entries(QUESTION_BANKS).map(([name, questions]) => ({
    name,
    questions: safeArray(questions),
    enabled: safeArray(questions).length >= BANK_MIN_QUESTIONS
  }));
}

function renderBankOptions() {
  bankSelect.innerHTML = "";
  const banks = getAvailableBanks();

  if (banks.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "沒有可用題庫";
    bankSelect.appendChild(option);
    bankStatus.textContent = "未載入題庫。";
    startBtn.disabled = true;
    return;
  }

  banks.forEach(bank => {
    const option = document.createElement("option");
    option.value = bank.name;
    option.textContent = `${bank.name}（${bank.questions.length}題）${bank.enabled ? "" : "【未啟用】"}`;
    option.disabled = !bank.enabled;
    bankSelect.appendChild(option);
  });

  const firstEnabled = banks.find(b => b.enabled);
  if (firstEnabled) bankSelect.value = firstEnabled.name;

  updateBankStatus();
}

function updateBankStatus() {
  const bankName = bankSelect.value;
  const questions = safeArray((QUESTION_BANKS || {})[bankName]);

  if (!bankName) {
    bankStatus.textContent = "未選擇題庫。";
    startBtn.disabled = true;
    return;
  }

  if (questions.length < BANK_MIN_QUESTIONS) {
    bankStatus.textContent = `此題庫題目少於 ${BANK_MIN_QUESTIONS} 題，已禁用。`;
    startBtn.disabled = true;
  } else {
    bankStatus.textContent = `此題庫可用，系統將隨機抽取 ${Math.min(QUESTIONS_PER_RUN, questions.length)} 題。`;
    startBtn.disabled = false;
  }
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  stopTimer();
  startTime = Date.now();
  timerEl.textContent = "00:00";

  timerInterval = setInterval(() => {
    const used = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = formatTime(used);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resumeTimer() {
  if (!startTime) {
    startTimer();
    return;
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  stopTimer();
  startTime = Date.now() - elapsed * 1000;

  timerInterval = setInterval(() => {
    const used = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = formatTime(used);
  }, 1000);
}

function validateStudentInfo() {
  const studentName = studentNameInput.value.trim();
  const className = classNameInput.value.trim();
  const studentNo = studentNoInput.value.trim();

  if (!studentName || !className || !studentNo) {
    alert("請先填寫姓名、班別、學號。");
    return false;
  }
  return true;
}

function getAnsweredCount() {
  return userAnswers.filter(v => v !== null && v !== undefined).length;
}

function updateProgress() {
  const answered = getAnsweredCount();
  const total = currentQuestions.length || 0;
  const percent = total > 0 ? (answered / total) * 100 : 0;

  progressText.textContent = `${answered} / ${total}`;
  progressFill.style.width = `${percent}%`;
  currentQNo.textContent = total > 0 ? `${currentQuestionIndex + 1} / ${total}` : "0";
  answeredCountEl.textContent = answered;
}

function updateNavButtons() {
  prevBtn.disabled = !started || currentQuestionIndex === 0;
  nextBtn.disabled = !started || currentQuestionIndex >= currentQuestions.length - 1;
}

function renderSingleQuestion() {
  singleQuestionWrap.innerHTML = "";

  if (!started || !currentQuestions.length) {
    singleQuestionWrap.innerHTML = `<div class="empty-state">請先填寫學生資料並按「開始闖關」。</div>`;
    updateProgress();
    updateNavButtons();
    return;
  }

  const q = currentQuestions[currentQuestionIndex];
  const savedAnswer = userAnswers[currentQuestionIndex];

  const div = document.createElement("div");
  div.className = "question-card";
  div.innerHTML = `
    <h3>第 ${currentQuestionIndex + 1} 題【${q.cat || ""}｜${q.type || ""}｜難度${q.diff ?? ""}】</h3>
    <p>${q.q || ""}</p>
    <div class="options">
      ${safeArray(q.opts).map((opt, i) => `
        <label class="option ${savedAnswer === i ? "selected" : ""}">
          <input type="radio" name="single_question" value="${i}" ${savedAnswer === i ? "checked" : ""}>
          <span>${String.fromCharCode(65 + i)}. ${opt}</span>
        </label>
      `).join("")}
    </div>
  `;
  singleQuestionWrap.appendChild(div);

  const radios = singleQuestionWrap.querySelectorAll('input[name="single_question"]');
  const optionLabels = singleQuestionWrap.querySelectorAll(".option");

  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      userAnswers[currentQuestionIndex] = Number(radio.value);

      optionLabels.forEach(label => label.classList.remove("selected"));
      radio.closest(".option").classList.add("selected");

      updateProgress();

      if (currentQuestionIndex < currentQuestions.length - 1) {
        setTimeout(() => {
          currentQuestionIndex++;
          renderSingleQuestion();
        }, AUTO_NEXT_DELAY);
      }
    });
  });

  updateProgress();
  updateNavButtons();
}

function startQuiz() {
  if (!validateStudentInfo()) return;

  currentBankName = bankSelect.value;
  const allQuestions = safeArray((QUESTION_BANKS || {})[currentBankName]);

  if (!currentBankName || allQuestions.length < BANK_MIN_QUESTIONS) {
    alert("此題庫未啟用或不存在。");
    return;
  }

  currentQuestions = sampleQuestions(allQuestions, QUESTIONS_PER_RUN).map(q => shuffleQuestionOptions(q));

  started = true;
  submitted = false;
  currentQuestionIndex = 0;
  userAnswers = new Array(currentQuestions.length).fill(null);

  quizTitle.textContent = currentBankName;
  quizMeta.textContent = `共 ${currentQuestions.length} 題｜一題一頁闖關模式`;

  resultSection.classList.add("hidden");
  levelUpBox.classList.add("hidden");
  submitBtn.disabled = false;

  renderSingleQuestion();
  startTimer();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goPrev() {
  if (!started || currentQuestionIndex === 0) return;
  currentQuestionIndex--;
  renderSingleQuestion();
}

function goNext() {
  if (!started || currentQuestionIndex >= currentQuestions.length - 1) return;
  currentQuestionIndex++;
  renderSingleQuestion();
}

function buildResultData() {
  let score = 0;
  const wrongQuestions = [];

  currentQuestions.forEach((q, i) => {
    const studentAns = userAnswers[i];
    const correct = studentAns === q.ans;

    if (correct) {
      score++;
    } else {
      wrongQuestions.push({
        index: i + 1,
        cat: q.cat || "",
        type: q.type || "",
        question: q.q || "",
        studentAnswer: studentAns === null ? "未作答" : (q.opts?.[studentAns] ?? "未作答"),
        correctAnswer: q.opts?.[q.ans] ?? "",
        explanation: q.exp || ""
      });
    }
  });

  const total = currentQuestions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const timeUsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

  return {
    studentName: studentNameInput.value.trim(),
    className: classNameInput.value.trim(),
    studentNo: studentNoInput.value.trim(),
    paper: currentBankName,
    score,
    total,
    percentage,
    timeUsed,
    wrongQuestions
  };
}

function renderResult(result, levelInfo) {
  document.getElementById("rName").textContent = result.studentName;
  document.getElementById("rClass").textContent = result.className;
  document.getElementById("rNo").textContent = result.studentNo;
  document.getElementById("rPaper").textContent = result.paper;
  document.getElementById("rScore").textContent = `${result.score} / ${result.total}（${result.percentage}%）`;
  document.getElementById("rTime").textContent = `${result.timeUsed} 秒`;

  if (levelInfo.newLv > levelInfo.oldLv) {
    levelUpText.textContent = `恭喜升上 LV ${levelInfo.newLv}！`;
    levelUpBox.classList.remove("hidden");
  } else {
    levelUpBox.classList.add("hidden");
  }

  const wrongList = document.getElementById("wrongList");
  wrongList.innerHTML = "";

  if (!result.wrongQuestions.length) {
    wrongList.innerHTML = `<div class="wrong-item">全對，做得很好！</div>`;
  } else {
    result.wrongQuestions.forEach(item => {
      const div = document.createElement("div");
      div.className = "wrong-item";
      div.innerHTML = `
        <strong>第 ${item.index} 題【${item.cat}｜${item.type}】</strong>
        <p>${item.question}</p>
        <p><strong>你的答案：</strong>${item.studentAnswer}</p>
        <p><strong>正確答案：</strong>${item.correctAnswer}</p>
        <p><strong>解說：</strong>${item.explanation}</p>
      `;
      wrongList.appendChild(div);
    });
  }

  resultSection.classList.remove("hidden");
}

function submitQuiz() {
  if (!started) {
    alert("請先開始作答。");
    return;
  }

  if (submitted) {
    alert("你已提交過本次試卷。");
    return;
  }

  stopTimer();

  const unansweredCount = userAnswers.filter(v => v === null || v === undefined).length;
  if (unansweredCount > 0) {
    const ok = confirm(`你仍有 ${unansweredCount} 題未作答，是否仍要提交？`);
    if (!ok) {
      resumeTimer();
      return;
    }
  }

  const result = buildResultData();
  submitted = true;
  submitBtn.disabled = true;

  const levelInfo = updateGameLevel(result.score, result.total);
  renderResult(result, levelInfo);

  window.scrollTo({
    top: resultSection.offsetTop - 12,
    behavior: "smooth"
  });
}

function resetAll() {
  stopTimer();

  started = false;
  submitted = false;
  currentBankName = "";
  currentQuestions = [];
  currentQuestionIndex = 0;
  userAnswers = [];

  quizTitle.textContent = "請先開始作答";
  quizMeta.textContent = "選擇題庫後開始";
  singleQuestionWrap.innerHTML = `<div class="empty-state">請先填寫學生資料並按「開始闖關」。</div>`;
  timerEl.textContent = "00:00";

  progressText.textContent = "0 / 0";
  progressFill.style.width = "0%";
  currentQNo.textContent = "0";
  answeredCountEl.textContent = "0";

  submitBtn.disabled = true;
  prevBtn.disabled = true;
  nextBtn.disabled = true;

  resultSection.classList.add("hidden");
  levelUpBox.classList.add("hidden");
}

bankSelect.addEventListener("change", updateBankStatus);
startBtn.addEventListener("click", startQuiz);
submitBtn.addEventListener("click", submitQuiz);
resetBtn.addEventListener("click", resetAll);
prevBtn.addEventListener("click", goPrev);
nextBtn.addEventListener("click", goNext);

renderBankOptions();
renderProgressData();
updateProgress();
