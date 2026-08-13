// ============================================================
// 入社試験対策 学習アプリ - コアロジック
// (画面遷移・保存・出題エンジン・ホーム画面)
// 診断/模擬試験/履歴/問題管理は features.js に分かれている。
// ============================================================
window.App = (function () {
  "use strict";

  var STORAGE_KEY = "ntt_claruty_app_v1";
  var DAY_MS = 24 * 60 * 60 * 1000;
  var INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]; // box 0..5 の復習間隔(日)
  var MASTERED_BOX = 4;
  var WEAK_BOX_CEILING = 3; // このbox未満かつ一度でも間違えていたら「復習対象」
  var MIN_JUDGE_ATTEMPTS = 5; // 分野の苦手判定に必要な最低回答数
  var SESSION_SIZE = 20; // 通常学習モードの1回あたりの出題数上限

  var LEVEL_INFO = {
    1: { label: "LEVEL 1", sub: "基礎(小学校高学年〜中1)" },
    2: { label: "LEVEL 2", sub: "中学2年" },
    3: { label: "LEVEL 3", sub: "中学3年" },
    4: { label: "LEVEL 4", sub: "高校基礎" },
    5: { label: "LEVEL 5", sub: "高卒採用試験想定" }
  };

  var SUBJECT_INFO = {
    kokugo: { label: "国語", color: "#be123c" },
    math: { label: "数学", color: "#1d4ed8" },
    eigo: { label: "英語", color: "#0f766e" }
  };
  var SUBJECT_ORDER = ["kokugo", "math", "eigo"];

  // ---------------- 保存データ ----------------
  function defaultData() {
    return { progress: {}, history: [], customQuestions: [], diagnostic: null };
  }

  var data = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultData(), parsed);
    } catch (e) {
      return defaultData();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      toast("保存に失敗しました(ストレージの空き容量をご確認ください)");
    }
  }

  // ---------------- ユーティリティ ----------------
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function toHalfWidth(s) {
    return s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
  }

  function normalizeAnswer(s) {
    if (s == null) return "";
    return toHalfWidth(String(s)).replace(/\s+/g, "").replace(/[。.、,]+$/g, "").toLowerCase();
  }

  function formatDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + "分" + String(s).padStart(2, "0") + "秒";
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  // ---------------- 問題プール ----------------
  function builtinPool(subject) {
    if (subject === "kokugo") return window.NTT_Q_KOKUGO || [];
    if (subject === "math") return window.NTT_Q_MATH || [];
    if (subject === "eigo") return window.NTT_Q_EIGO || [];
    return [];
  }

  function getPool(subject) {
    var custom = data.customQuestions.filter(function (q) { return q.subject === subject; });
    return builtinPool(subject).concat(custom);
  }

  function getAllPool() {
    return SUBJECT_ORDER.reduce(function (acc, s) { return acc.concat(getPool(s)); }, []);
  }

  function getCategories(subject) {
    var set = {};
    getPool(subject).forEach(function (q) { set[q.category] = true; });
    return Object.keys(set).sort();
  }

  function findQuestionById(id) {
    var all = getAllPool();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  // ---------------- 進捗(問題ごと) ----------------
  function getStat(qid) {
    if (!data.progress[qid]) {
      data.progress[qid] = { attempts: 0, correct: 0, wrong: 0, box: 0, nextReview: 0, lastAnsweredAt: 0, lastCorrect: null };
    }
    return data.progress[qid];
  }

  function recordAnswer(q, correct) {
    var stat = getStat(q.id);
    var now = Date.now();
    stat.attempts++;
    stat.lastAnsweredAt = now;
    stat.lastCorrect = correct;
    if (correct) {
      stat.correct++;
      stat.box = Math.min(stat.box + 1, 5);
      stat.nextReview = now + INTERVAL_DAYS[stat.box] * DAY_MS;
    } else {
      stat.wrong++;
      stat.box = 0;
      stat.nextReview = now;
    }
    save();
  }

  // ---------------- 分野別の正答率・苦手判定 ----------------
  function computeCategoryStats(subject) {
    var pool = getPool(subject);
    var byCat = {};
    pool.forEach(function (q) {
      var stat = data.progress[q.id];
      if (!stat || stat.attempts === 0) return;
      if (!byCat[q.category]) byCat[q.category] = { attempts: 0, correct: 0 };
      byCat[q.category].attempts += stat.attempts;
      byCat[q.category].correct += stat.correct;
    });
    var result = {};
    Object.keys(byCat).forEach(function (cat) {
      var c = byCat[cat];
      var accuracy = c.attempts > 0 ? c.correct / c.attempts : 0;
      var judged = c.attempts >= MIN_JUDGE_ATTEMPTS;
      result[cat] = {
        attempts: c.attempts,
        correct: c.correct,
        accuracy: accuracy,
        judged: judged,
        weak: judged ? accuracy < 0.6 : null
      };
    });
    return result;
  }

  function computeOverallAccuracy(subject) {
    var pool = getPool(subject);
    var attempts = 0, correct = 0;
    pool.forEach(function (q) {
      var stat = data.progress[q.id];
      if (stat) { attempts += stat.attempts; correct += stat.correct; }
    });
    return { attempts: attempts, correct: correct, accuracy: attempts > 0 ? correct / attempts : 0 };
  }

  // ---------------- 画面遷移 ----------------
  var SCREENS = ["home", "category-picker", "exam-setup", "quiz", "result", "history", "admin"];
  function showScreen(name) {
    SCREENS.forEach(function (s) {
      var el = document.getElementById("screen-" + s);
      if (el) el.classList.toggle("hidden", s !== name);
    });
    window.scrollTo(0, 0);
  }

  // ---------------- 出題エンジン(共通) ----------------
  var session = null;

  function startSession(config) {
    if (!config.queue || config.queue.length === 0) {
      toast("出題できる問題がありませんでした。条件を変えてお試しください。");
      return false;
    }
    session = {
      kind: config.kind, // "study" | "diagnostic" | "exam"
      mode: config.mode,
      title: config.title,
      subjectSingle: config.subjectSingle || null,
      queue: config.queue,
      index: 0,
      answers: [],
      pendingChoiceIdx: null,
      currentCorrectIdx: null,
      startedAt: Date.now(),
      timeLimitSec: config.timeLimitSec || null,
      timeLeftSec: config.timeLimitSec || null,
      timerHandle: null
    };
    showScreen("quiz");
    var timerEl = document.getElementById("quiz-timer");
    if (session.timeLimitSec) {
      timerEl.classList.remove("hidden");
      updateTimerDisplay();
      session.timerHandle = setInterval(tickTimer, 1000);
    } else {
      timerEl.classList.add("hidden");
    }
    renderQuestion();
    return true;
  }

  function tickTimer() {
    if (!session) return;
    session.timeLeftSec--;
    updateTimerDisplay();
    if (session.timeLeftSec <= 0) {
      toast("時間切れです。ここまでの結果を集計します。");
      finishSession();
    }
  }

  function updateTimerDisplay() {
    var timerEl = document.getElementById("quiz-timer");
    var m = Math.floor(session.timeLeftSec / 60), s = session.timeLeftSec % 60;
    timerEl.textContent = "残り " + m + ":" + String(s).padStart(2, "0");
    timerEl.classList.toggle("timer-warn", session.timeLeftSec <= 60);
  }

  function stopTimer() {
    if (session && session.timerHandle) {
      clearInterval(session.timerHandle);
      session.timerHandle = null;
    }
  }

  function renderQuestion() {
    var q = session.queue[session.index];
    session.questionStartedAt = Date.now();
    session.pendingChoiceIdx = null;

    document.getElementById("quiz-progress").textContent = (session.index + 1) + "/" + session.queue.length;
    document.getElementById("progress-fill").style.width = (session.index / session.queue.length * 100) + "%";

    var levelInfo = LEVEL_INFO[q.level] || { label: "LEVEL " + q.level, sub: "" };
    document.getElementById("quiz-level-badge").textContent = levelInfo.label + "(" + levelInfo.sub + ")";
    document.getElementById("quiz-subject-badge").textContent = (SUBJECT_INFO[q.subject] || {}).label || q.subject;
    document.getElementById("quiz-category-badge").textContent = q.category;
    document.getElementById("quiz-question").textContent = q.question;

    var explanationEl = document.getElementById("quiz-explanation");
    explanationEl.classList.add("hidden");
    document.getElementById("quiz-steps").classList.add("hidden");
    document.getElementById("quiz-steps").innerHTML = "";
    document.getElementById("quiz-explanation-text").textContent = "";
    document.getElementById("quiz-result-label").textContent = "";
    document.getElementById("quiz-result-label").className = "result-label";

    var btnSubmit = document.getElementById("btn-submit");
    var btnNext = document.getElementById("btn-next");
    btnSubmit.classList.remove("hidden");
    btnSubmit.disabled = false;
    btnNext.classList.add("hidden");

    var choicesEl = document.getElementById("quiz-choices");
    var inputArea = document.getElementById("quiz-input-area");
    var inputEl = document.getElementById("quiz-input");

    if (q.type === "input") {
      choicesEl.innerHTML = "";
      choicesEl.classList.add("hidden");
      inputArea.classList.remove("hidden");
      inputEl.value = "";
      inputEl.className = "quiz-input";
      inputEl.disabled = false;
      setTimeout(function () { inputEl.focus(); }, 30);
    } else {
      inputArea.classList.add("hidden");
      choicesEl.classList.remove("hidden");
      choicesEl.innerHTML = "";
      var order = shuffle(q.choices.map(function (_, i) { return i; }));
      session.currentCorrectIdx = order.indexOf(q.choices.indexOf(q.answer));
      order.forEach(function (originalIdx, displayIdx) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.textContent = q.choices[originalIdx];
        btn.addEventListener("click", function () {
          if (btn.classList.contains("disabled")) return;
          Array.prototype.forEach.call(choicesEl.children, function (b) { b.classList.remove("selected"); });
          btn.classList.add("selected");
          session.pendingChoiceIdx = displayIdx;
        });
        choicesEl.appendChild(btn);
      });
    }
  }

  function submitAnswer() {
    var q = session.queue[session.index];
    var correct;
    var userAnswerText;

    if (q.type === "input") {
      var raw = document.getElementById("quiz-input").value;
      if (!raw || !raw.trim()) { toast("答えを入力してください"); return; }
      userAnswerText = raw.trim();
      var accepted = [q.answer].concat(q.acceptableAnswers || []).map(normalizeAnswer);
      correct = accepted.indexOf(normalizeAnswer(raw)) !== -1;
      var inputEl = document.getElementById("quiz-input");
      inputEl.disabled = true;
      inputEl.classList.add(correct ? "correct" : "wrong");
    } else {
      if (session.pendingChoiceIdx === null) { toast("選択肢を選んでください"); return; }
      correct = session.pendingChoiceIdx === session.currentCorrectIdx;
      userAnswerText = q.choices[session.pendingChoiceIdx] || "";
      var buttons = document.querySelectorAll("#quiz-choices .choice-btn");
      buttons.forEach(function (btn, idx) {
        btn.classList.add("disabled");
        if (idx === session.currentCorrectIdx) btn.classList.add("correct");
        else if (idx === session.pendingChoiceIdx) btn.classList.add("wrong");
      });
    }

    var resultLabel = document.getElementById("quiz-result-label");
    resultLabel.textContent = correct ? "◯ 正解です" : "✕ 不正解です(正解:" + q.answer + ")";
    resultLabel.className = "result-label " + (correct ? "is-correct" : "is-wrong");

    if (q.steps && q.steps.length) {
      var stepsEl = document.getElementById("quiz-steps");
      stepsEl.innerHTML = q.steps.map(function (line) {
        return '<div class="step-line">' + escapeHtml(line) + "</div>";
      }).join("");
      stepsEl.classList.remove("hidden");
    }
    document.getElementById("quiz-explanation-text").textContent = q.explanation || "";
    document.getElementById("quiz-explanation").classList.remove("hidden");

    document.getElementById("btn-submit").classList.add("hidden");
    var btnNext = document.getElementById("btn-next");
    btnNext.classList.remove("hidden");
    btnNext.textContent = (session.index === session.queue.length - 1) ? "結果を見る" : "次の問題へ";

    recordAnswer(q, correct);
    var timeSpentSec = (Date.now() - session.questionStartedAt) / 1000;
    session.answers.push({
      id: q.id, subject: q.subject, category: q.category, level: q.level,
      correct: correct, userAnswer: userAnswerText, timeSpentSec: timeSpentSec
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function nextQuestion() {
    session.index++;
    if (session.index >= session.queue.length) {
      finishSession();
    } else {
      renderQuestion();
    }
  }

  function quitSession() {
    if (!session) { showScreen("home"); return; }
    if (!window.confirm("学習を中断してホームに戻りますか?ここまでの回答は記録されます。")) return;
    stopTimer();
    session = null;
    renderHome();
    showScreen("home");
  }

  function finishSession() {
    stopTimer();
    var total = session.answers.length;
    var correctCount = session.answers.filter(function (a) { return a.correct; }).length;
    var durationSec = (Date.now() - session.startedAt) / 1000;

    var bySubject = {};
    var byCategory = {};
    session.answers.forEach(function (a) {
      if (!bySubject[a.subject]) bySubject[a.subject] = { attempts: 0, correct: 0 };
      bySubject[a.subject].attempts++;
      if (a.correct) bySubject[a.subject].correct++;

      var key = a.subject + "::" + a.category;
      if (!byCategory[key]) byCategory[key] = { subject: a.subject, category: a.category, attempts: 0, correct: 0 };
      byCategory[key].attempts++;
      if (a.correct) byCategory[key].correct++;
    });

    session.summary = {
      total: total, correctCount: correctCount,
      accuracy: total > 0 ? correctCount / total : 0,
      durationSec: durationSec, bySubject: bySubject, byCategory: byCategory
    };

    data.history.push({
      id: uid("hist"),
      date: Date.now(),
      kind: session.kind,
      mode: session.mode,
      title: session.title,
      count: total,
      correct: correctCount,
      accuracy: session.summary.accuracy,
      durationSec: durationSec,
      bySubject: bySubject
    });
    if (data.history.length > 300) data.history = data.history.slice(-300);
    save();

    if (session.kind === "diagnostic" && App.renderDiagnosticResult) {
      App.renderDiagnosticResult(session);
    } else if (session.kind === "exam" && App.renderExamResult) {
      App.renderExamResult(session);
    } else {
      renderStudyResult(session);
    }
    showScreen("result");
  }

  function renderStudyResult(sess) {
    var s = sess.summary;
    var pct = Math.round(s.accuracy * 100);
    var msg;
    if (pct === 100) msg = "満点です!とても良い調子です。";
    else if (pct >= 80) msg = "よくできました。この調子で続けましょう。";
    else if (pct >= 50) msg = "半分以上正解できました。間違えた問題はあとで復習できます。";
    else msg = "間違えた問題は自動的に復習リストに入ります。焦らず少しずつ進めましょう。";

    var wrongItems = sess.answers.filter(function (a) { return !a.correct; }).map(function (a) {
      var q = findQuestionById(a.id);
      if (!q) return "";
      return '<div class="mistake-item"><div class="mistake-q">' + escapeHtml(q.question) + '</div>' +
        '<div class="mistake-ans">正解: ' + escapeHtml(q.answer) + '</div>' +
        '<div class="mistake-exp">' + escapeHtml(q.explanation || "") + '</div></div>';
    }).join("");

    document.getElementById("result-body").innerHTML =
      '<div class="result-hero">' +
        '<div class="result-score">' + s.correctCount + ' / ' + s.total + '</div>' +
        '<div class="result-sub">' + escapeHtml(sess.title) + '(正答率 ' + pct + '%・所要時間 ' + escapeHtml(formatDuration(s.durationSec)) + ')</div>' +
        '<div class="result-sub">' + escapeHtml(msg) + '</div>' +
      '</div>' +
      (wrongItems ? '<h3 class="section-title">間違えた問題</h3><div class="mistake-list">' + wrongItems + '</div>' : '') +
      '<div class="result-actions">' +
        '<button class="btn btn-primary" data-action="result-retry">もう一度同じ条件で学習</button>' +
        '<button class="btn btn-secondary" data-action="nav-home">ホームに戻る</button>' +
      '</div>';
  }

  // ---------------- ホーム画面 ----------------
  function renderHome() {
    var banner = document.getElementById("home-diagnostic-banner");
    banner.classList.toggle("hidden", !!data.diagnostic);

    var grid = document.getElementById("home-level-summary");
    grid.innerHTML = "";
    SUBJECT_ORDER.forEach(function (subject) {
      var info = SUBJECT_INFO[subject];
      var card = document.createElement("div");
      card.className = "level-card";
      var overall = computeOverallAccuracy(subject);
      var html = '<div class="level-card-subject"><span class="level-card-dot" style="background:' + info.color + '"></span>' + info.label + '</div>';

      if (data.diagnostic && data.diagnostic.bySubject[subject]) {
        var diag = data.diagnostic.bySubject[subject];
        html += '<div class="level-card-row"><span>診断結果</span><b>正答率 ' + Math.round(diag.overallAccuracy * 100) + '%</b></div>';
        (diag.levelLadder || []).forEach(function (row) {
          var tagClass = row.status === "十分" ? "level-tag-ok" : (row.status === "要復習" ? "level-tag-review" : "level-tag-none");
          html += '<div class="level-card-row"><span>' + escapeHtml(row.label) + '</span><span class="level-tag ' + tagClass + '">' + escapeHtml(row.status) + '</span></div>';
        });
      } else {
        html += '<div class="level-card-row"><span>診断</span><span class="level-tag level-tag-none">未診断</span></div>';
      }
      html += '<div class="level-card-row"><span>これまでの正答率</span><b>' + (overall.attempts > 0 ? Math.round(overall.accuracy * 100) + '%(' + overall.attempts + '問)' : '記録なし') + '</b></div>';
      card.innerHTML = html;
      grid.appendChild(card);
    });
  }

  // ---------------- 出題キュー作成: 今日の学習 / 弱点克服 / 間違えた問題 ----------------
  function isDue(q) {
    var stat = data.progress[q.id];
    if (!stat || stat.attempts === 0) return true; // 未回答は「出題可能」
    return stat.nextReview <= Date.now();
  }

  function buildTodayQueue() {
    var picks = [];
    SUBJECT_ORDER.forEach(function (subject) {
      var pool = getPool(subject);
      var due = pool.filter(function (q) { var st = data.progress[q.id]; return st && st.wrong > 0 && st.box < WEAK_BOX_CEILING && isDue(q); });
      var fresh = pool.filter(function (q) { var st = data.progress[q.id]; return !st || st.attempts === 0; });
      var reviewOk = pool.filter(function (q) { var st = data.progress[q.id]; return st && st.attempts > 0 && st.wrong === 0 && isDue(q); });
      var mix = shuffle(due).slice(0, 3).concat(shuffle(fresh).slice(0, 4)).concat(shuffle(reviewOk).slice(0, 2));
      picks = picks.concat(mix);
    });
    return shuffle(picks).slice(0, SESSION_SIZE);
  }

  function buildWeakQueue() {
    var picks = [];
    var anyJudged = false;
    SUBJECT_ORDER.forEach(function (subject) {
      var stats = computeCategoryStats(subject);
      var pool = getPool(subject);
      Object.keys(stats).forEach(function (cat) {
        if (stats[cat].judged) anyJudged = true;
        if (stats[cat].weak === true) {
          var catQs = pool.filter(function (q) { return q.category === cat; });
          var due = catQs.filter(isDue);
          picks = picks.concat(shuffle(due).slice(0, 6));
        }
      });
    });
    if (picks.length === 0) {
      if (!anyJudged) toast("判定にはもう少し回答が必要です(各分野5問以上の学習が必要です)");
      else toast("現在、明確な苦手分野は見つかりませんでした。素晴らしいです!");
      return [];
    }
    return shuffle(picks).slice(0, SESSION_SIZE);
  }

  function buildMistakesQueue() {
    var wrongPool = [];
    var weakCategories = {};
    getAllPool().forEach(function (q) {
      var st = data.progress[q.id];
      if (st && st.wrong > 0 && st.box < WEAK_BOX_CEILING && isDue(q)) {
        wrongPool.push(q);
        weakCategories[q.subject + "::" + q.category] = true;
      }
    });
    var supplement = [];
    Object.keys(weakCategories).forEach(function (key) {
      var parts = key.split("::");
      var subject = parts[0], category = parts[1];
      var candidates = getPool(subject).filter(function (q) {
        return q.category === category && (!data.progress[q.id] || data.progress[q.id].attempts === 0);
      });
      supplement = supplement.concat(shuffle(candidates).slice(0, 2));
    });
    if (wrongPool.length === 0) {
      toast("復習できる問題は今のところありません。よく頑張っています!");
      return [];
    }
    return shuffle(wrongPool.concat(supplement)).slice(0, SESSION_SIZE);
  }

  // ---------------- イベント配線 ----------------
  function onAction(action, el) {
    switch (action) {
      case "nav-home": showScreen("home"); renderHome(); break;
      case "nav-history": showScreen("history"); if (App.renderHistory) App.renderHistory(); break;
      case "nav-admin": showScreen("admin"); if (App.renderAdmin) App.renderAdmin(); break;
      case "start-today":
        startSession({ kind: "study", mode: "today", title: "今日の学習", queue: buildTodayQueue() });
        break;
      case "start-weak":
        var weakQueue = buildWeakQueue();
        if (weakQueue.length) startSession({ kind: "study", mode: "weak", title: "弱点克服", queue: weakQueue });
        break;
      case "start-mistakes":
        var mistakesQueue = buildMistakesQueue();
        if (mistakesQueue.length) startSession({ kind: "study", mode: "mistakes", title: "間違えた問題の復習", queue: mistakesQueue });
        break;
      case "open-category-picker": showScreen("category-picker"); if (App.renderCategoryPicker) App.renderCategoryPicker(); break;
      case "open-exam-setup": showScreen("exam-setup"); if (App.renderExamSetup) App.renderExamSetup(); break;
      case "start-diagnostic":
        if (App.startDiagnostic) App.startDiagnostic();
        break;
      case "quit-quiz": quitSession(); break;
      case "result-retry":
        if (session) {
          var cfg = { kind: session.kind, mode: session.mode, title: session.title, queue: shuffle(session.queue.slice()), timeLimitSec: null };
          startSession(cfg);
        }
        break;
      default:
        if (App.handleAction) App.handleAction(action, el);
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    onAction(el.getAttribute("data-action"), el);
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-nav]")) {
      var name = e.target.closest("[data-nav]").getAttribute("data-nav");
      onAction("nav-" + name);
    }
  });

  document.getElementById("btn-submit").addEventListener("click", submitAnswer);
  document.getElementById("btn-next").addEventListener("click", nextQuestion);
  document.getElementById("quiz-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); submitAnswer(); }
  });

  // ---------------- 初期化 ----------------
  function init() {
    renderHome();
    showScreen("home");
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEVEL_INFO: LEVEL_INFO,
    SUBJECT_INFO: SUBJECT_INFO,
    SUBJECT_ORDER: SUBJECT_ORDER,
    MIN_JUDGE_ATTEMPTS: MIN_JUDGE_ATTEMPTS,
    SESSION_SIZE: SESSION_SIZE,
    MASTERED_BOX: MASTERED_BOX,
    WEAK_BOX_CEILING: WEAK_BOX_CEILING,
    data: data,
    save: save,
    shuffle: shuffle,
    uid: uid,
    normalizeAnswer: normalizeAnswer,
    formatDate: formatDate,
    formatDuration: formatDuration,
    toast: toast,
    escapeHtml: escapeHtml,
    getPool: getPool,
    getAllPool: getAllPool,
    getCategories: getCategories,
    findQuestionById: findQuestionById,
    getStat: getStat,
    computeCategoryStats: computeCategoryStats,
    computeOverallAccuracy: computeOverallAccuracy,
    showScreen: showScreen,
    startSession: startSession,
    getSession: function () { return session; },
    renderHome: renderHome,
    isDue: isDue
  };
})();
