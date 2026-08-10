(function () {
  "use strict";

  var DATA = window.QUESTION_DATA;
  var STORAGE_KEY = "studyapp_progress_v1";
  var DAY_MS = 24 * 60 * 60 * 1000;
  var INTERVAL_DAYS = [0, 1, 3, 7, 14, 30]; // box 0..5 の復習間隔(日)
  var MASTERED_BOX = 4; // このboxに到達したら「習得」扱い
  var WEAK_BOX_CEILING = 3; // このbox未満かつ一度でも間違えていたら「苦手」

  // ---------- 進捗データ(localStorage) ----------
  var progress = loadProgress();

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      /* localStorageが使えない環境では記録をあきらめる */
    }
  }

  function getStat(id) {
    if (!progress[id]) {
      progress[id] = { box: 0, nextReview: 0, attempts: 0, correct: 0, wasWrong: false };
    }
    return progress[id];
  }

  function recordAnswer(id, correct) {
    var stat = getStat(id);
    var now = Date.now();
    stat.attempts++;
    if (correct) {
      stat.correct++;
      stat.box = Math.min(stat.box + 1, 5);
      stat.nextReview = now + INTERVAL_DAYS[stat.box] * DAY_MS;
    } else {
      stat.wasWrong = true;
      stat.box = 0;
      stat.nextReview = now;
    }
    saveProgress();
  }

  function allSubjectKeys() {
    return Object.keys(DATA);
  }

  function computeDueWeak() {
    var now = Date.now();
    var list = [];
    allSubjectKeys().forEach(function (key) {
      DATA[key].questions.forEach(function (q) {
        var stat = progress[q.id];
        if (stat && stat.wasWrong && stat.box < WEAK_BOX_CEILING && stat.nextReview <= now) {
          list.push({ subjectKey: key, question: q });
        }
      });
    });
    return list;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ---------- 画面遷移 ----------
  var screens = {
    home: document.getElementById("screen-home"),
    quiz: document.getElementById("screen-quiz"),
    result: document.getElementById("screen-result"),
    stats: document.getElementById("screen-stats")
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle("hidden", key !== name);
    });
    window.scrollTo(0, 0);
  }

  // ---------- ホーム画面 ----------
  function renderHome() {
    var due = computeDueWeak();
    var weakSub = document.getElementById("weak-card-sub");
    var weakCard = document.getElementById("weak-card");
    var weakBtn = document.getElementById("btn-weak-review");
    if (due.length > 0) {
      weakSub.textContent = "今日の復習: " + due.length + "問";
      weakCard.classList.remove("disabled");
      weakBtn.disabled = false;
    } else {
      weakSub.textContent = "今日の復習はありません 🎉";
      weakCard.classList.add("disabled");
      weakBtn.disabled = true;
    }

    var grid = document.getElementById("subject-grid");
    grid.innerHTML = "";
    allSubjectKeys().forEach(function (key) {
      var subject = DATA[key];
      var total = subject.questions.length;
      var mastered = subject.questions.filter(function (q) {
        var stat = progress[q.id];
        return stat && stat.box >= MASTERED_BOX;
      }).length;

      var card = document.createElement("div");
      card.className = "subject-card";
      card.innerHTML =
        '<div class="subject-card-left">' +
          '<span class="subject-dot" style="background:' + subject.color + '"></span>' +
          '<div>' +
            '<div class="subject-name">' + subject.label + '</div>' +
            '<div class="subject-sub">習得 ' + mastered + ' / ' + total + '問</div>' +
          '</div>' +
        '</div>' +
        '<span class="subject-arrow">›</span>';
      card.addEventListener("click", function () {
        startSubjectQuiz(key);
      });
      grid.appendChild(card);
    });
  }

  // ---------- クイズセッション ----------
  var session = null; // { mode, subjectKey, queue, index, correctCount }

  function startSubjectQuiz(key) {
    var subject = DATA[key];
    session = {
      mode: "subject",
      subjectKey: key,
      title: subject.label,
      queue: shuffle(subject.questions),
      index: 0,
      correctCount: 0
    };
    showScreen("quiz");
    renderQuestion();
  }

  function startWeakReview() {
    var due = computeDueWeak();
    if (due.length === 0) return;
    session = {
      mode: "weak",
      subjectKey: null,
      title: "苦手分野の復習",
      queue: shuffle(due).map(function (item) { return item.question; }),
      index: 0,
      correctCount: 0
    };
    showScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    var q = session.queue[session.index];
    document.getElementById("quiz-title").textContent = session.title;
    document.getElementById("quiz-progress").textContent = (session.index + 1) + "/" + session.queue.length;
    document.getElementById("progress-fill").style.width = ((session.index) / session.queue.length * 100) + "%";
    document.getElementById("quiz-category").textContent = q.category;
    document.getElementById("quiz-question").textContent = q.question;

    var explanationEl = document.getElementById("quiz-explanation");
    explanationEl.classList.add("hidden");
    explanationEl.textContent = "";
    document.getElementById("btn-next").classList.add("hidden");

    // 選択肢の表示順をシャッフルする(正解が常に同じ位置にならないように)
    var order = shuffle(q.choices.map(function (_, i) { return i; }));
    session.currentCorrectIndex = order.indexOf(q.answer);

    var choicesEl = document.getElementById("quiz-choices");
    choicesEl.innerHTML = "";
    order.forEach(function (originalIdx, displayIdx) {
      var btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = q.choices[originalIdx];
      btn.addEventListener("click", function () {
        onAnswer(q, displayIdx);
      });
      choicesEl.appendChild(btn);
    });
  }

  function onAnswer(q, chosenIdx) {
    var buttons = document.querySelectorAll("#quiz-choices .choice-btn");
    var correctIdx = session.currentCorrectIndex;
    var correct = chosenIdx === correctIdx;

    buttons.forEach(function (btn, idx) {
      btn.classList.add("disabled");
      if (idx === correctIdx) btn.classList.add("correct");
      else if (idx === chosenIdx) btn.classList.add("wrong");
    });

    var explanationEl = document.getElementById("quiz-explanation");
    explanationEl.textContent = (correct ? "正解! " : "不正解。正解は「" + q.choices[q.answer] + "」。 ") + q.explanation;
    explanationEl.classList.remove("hidden");

    document.getElementById("btn-next").classList.remove("hidden");

    recordAnswer(q.id, correct);
    if (correct) session.correctCount++;
  }

  function nextQuestion() {
    session.index++;
    if (session.index >= session.queue.length) {
      showResult();
    } else {
      renderQuestion();
    }
  }

  function showResult() {
    document.getElementById("progress-fill").style.width = "100%";
    var total = session.queue.length;
    var score = session.correctCount;
    document.getElementById("result-score").textContent = score + " / " + total;

    var pct = total > 0 ? score / total : 0;
    var msg;
    if (pct === 1) msg = "満点です!すばらしい!";
    else if (pct >= 0.8) msg = "よくできました!";
    else if (pct >= 0.5) msg = "その調子!復習で苦手をつぶしていこう。";
    else msg = "間違えた問題は「苦手分野の復習」に記録されました。";
    document.getElementById("result-message").textContent = msg;

    showScreen("result");
  }

  // ---------- 統計画面 ----------
  function renderStats() {
    var body = document.getElementById("stats-body");
    body.innerHTML = "";

    allSubjectKeys().forEach(function (key) {
      var subject = DATA[key];
      var total = subject.questions.length;
      var attempted = 0, correctSum = 0, attemptSum = 0, mastered = 0;
      subject.questions.forEach(function (q) {
        var stat = progress[q.id];
        if (stat && stat.attempts > 0) {
          attempted++;
          correctSum += stat.correct;
          attemptSum += stat.attempts;
        }
        if (stat && stat.box >= MASTERED_BOX) mastered++;
      });
      var accuracy = attemptSum > 0 ? Math.round((correctSum / attemptSum) * 100) : 0;
      var masteredPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

      var card = document.createElement("div");
      card.className = "stats-card";
      card.innerHTML =
        '<div class="stats-card-title"><span class="subject-dot" style="background:' + subject.color + '"></span>' + subject.label + '</div>' +
        '<div class="stats-row"><span>取り組んだ問題</span><b>' + attempted + ' / ' + total + '</b></div>' +
        '<div class="stats-row"><span>正答率</span><b>' + accuracy + '%</b></div>' +
        '<div class="stats-row"><span>習得済み</span><b>' + mastered + ' / ' + total + '</b></div>' +
        '<div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + masteredPct + '%;background:' + subject.color + '"></div></div>';
      body.appendChild(card);
    });

    var due = computeDueWeak();
    var weakCard = document.createElement("div");
    weakCard.className = "stats-card";
    weakCard.innerHTML =
      '<div class="stats-card-title">🔁 苦手分野</div>' +
      '<div class="stats-row"><span>今日復習できる問題</span><b>' + due.length + '</b></div>';
    body.appendChild(weakCard);
  }

  // ---------- イベント登録 ----------
  document.getElementById("btn-weak-review").addEventListener("click", startWeakReview);

  document.getElementById("btn-quiz-back").addEventListener("click", function () {
    session = null;
    renderHome();
    showScreen("home");
  });

  document.getElementById("btn-next").addEventListener("click", nextQuestion);

  document.getElementById("btn-result-home").addEventListener("click", function () {
    session = null;
    renderHome();
    showScreen("home");
  });

  document.getElementById("btn-result-retry").addEventListener("click", function () {
    if (!session) return;
    if (session.mode === "subject") startSubjectQuiz(session.subjectKey);
    else startWeakReview();
  });

  document.getElementById("btn-stats").addEventListener("click", function () {
    renderStats();
    showScreen("stats");
  });

  document.getElementById("btn-stats-back").addEventListener("click", function () {
    renderHome();
    showScreen("home");
  });

  document.getElementById("btn-reset-progress").addEventListener("click", function () {
    if (window.confirm("すべての学習記録をリセットします。よろしいですか?")) {
      progress = {};
      saveProgress();
      renderStats();
      renderHome();
    }
  });

  // ---------- 初期化 ----------
  renderHome();
  showScreen("home");

  // Service Worker登録(オフライン対応)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* file://で開いた場合など、SW非対応環境では無視 */
      });
    });
  }
})();
