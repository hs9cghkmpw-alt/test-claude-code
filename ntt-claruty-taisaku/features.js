// ============================================================
// 診断テスト / 模擬試験 / 学習履歴 / 問題管理
// app.js の App 名前空間にメソッドを追加する。
// ============================================================
(function () {
  "use strict";

  var App = window.App;
  var LADDER_LABELS = { 1: "中学1年相当", 2: "中学2年相当", 3: "中学3年相当", 4: "高校基礎相当" };

  function pickDistinctCategory(pool, n) {
    var shuffled = App.shuffle(pool);
    var chosen = [], usedCat = {};
    shuffled.forEach(function (q) {
      if (chosen.length >= n) return;
      if (!usedCat[q.category]) { chosen.push(q); usedCat[q.category] = true; }
    });
    if (chosen.length < n) {
      shuffled.forEach(function (q) {
        if (chosen.length >= n) return;
        if (chosen.indexOf(q) === -1) chosen.push(q);
      });
    }
    return chosen;
  }

  function pickWeighted(pool, n, weights) {
    var byLevel = {};
    pool.forEach(function (q) { (byLevel[q.level] = byLevel[q.level] || []).push(q); });
    var levels = Object.keys(weights).map(Number);
    var target = {}, assigned = 0;
    levels.forEach(function (lv) {
      var c = Math.round(n * weights[lv]);
      target[lv] = c; assigned += c;
    });
    target[levels[levels.length - 1]] += (n - assigned);

    var chosen = [];
    levels.forEach(function (lv) {
      var avail = App.shuffle(byLevel[lv] || []);
      var take = Math.min(target[lv], avail.length);
      chosen = chosen.concat(avail.slice(0, take));
    });
    if (chosen.length < n) {
      var chosenIds = {}; chosen.forEach(function (q) { chosenIds[q.id] = true; });
      var rest = App.shuffle(pool.filter(function (q) { return !chosenIds[q.id]; }));
      chosen = chosen.concat(rest.slice(0, n - chosen.length));
    }
    return App.shuffle(chosen).slice(0, n);
  }

  // ==================== 診断テスト ====================
  function buildDiagnosticQueue() {
    var queue = [];
    App.SUBJECT_ORDER.forEach(function (subject) {
      var pool = App.getPool(subject);
      [1, 2, 3, 4].forEach(function (level) {
        var levelPool = pool.filter(function (q) { return q.level === level; });
        queue = queue.concat(pickDistinctCategory(levelPool, 3));
      });
    });
    return queue;
  }

  function startDiagnostic() {
    App.startSession({ kind: "diagnostic", mode: "diagnostic", title: "実力診断テスト", queue: buildDiagnosticQueue() });
  }

  function levelStatus(accuracy, total) {
    if (total === 0) return "未測定";
    if (accuracy >= 0.7) return "十分";
    if (accuracy >= 0.4) return "要復習";
    return "未到達";
  }

  function renderDiagnosticResult(sess) {
    var bySubject = {};
    App.SUBJECT_ORDER.forEach(function (subject) {
      var answers = sess.answers.filter(function (a) { return a.subject === subject; });
      var total = answers.length;
      var correct = answers.filter(function (a) { return a.correct; }).length;

      var cats = {};
      answers.forEach(function (a) {
        if (!cats[a.category]) cats[a.category] = { attempts: 0, correct: 0 };
        cats[a.category].attempts++;
        if (a.correct) cats[a.category].correct++;
      });
      var categories = {};
      Object.keys(cats).forEach(function (c) {
        categories[c] = { attempts: cats[c].attempts, correct: cats[c].correct, accuracy: cats[c].correct / cats[c].attempts };
      });

      var levelLadder = [1, 2, 3, 4].map(function (level) {
        var lAnswers = answers.filter(function (a) { return a.level === level; });
        var lTotal = lAnswers.length;
        var lCorrect = lAnswers.filter(function (a) { return a.correct; }).length;
        var acc = lTotal > 0 ? lCorrect / lTotal : 0;
        return { level: level, label: LADDER_LABELS[level], status: levelStatus(acc, lTotal), accuracy: acc, total: lTotal };
      });

      bySubject[subject] = {
        overallAccuracy: total > 0 ? correct / total : 0,
        total: total, correct: correct,
        categories: categories,
        levelLadder: levelLadder
      };
    });

    App.data.diagnostic = { takenAt: Date.now(), bySubject: bySubject };
    App.save();

    var html = '<div class="result-hero"><div class="result-score">診断完了</div>' +
      '<div class="result-sub">国語・数学・英語の実力を分野別・学年別に分析しました。</div></div>';

    App.SUBJECT_ORDER.forEach(function (subject) {
      var info = App.SUBJECT_INFO[subject];
      var s = bySubject[subject];
      html += '<h3 class="section-title">' + info.label + '(正答率 ' + Math.round(s.overallAccuracy * 100) + '%)</h3>';

      html += '<div class="subject-score-card" style="margin-bottom:14px;"><div class="subject-score-title">分野別正答率</div>';
      Object.keys(s.categories).forEach(function (cat) {
        var c = s.categories[cat];
        var pct = Math.round(c.accuracy * 100);
        var cls = pct >= 70 ? "" : (pct >= 40 ? "warn" : "danger");
        html += '<div class="bar-row"><div class="bar-row-label"><span>' + App.escapeHtml(cat) + '</span><b>' + pct + '%</b></div>' +
          '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div></div>';
      });
      html += '</div>';

      html += '<div class="level-ladder">';
      s.levelLadder.forEach(function (row) {
        var tagClass = row.status === "十分" ? "level-tag-ok" : (row.status === "要復習" ? "level-tag-review" : "level-tag-none");
        html += '<div class="level-ladder-row"><span>' + row.label + '</span><span class="level-tag ' + tagClass + '">' + row.status + '</span></div>';
      });
      html += '</div>';
    });

    html += '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="start-today">今日の学習を始める</button>' +
      '<button class="btn btn-secondary" data-action="nav-home">ホームに戻る</button>' +
      '</div>';

    document.getElementById("result-body").innerHTML = html;
  }

  // ==================== 分野別学習 ====================
  var pickerState = { subject: "kokugo", category: null, level: "all" };

  function renderCategoryPicker() {
    var body = document.getElementById("category-picker-body");
    var categories = App.getCategories(pickerState.subject);
    if (pickerState.category === null || categories.indexOf(pickerState.category) === -1) {
      pickerState.category = categories[0] || null;
    }

    var subjectPills = App.SUBJECT_ORDER.map(function (s) {
      var active = s === pickerState.subject ? " active" : "";
      return '<button type="button" class="pill-btn' + active + '" data-action="picker-subject" data-value="' + s + '">' + App.SUBJECT_INFO[s].label + '</button>';
    }).join("");

    var categoryPills = categories.map(function (c) {
      var active = c === pickerState.category ? " active" : "";
      return '<button type="button" class="pill-btn' + active + '" data-action="picker-category" data-value="' + App.escapeHtml(c) + '">' + App.escapeHtml(c) + '</button>';
    }).join("");

    var levels = ["all", 1, 2, 3, 4, 5];
    var levelPills = levels.map(function (lv) {
      var label = lv === "all" ? "すべて" : App.LEVEL_INFO[lv].label + "(" + App.LEVEL_INFO[lv].sub + ")";
      var active = String(lv) === String(pickerState.level) ? " active" : "";
      return '<button type="button" class="pill-btn' + active + '" data-action="picker-level" data-value="' + lv + '">' + label + '</button>';
    }).join("");

    body.innerHTML =
      '<div class="field-group"><span class="field-label">科目</span><div class="pill-row">' + subjectPills + '</div></div>' +
      '<div class="field-group"><span class="field-label">分野(' + categories.length + '件)</span><div class="pill-row">' + (categoryPills || '<span class="small-note">この科目の問題がまだありません</span>') + '</div></div>' +
      '<div class="field-group"><span class="field-label">レベル</span><div class="pill-row">' + levelPills + '</div></div>' +
      '<button class="btn btn-primary btn-block" data-action="picker-start"' + (pickerState.category ? '' : ' disabled') + '>この条件で学習を始める</button>';
  }

  function startCategoryStudy() {
    var pool = App.getPool(pickerState.subject).filter(function (q) {
      if (q.category !== pickerState.category) return false;
      if (pickerState.level !== "all" && String(q.level) !== String(pickerState.level)) return false;
      return true;
    });
    App.startSession({
      kind: "study", mode: "category",
      title: App.SUBJECT_INFO[pickerState.subject].label + "・" + pickerState.category + " の学習",
      queue: App.shuffle(pool).slice(0, App.SESSION_SIZE)
    });
  }

  // ==================== 模擬試験 ====================
  var examState = { mode: "short", subject: "kokugo", timer: true };
  var EXAM_LEVEL_WEIGHTS = { 1: 0.10, 2: 0.20, 3: 0.25, 4: 0.25, 5: 0.20 };

  function renderExamSetup() {
    var body = document.getElementById("exam-setup-body");
    var modes = [
      { key: "short", label: "短時間模試(15問)" },
      { key: "standard", label: "標準模試(45問)" },
      { key: "subject", label: "科目別模試(20問)" }
    ];
    var modePills = modes.map(function (m) {
      var active = m.key === examState.mode ? " active" : "";
      return '<button type="button" class="pill-btn' + active + '" data-action="exam-mode" data-value="' + m.key + '">' + m.label + '</button>';
    }).join("");

    var subjectRow = "";
    if (examState.mode === "subject") {
      var subjectPills = App.SUBJECT_ORDER.map(function (s) {
        var active = s === examState.subject ? " active" : "";
        return '<button type="button" class="pill-btn' + active + '" data-action="exam-subject" data-value="' + s + '">' + App.SUBJECT_INFO[s].label + '</button>';
      }).join("");
      subjectRow = '<div class="field-group"><span class="field-label">科目</span><div class="pill-row">' + subjectPills + '</div></div>';
    }

    var estimateMin = examState.mode === "short" ? 15 : (examState.mode === "standard" ? 45 : 20);

    body.innerHTML =
      '<div class="info-box">実際の採用試験の出題範囲・形式は公表されていないため、この模擬試験は「中学基礎〜高校卒業程度」を想定した練習用の模擬形式です。</div>' +
      '<div class="field-group"><span class="field-label">モード</span><div class="pill-row">' + modePills + '</div></div>' +
      subjectRow +
      '<div class="field-group"><span class="field-label">制限時間(目安 ' + estimateMin + '分)</span>' +
        '<label class="checkbox-row"><input type="checkbox" id="exam-timer-checkbox" ' + (examState.timer ? "checked" : "") + '> 時間制限を有効にする</label></div>' +
      '<button class="btn btn-primary btn-block" data-action="exam-start">模擬試験を開始する</button>';

    var cb = document.getElementById("exam-timer-checkbox");
    if (cb) cb.addEventListener("change", function () { examState.timer = cb.checked; });
  }

  function buildExamQueue() {
    if (examState.mode === "subject") {
      return pickWeighted(App.getPool(examState.subject), 20, EXAM_LEVEL_WEIGHTS);
    }
    var perSubject = examState.mode === "short" ? 5 : 15;
    var queue = [];
    App.SUBJECT_ORDER.forEach(function (subject) {
      queue = queue.concat(pickWeighted(App.getPool(subject), perSubject, EXAM_LEVEL_WEIGHTS));
    });
    return App.shuffle(queue);
  }

  function startExam() {
    var queue = buildExamQueue();
    var minutesMap = { short: 15, standard: 45, subject: 20 };
    var timeLimitSec = examState.timer ? minutesMap[examState.mode] * 60 : null;
    var titleMap = { short: "短時間模試", standard: "標準模試", subject: "科目別模試(" + App.SUBJECT_INFO[examState.subject].label + ")" };
    App.startSession({ kind: "exam", mode: examState.mode, title: titleMap[examState.mode], queue: queue, timeLimitSec: timeLimitSec });
  }

  function renderExamResult(sess) {
    var s = sess.summary;
    var pct = Math.round(s.accuracy * 100);

    var subjectCards = App.SUBJECT_ORDER.map(function (subject) {
      var b = s.bySubject[subject];
      if (!b) return "";
      var p = Math.round((b.correct / b.attempts) * 100);
      return '<div class="subject-score-card"><div class="subject-score-title">' + App.SUBJECT_INFO[subject].label + '</div>' +
        '<div class="subject-score-value">' + b.correct + ' / ' + b.attempts + '</div>' +
        '<div class="small-note">正答率 ' + p + '%</div></div>';
    }).join("");

    var catEntries = Object.keys(s.byCategory).map(function (k) { return s.byCategory[k]; });
    catEntries.sort(function (a, b) { return (a.correct / a.attempts) - (b.correct / b.attempts); });
    var catBars = catEntries.map(function (c) {
      var p = Math.round((c.correct / c.attempts) * 100);
      var cls = p >= 70 ? "" : (p >= 40 ? "warn" : "danger");
      return '<div class="bar-row"><div class="bar-row-label"><span>' + App.SUBJECT_INFO[c.subject].label + '・' + App.escapeHtml(c.category) + '</span><b>' + p + '%(' + c.correct + '/' + c.attempts + ')</b></div>' +
        '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + p + '%"></div></div></div>';
    }).join("");

    var recommended = catEntries.filter(function (c) { return (c.correct / c.attempts) < 0.6; }).slice(0, 3);
    var recommendHtml = recommended.length
      ? '<ul>' + recommended.map(function (c) { return '<li>' + App.SUBJECT_INFO[c.subject].label + '・' + App.escapeHtml(c.category) + '</li>'; }).join("") + '</ul>'
      : '<p class="small-note">目立った弱点は見つかりませんでした。よくできています。</p>';

    var wrongItems = sess.answers.filter(function (a) { return !a.correct; }).map(function (a) {
      var q = App.findQuestionById(a.id);
      if (!q) return "";
      return '<div class="mistake-item"><div class="mistake-q">[' + App.SUBJECT_INFO[q.subject].label + '・' + App.escapeHtml(q.category) + '] ' + App.escapeHtml(q.question) + '</div>' +
        '<div class="mistake-ans">正解: ' + App.escapeHtml(q.answer) + '</div>' +
        '<div class="mistake-exp">' + App.escapeHtml(q.explanation || "") + '</div></div>';
    }).join("");

    document.getElementById("result-body").innerHTML =
      '<div class="result-hero"><div class="result-score">' + s.correctCount + ' / ' + s.total + '</div>' +
      '<div class="result-sub">' + App.escapeHtml(sess.title) + '(総合正答率 ' + pct + '%・所要時間 ' + App.escapeHtml(App.formatDuration(s.durationSec)) + ')</div></div>' +
      '<h3 class="section-title">科目別得点</h3><div class="subject-score-grid">' + subjectCards + '</div>' +
      '<h3 class="section-title">分野別正答率</h3>' + catBars +
      '<h3 class="section-title">おすすめの復習分野</h3>' + recommendHtml +
      (wrongItems ? '<h3 class="section-title">間違えた問題</h3><div class="mistake-list">' + wrongItems + '</div>' : '') +
      '<div class="result-actions">' +
        '<button class="btn btn-primary" data-action="start-weak">弱点克服モードへ</button>' +
        '<button class="btn btn-secondary" data-action="nav-home">ホームに戻る</button>' +
      '</div>';
  }

  // ==================== 学習履歴 ====================
  function renderHistory() {
    var history = App.data.history.slice().reverse();
    var totalSessions = history.length;
    var totalQuestions = history.reduce(function (sum, h) { return sum + h.count; }, 0);
    var totalCorrect = history.reduce(function (sum, h) { return sum + h.correct; }, 0);
    var totalTime = history.reduce(function (sum, h) { return sum + h.durationSec; }, 0);
    var overallAcc = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    var summaryHtml =
      '<div class="stat-summary-grid">' +
      '<div class="stat-tile"><div class="stat-tile-value">' + totalSessions + '</div><div class="stat-tile-label">学習回数</div></div>' +
      '<div class="stat-tile"><div class="stat-tile-value">' + totalQuestions + '</div><div class="stat-tile-label">総問題数</div></div>' +
      '<div class="stat-tile"><div class="stat-tile-value">' + overallAcc + '%</div><div class="stat-tile-label">総合正答率</div></div>' +
      '<div class="stat-tile"><div class="stat-tile-value">' + App.escapeHtml(App.formatDuration(totalTime)) + '</div><div class="stat-tile-label">総学習時間</div></div>' +
      '</div>';

    var recent = history.slice(0, 12).reverse();
    var chartHtml = '<div class="chart-wrap"><p class="small-note" style="margin-top:0;">直近の学習の正答率(%)</p>' + buildBarChart(recent) + '</div>';
    if (recent.length === 0) chartHtml = '<div class="chart-wrap"><p class="small-note" style="margin:0;">まだ学習記録がありません。学習を始めると、ここに履歴が表示されます。</p></div>';

    var rows = history.slice(0, 100).map(function (h) {
      var subjLabel = Object.keys(h.bySubject || {}).map(function (s) { return App.SUBJECT_INFO[s] ? App.SUBJECT_INFO[s].label : s; }).join("・") || "-";
      return '<tr><td>' + App.escapeHtml(App.formatDate(h.date)) + '</td><td>' + App.escapeHtml(h.title || h.mode) + '</td><td>' + App.escapeHtml(subjLabel) + '</td>' +
        '<td>' + h.correct + ' / ' + h.count + '</td><td>' + Math.round(h.accuracy * 100) + '%</td><td>' + App.escapeHtml(App.formatDuration(h.durationSec)) + '</td></tr>';
    }).join("");

    var tableHtml = history.length
      ? '<div class="history-table-wrap"><table class="history-table"><thead><tr><th>日時</th><th>内容</th><th>科目</th><th>正解数</th><th>正答率</th><th>時間</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '';

    document.getElementById("history-body").innerHTML = summaryHtml + chartHtml + tableHtml +
      '<div class="result-actions" style="margin-top:24px;"><button class="btn btn-danger" data-action="reset-data">学習データをすべて初期化する</button></div>';
  }

  function buildBarChart(entries) {
    if (entries.length === 0) return "";
    var w = Math.max(320, entries.length * 46);
    var h = 140;
    var barW = 28;
    var gap = (w - entries.length * barW) / (entries.length + 1);
    var bars = entries.map(function (e, i) {
      var pct = Math.round(e.accuracy * 100);
      var barH = Math.max(2, pct / 100 * 100);
      var x = gap + i * (barW + gap);
      var y = 110 - barH;
      var color = pct >= 70 ? "#15803d" : (pct >= 40 ? "#b45309" : "#b91c1c");
      var d = new Date(e.date);
      var label = (d.getMonth() + 1) + "/" + d.getDate();
      return '<g>' +
        '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="3" fill="' + color + '"></rect>' +
        '<text x="' + (x + barW / 2) + '" y="' + (y - 6) + '" font-size="11" text-anchor="middle" fill="#333">' + pct + '%</text>' +
        '<text x="' + (x + barW / 2) + '" y="128" font-size="10" text-anchor="middle" fill="#667085">' + label + '</text>' +
        '</g>';
    }).join("");
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<line x1="0" y1="110" x2="' + w + '" y2="110" stroke="#dbe1ea"></line>' + bars + '</svg>';
  }

  function resetData() {
    if (!window.confirm("学習履歴・問題ごとの正誤記録・診断結果・追加した問題をすべて削除します。よろしいですか?この操作は取り消せません。")) return;
    if (!window.confirm("本当に初期化してよろしいですか?")) return;
    localStorage.removeItem(App.STORAGE_KEY);
    location.reload();
  }

  // ==================== 問題管理(追加・編集・削除・インポート/エクスポート) ====================
  var adminState = { editingId: null };

  function renderAdmin() {
    var body = document.getElementById("admin-body");
    body.innerHTML =
      '<div class="admin-grid">' +
        '<div class="admin-form-card">' +
          '<h3 id="admin-form-title">問題を追加する</h3>' +
          '<form id="admin-form">' +
            '<div class="field-group"><span class="field-label">科目</span>' +
              '<select class="select-input" id="f-subject">' +
                App.SUBJECT_ORDER.map(function (s) { return '<option value="' + s + '">' + App.SUBJECT_INFO[s].label + '</option>'; }).join("") +
              '</select></div>' +
            '<div class="field-group"><span class="field-label">分野(カテゴリ)</span>' +
              '<input class="text-input" id="f-category" list="admin-category-list" placeholder="例: 漢字の読み">' +
              '<datalist id="admin-category-list"></datalist></div>' +
            '<div class="field-group"><span class="field-label">レベル</span>' +
              '<select class="select-input" id="f-level">' +
                [1, 2, 3, 4, 5].map(function (lv) { return '<option value="' + lv + '">' + App.LEVEL_INFO[lv].label + '(' + App.LEVEL_INFO[lv].sub + ')</option>'; }).join("") +
              '</select></div>' +
            '<div class="field-group"><span class="field-label">出題形式</span>' +
              '<select class="select-input" id="f-type"><option value="choice">4択</option><option value="input">記述(自由入力)</option></select></div>' +
            '<div class="field-group"><span class="field-label">問題文</span><textarea class="textarea-input" id="f-question" rows="3"></textarea></div>' +
            '<div class="field-group" id="f-choices-group"><span class="field-label">選択肢(左のラジオボタンで正解を選択)</span>' +
              [0, 1, 2, 3].map(function (i) {
                return '<div class="choice-input-row"><input type="radio" name="f-correct" value="' + i + '"' + (i === 0 ? " checked" : "") + '>' +
                  '<input type="text" class="text-input choice-text" data-idx="' + i + '" placeholder="選択肢' + (i + 1) + '"></div>';
              }).join("") +
            '</div>' +
            '<div class="field-group hidden" id="f-input-answer-group"><span class="field-label">正解(記述式)</span>' +
              '<input class="text-input" id="f-answer-input" placeholder="例: ゆういつ">' +
              '<div class="small-note">別解がある場合はカンマ区切りで入力できます(例: 5100円,5,100円)</div>' +
              '<input class="text-input" id="f-answer-alts" placeholder="別解(任意・カンマ区切り)"></div>' +
            '<div class="field-group"><span class="field-label">解説</span><textarea class="textarea-input" id="f-explanation" rows="2"></textarea></div>' +
            '<div class="field-group"><span class="field-label">途中式・計算ステップ(任意・1行1ステップ、数学向け)</span><textarea class="textarea-input" id="f-steps" rows="3" placeholder="6000 × 0.15 = 900&#10;6000 - 900 = 5100"></textarea></div>' +
            '<div class="result-actions">' +
              '<button type="submit" class="btn btn-primary" id="f-submit-btn">追加する</button>' +
              '<button type="button" class="btn btn-secondary hidden" id="f-cancel-btn">編集をキャンセル</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div class="admin-list-card">' +
          '<h3>追加した問題(<span id="admin-count">0</span>件)</h3>' +
          '<div class="import-export-row">' +
            '<button class="btn btn-secondary" data-action="admin-export-custom">追加分をエクスポート</button>' +
            '<button class="btn btn-secondary" data-action="admin-export-all">全問題をエクスポート</button>' +
            '<button class="btn btn-secondary" data-action="admin-import-trigger">JSONをインポート</button>' +
            '<input type="file" id="admin-import-file" accept="application/json" class="hidden-file-input">' +
          '</div>' +
          '<div id="admin-list"></div>' +
          '<div class="result-actions" style="margin-top:16px;"><button class="btn btn-danger" data-action="reset-data">学習データをすべて初期化する</button></div>' +
        '</div>' +
      '</div>';

    var subjectSelect = document.getElementById("f-subject");
    var typeSelect = document.getElementById("f-type");
    subjectSelect.addEventListener("change", updateCategoryDatalist);
    typeSelect.addEventListener("change", toggleAnswerFields);
    updateCategoryDatalist();
    toggleAnswerFields();

    document.getElementById("admin-form").addEventListener("submit", onAdminFormSubmit);
    document.getElementById("f-cancel-btn").addEventListener("click", cancelEdit);
    document.getElementById("admin-import-file").addEventListener("change", onImportFileChosen);

    renderAdminList();
  }

  function updateCategoryDatalist() {
    var subject = document.getElementById("f-subject").value;
    var list = document.getElementById("admin-category-list");
    list.innerHTML = App.getCategories(subject).map(function (c) { return '<option value="' + App.escapeHtml(c) + '">'; }).join("");
  }

  function toggleAnswerFields() {
    var type = document.getElementById("f-type").value;
    document.getElementById("f-choices-group").classList.toggle("hidden", type !== "choice");
    document.getElementById("f-input-answer-group").classList.toggle("hidden", type !== "input");
  }

  function onAdminFormSubmit(e) {
    e.preventDefault();
    var subject = document.getElementById("f-subject").value;
    var category = document.getElementById("f-category").value.trim();
    var level = parseInt(document.getElementById("f-level").value, 10);
    var type = document.getElementById("f-type").value;
    var question = document.getElementById("f-question").value.trim();
    var explanation = document.getElementById("f-explanation").value.trim();
    var stepsRaw = document.getElementById("f-steps").value.trim();
    var steps = stepsRaw ? stepsRaw.split("\n").map(function (s) { return s.trim(); }).filter(Boolean) : undefined;

    if (!category || !question) { App.toast("分野と問題文は必須です"); return; }

    var q = { id: adminState.editingId || App.uid("custom"), subject: subject, category: category, level: level, type: type, question: question, explanation: explanation };
    if (steps) q.steps = steps;

    if (type === "choice") {
      var texts = Array.prototype.map.call(document.querySelectorAll(".choice-text"), function (inp) { return inp.value.trim(); });
      if (texts.some(function (t) { return !t; })) { App.toast("選択肢はすべて入力してください"); return; }
      var uniqueTexts = {}; texts.forEach(function (t) { uniqueTexts[t] = true; });
      if (Object.keys(uniqueTexts).length !== 4) { App.toast("選択肢が重複しています"); return; }
      var correctIdx = parseInt(document.querySelector('input[name="f-correct"]:checked').value, 10);
      q.choices = texts;
      q.answer = texts[correctIdx];
    } else {
      var answer = document.getElementById("f-answer-input").value.trim();
      if (!answer) { App.toast("正解を入力してください"); return; }
      var alts = document.getElementById("f-answer-alts").value.trim();
      q.answer = answer;
      if (alts) q.acceptableAnswers = alts.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    }

    if (adminState.editingId) {
      var idx = App.data.customQuestions.findIndex(function (x) { return x.id === adminState.editingId; });
      if (idx !== -1) App.data.customQuestions[idx] = q;
      App.toast("問題を更新しました");
    } else {
      App.data.customQuestions.push(q);
      App.toast("問題を追加しました");
    }
    App.save();
    cancelEdit();
    renderAdminList();
  }

  function cancelEdit() {
    adminState.editingId = null;
    document.getElementById("admin-form-title").textContent = "問題を追加する";
    document.getElementById("f-submit-btn").textContent = "追加する";
    document.getElementById("f-cancel-btn").classList.add("hidden");
    document.getElementById("admin-form").reset();
    toggleAnswerFields();
  }

  function startEdit(id) {
    var q = App.data.customQuestions.find(function (x) { return x.id === id; });
    if (!q) return;
    adminState.editingId = id;
    document.getElementById("admin-form-title").textContent = "問題を編集する";
    document.getElementById("f-submit-btn").textContent = "更新する";
    document.getElementById("f-cancel-btn").classList.remove("hidden");
    document.getElementById("f-subject").value = q.subject;
    updateCategoryDatalist();
    document.getElementById("f-category").value = q.category;
    document.getElementById("f-level").value = q.level;
    document.getElementById("f-type").value = q.type;
    toggleAnswerFields();
    document.getElementById("f-question").value = q.question;
    document.getElementById("f-explanation").value = q.explanation || "";
    document.getElementById("f-steps").value = (q.steps || []).join("\n");
    if (q.type === "choice") {
      var inputs = document.querySelectorAll(".choice-text");
      (q.choices || []).forEach(function (c, i) { if (inputs[i]) inputs[i].value = c; });
      var correctIdx = (q.choices || []).indexOf(q.answer);
      var radio = document.querySelector('input[name="f-correct"][value="' + Math.max(0, correctIdx) + '"]');
      if (radio) radio.checked = true;
    } else {
      document.getElementById("f-answer-input").value = q.answer;
      document.getElementById("f-answer-alts").value = (q.acceptableAnswers || []).join(", ");
    }
    document.getElementById("admin-form-title").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteCustomQuestion(id) {
    if (!window.confirm("この問題を削除しますか?")) return;
    App.data.customQuestions = App.data.customQuestions.filter(function (x) { return x.id !== id; });
    App.save();
    renderAdminList();
    App.toast("削除しました");
  }

  function renderAdminList() {
    var list = document.getElementById("admin-list");
    var items = App.data.customQuestions;
    document.getElementById("admin-count").textContent = items.length;
    if (items.length === 0) {
      list.innerHTML = '<p class="small-note">まだ追加した問題はありません。左のフォームから追加するか、JSONをインポートしてください。</p>';
      return;
    }
    list.innerHTML = items.slice().reverse().map(function (q) {
      return '<div class="custom-q-item"><div class="custom-q-top">' +
        '<div><span class="badge badge-outline">' + App.SUBJECT_INFO[q.subject].label + '</span> ' +
        '<span class="badge badge-outline">' + App.escapeHtml(q.category) + '</span> ' +
        '<span class="badge badge-outline">LEVEL' + q.level + '</span><br>' + App.escapeHtml(q.question) + '</div>' +
        '<div class="custom-q-actions">' +
          '<button class="btn btn-secondary" data-action="admin-edit" data-id="' + q.id + '">編集</button>' +
          '<button class="btn btn-danger" data-action="admin-delete" data-id="' + q.id + '">削除</button>' +
        '</div></div></div>';
    }).join("");
  }

  function downloadJson(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportCustom() {
    downloadJson("ntt_taisaku_custom_questions.json", App.data.customQuestions);
    App.toast("追加分の問題をエクスポートしました");
  }

  function exportAll() {
    var all = App.getAllPool();
    downloadJson("ntt_taisaku_all_questions.json", all);
    App.toast("全問題をエクスポートしました");
  }

  function onImportFileChosen(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var arr = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        if (!Array.isArray(arr)) throw new Error("形式が不正です");
        var existingIds = {};
        App.getAllPool().forEach(function (q) { existingIds[q.id] = true; });
        var added = 0, skipped = 0;
        arr.forEach(function (q) {
          if (!q || !q.subject || !q.category || !q.question || (q.answer === undefined)) { skipped++; return; }
          if (!q.id || existingIds[q.id]) q.id = App.uid("custom");
          if (!q.level) q.level = 3;
          if (!q.type) q.type = q.choices ? "choice" : "input";
          existingIds[q.id] = true;
          App.data.customQuestions.push(q);
          added++;
        });
        App.save();
        renderAdminList();
        App.toast(added + "件を追加しました" + (skipped ? "(" + skipped + "件は形式不正のためスキップ)" : ""));
      } catch (err) {
        App.toast("JSONの読み込みに失敗しました: " + err.message);
      }
      e.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  }

  // ==================== data-action ハンドラ登録 ====================
  App.handleAction = function (action, el) {
    switch (action) {
      case "picker-subject": pickerState.subject = el.getAttribute("data-value"); pickerState.category = null; renderCategoryPicker(); break;
      case "picker-category": pickerState.category = el.getAttribute("data-value"); renderCategoryPicker(); break;
      case "picker-level": pickerState.level = el.getAttribute("data-value"); renderCategoryPicker(); break;
      case "picker-start": startCategoryStudy(); break;

      case "exam-mode": examState.mode = el.getAttribute("data-value"); renderExamSetup(); break;
      case "exam-subject": examState.subject = el.getAttribute("data-value"); renderExamSetup(); break;
      case "exam-start": startExam(); break;

      case "admin-edit": startEdit(el.getAttribute("data-id")); break;
      case "admin-delete": deleteCustomQuestion(el.getAttribute("data-id")); break;
      case "admin-export-custom": exportCustom(); break;
      case "admin-export-all": exportAll(); break;
      case "admin-import-trigger": document.getElementById("admin-import-file").click(); break;

      case "reset-data": resetData(); break;
      default: break;
    }
  };

  App.startDiagnostic = startDiagnostic;
  App.renderDiagnosticResult = renderDiagnosticResult;
  App.renderCategoryPicker = renderCategoryPicker;
  App.renderExamSetup = renderExamSetup;
  App.renderExamResult = renderExamResult;
  App.renderHistory = renderHistory;
  App.renderAdmin = renderAdmin;
})();
