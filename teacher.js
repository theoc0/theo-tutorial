const TEACHER_PASSWORD = "1234";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzx79_-i9JzU_P6pM-daF26m4ByC5-cx3DxczqZH221ozzi5h75x3_1H4nsiwkvPCOU/exec";

const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMsg = document.getElementById("loginMsg");
const passwordInput = document.getElementById("teacherPassword");

const filterClass = document.getElementById("filterClass");
const filterName = document.getElementById("filterName");
const filterPaper = document.getElementById("filterPaper");
const loadResultsBtn = document.getElementById("loadResultsBtn");
const printBtn = document.getElementById("printBtn");

const statCount = document.getElementById("statCount");
const statAvg = document.getElementById("statAvg");
const statMax = document.getElementById("statMax");
const statMin = document.getElementById("statMin");

const resultsTableBody = document.querySelector("#resultsTable tbody");

let allRows = [];

function isLoggedIn() {
  return localStorage.getItem("teacher_logged_in") === "yes";
}

function showDashboard() {
  if (dashboard) dashboard.classList.remove("hidden");
}

function hideDashboard() {
  if (dashboard) dashboard.classList.add("hidden");
}

function login() {
  const pw = passwordInput?.value || "";
  if (pw === TEACHER_PASSWORD) {
    localStorage.setItem("teacher_logged_in", "yes");
    loginMsg.textContent = "登入成功";
    showDashboard();
    loadResults();
  } else {
    loginMsg.textContent = "密碼錯誤";
  }
}

function logout() {
  localStorage.removeItem("teacher_logged_in");
  hideDashboard();
  loginMsg.textContent = "已登出";
}

async function fetchResults() {
  const res = await fetch(APPS_SCRIPT_URL);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function normalizeRow(row) {
  return {
    Timestamp: row.Timestamp || "",
    StudentName: row.StudentName || "",
    ClassName: row.ClassName || "",
    StudentNo: row.StudentNo || "",
    Paper: row.Paper || "",
    Score: Number(row.Score || 0),
    Total: Number(row.Total || 0),
    Percentage: Number(row.Percentage || 0),
    TimeUsed: Number(row.TimeUsed || 0),
    WrongQuestions: row.WrongQuestions || ""
  };
}

function applyFilters(rows) {
  const classKeyword = (filterClass?.value || "").trim();
  const nameKeyword = (filterName?.value || "").trim();
  const paperKeyword = (filterPaper?.value || "").trim();

  return rows.filter(row => {
    const okClass = !classKeyword || String(row.ClassName).includes(classKeyword);
    const okName = !nameKeyword || String(row.StudentName).includes(nameKeyword);
    const okPaper = !paperKeyword || String(row.Paper).includes(paperKeyword);
    return okClass && okName && okPaper;
  });
}

function updateStats(rows) {
  const count = rows.length;
  const percentages = rows.map(r => Number(r.Percentage || 0));

  const avg = count ? (percentages.reduce((a, b) => a + b, 0) / count).toFixed(1) : "0.0";
  const max = count ? Math.max(...percentages) : 0;
  const min = count ? Math.min(...percentages) : 0;

  if (statCount) statCount.textContent = count;
  if (statAvg) statAvg.textContent = `${avg}%`;
  if (statMax) statMax.textContent = `${max}%`;
  if (statMin) statMin.textContent = `${min}%`;
}

function prettyWrongQuestions(raw) {
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return String(raw);

    return parsed.map(item => {
      return [
        `第 ${item.index} 題【${item.cat}｜${item.type}】`,
        `題目：${item.question}`,
        `你的答案：${item.studentAnswer}`,
        `正確答案：${item.correctAnswer}`,
        `解說：${item.explanation}`
      ].join("\n");
    }).join("\n\n");
  } catch {
    return String(raw);
  }
}

function renderTable(rows) {
  if (!resultsTableBody) return;
  resultsTableBody.innerHTML = "";

  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.Timestamp}</td>
      <td>${row.StudentName}</td>
      <td>${row.ClassName}</td>
      <td>${row.StudentNo}</td>
      <td>${row.Paper}</td>
      <td>${row.Score}</td>
      <td>${row.Total}</td>
      <td>${row.Percentage}%</td>
      <td>${row.TimeUsed}</td>
      <td>
        <details>
          <summary>查看</summary>
          <pre style="white-space:pre-wrap;">${escapeHtml(prettyWrongQuestions(row.WrongQuestions))}</pre>
        </details>
      </td>
    `;
    resultsTableBody.appendChild(tr);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadResults() {
  try {
    loginMsg.textContent = "載入中...";
    const rows = await fetchResults();
    allRows = rows.map(normalizeRow);

    const filtered = applyFilters(allRows);
    updateStats(filtered);
    renderTable(filtered);

    loginMsg.textContent = `已載入 ${filtered.length} 筆紀錄`;
  } catch (error) {
    console.error(error);
    loginMsg.textContent = "讀取成績失敗";
    alert("讀取成績失敗，請檢查 Apps Script 權限及網址設定。");
  }
}

function rerenderFiltered() {
  const filtered = applyFilters(allRows);
  updateStats(filtered);
  renderTable(filtered);
}

if (loginBtn) loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (loadResultsBtn) loadResultsBtn.addEventListener("click", loadResults);
if (printBtn) printBtn.addEventListener("click", () => window.print());

if (filterClass) filterClass.addEventListener("input", rerenderFiltered);
if (filterName) filterName.addEventListener("input", rerenderFiltered);
if (filterPaper) filterPaper.addEventListener("input", rerenderFiltered);

if (passwordInput) {
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
}

if (isLoggedIn()) {
  showDashboard();
  loadResults();
} else {
  hideDashboard();
}
