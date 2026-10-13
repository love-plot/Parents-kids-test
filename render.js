/* 爱的错位 · 共享渲染模块（index / r / compare 三页复用） */
var LT = (function () {
  /* ---- 计分 ---- */
  function computeScores(side, answers) {
    var qs = side === "P" ? PARENT_Q : CHILD_Q;
    var map = side === "P" ? PARENT_TYPES : CHILD_TYPES;
    var scores = {};
    for (var t in map) scores[t] = 0;
    for (var i = 0; i < qs.length; i++) {
      var pick = answers[side + (i + 1)];
      if (pick === undefined || pick === null) continue;
      var sc = qs[i].opts[pick].s;
      for (var k in sc) scores[k] += sc[k];
    }
    return scores;
  }
  function rank(scores) {
    var arr = [];
    for (var t in scores) arr.push({ k: t, v: scores[t] });
    arr.sort(function (a, b) { return b.v - a.v; });
    return arr;
  }
  /* 由作答生成完整结果数据（与 server 存储结构一致） */
  function buildResult(mode, answers) {
    var data = { mode: mode, parent: null, child: null, combo: null };
    if (mode === "both" || mode === "parent") {
      var r = rank(computeScores("P", answers));
      data.parent = { type: r[0].k, scores: computeScores("P", answers), shadow: r[1].k };
    }
    if (mode === "both" || mode === "child") {
      var r2 = rank(computeScores("C", answers));
      data.child = { type: r2[0].k, scores: computeScores("C", answers), shadow: r2[1].k };
    }
    if (data.parent && data.child) {
      var c = COMBOS[data.parent.type + "-" + data.child.type];
      data.combo = { key: data.parent.type + "-" + data.child.type, name: c.name, text: c.text, hot: c.hot || "" };
    }
    return data;
  }

  /* ---- 条形图 ---- */
  function bars(ranked, map) {
    var sum = 0, i;
    for (i = 0; i < ranked.length; i++) sum += ranked[i].v;
    var html = "";
    for (i = 0; i < ranked.length; i++) {
      var pct = sum > 0 ? Math.round(ranked[i].v / sum * 100) : 0;
      html += '<div class="bar-row"><span class="bar-name">' + map[ranked[i].k].name + '</span>' +
        '<div class="bar-track"><div class="bar-fill" data-w="' + pct + '"></div></div>' +
        '<span class="bar-val">' + pct + '%</span></div>';
    }
    return html;
  }

  /* ---- 类型卡 ---- */
  function typeCard(type, isParent) {
    return '<div class="type-top"><span class="type-emoji">' + type.emoji + '</span>' +
      '<div><div class="type-name serif">' + type.name + '</div>' +
      '<div class="type-tag">「' + type.tag + '」</div></div></div>' +
      '<p class="type-desc">' + type.desc + '</p>' +
      '<div class="sci-box"><span class="h">🔬 背后的科学原理</span>' + type.sci + '</div>' +
      '<div class="advice">💬 ' + type.advice + '</div>';
  }

  /* ---- 完整结果页（长图捕获区 + 页面共用） ---- */
  function renderFull(data, opts) {
    opts = opts || {};
    var html = "";
    html += '<div class="r-head"><div class="t serif">' +
      (data.mode === "both" ? "你的双重画像" : (data.mode === "parent" ? "你的家长画像" : "你的孩子画像")) +
      '</div><div class="s">' + (opts.resultCode ? "结果码 " + opts.resultCode : "爱的错位 · 亲子关系画像测试") + '</div></div>';

    if (data.parent) {
      var p = PARENT_TYPES[data.parent.type];
      html += '<div class="sec-label serif">家长卷 · 你给出的爱</div>' +
        '<div class="type-card">' + typeCard(p, true) + '</div>' +
        '<div class="shadow-note">影子类型：' + PARENT_TYPES[data.parent.shadow].name +
        '（' + PARENT_TYPES[data.parent.shadow].tag + '）\n' + PARENT_RISK[data.parent.type] + '</div>';
    }
    if (data.child) {
      var c = CHILD_TYPES[data.child.type];
      html += '<div class="sec-label serif">孩子卷 · 你接收的爱</div>' +
        '<div class="type-card">' + typeCard(c, false) + '</div>' +
        '<div class="shadow-note">影子类型：' + CHILD_TYPES[data.child.shadow].name +
        '（' + CHILD_TYPES[data.child.shadow].tag + '）\n' + CHILD_RISK[data.child.type] + '</div>';
    }
    if (data.combo) {
      html += '<div class="sec-label serif">错位组合报告</div>' +
        '<div class="combo-card"><div class="combo-kicker">你的家庭关系主剧本</div>' +
        '<div class="combo-name serif">「' + data.combo.name + '」</div>' +
        '<div class="combo-text">' + PARENT_TYPES[data.parent.type].name + ' × ' +
        CHILD_TYPES[data.child.type].name + '<br><br>' + data.combo.text + '</div>' +
        (data.combo.hot ? '<div class="combo-hot"><span>🔥 ' + data.combo.hot + '</span></div>' : '') +
        '</div>';
    }

    html += '<div class="sec-label serif">你的作答分布</div>' +
      '<div class="type-card" style="padding:18px 16px">' +
      '<div style="font-size:12.5px;color:var(--ink3);margin-bottom:12px;text-align:center">占比越高，说明该模式在你身上越突出</div>' +
      (data.parent ? bars(rank(data.parent.scores), PARENT_TYPES) : "") +
      (data.parent && data.child ? '<div style="height:14px"></div>' : "") +
      (data.child ? bars(rank(data.child.scores), CHILD_TYPES) : "") +
      '</div>';

    html += '<div class="sec-label serif">这份测试的理论依据</div>' +
      '<div class="theory-item"><b>依恋理论（Bowlby &amp; Ainsworth）</b> —— 你习惯亲近还是习惯逃离，早在生命最初几年写好了初稿。孩子卷的四种结果，对应成人依恋的四种工作模型。</div>' +
      '<div class="theory-item"><b>爱的五种语言（Gary Chapman）</b> —— 爱的错位，本质常是「语种不同」：你讲服务的行动，孩子想听肯定的言词，频道就永远对不上。</div>' +
      '<div class="theory-item"><b>心理控制研究（Barber 等）</b> —— 「为你好」和「管得多」之间，隔着一条实证证据明确的线：引发内疚、撤回关爱、干涉思想，与低自尊和亲子疏离显著相关。</div>' +
      '<div class="theory-item"><b>家庭系统理论（Bowen）</b> —— 家庭情绪会流动、会代际传递。你此刻的管教方式里，住着你小时候最熟悉的那个姿态。</div>';

    html += '<div class="watermark">— 爱的错位 · 亲子关系画像测试 —</div>';
    return html;
  }

  /* ---- 分享文案 ---- */
  function shareText(data, link) {
    if (data.combo) {
      return "我测出了「" + data.combo.name + "」：" + PARENT_TYPES[data.parent.type].name +
        " × " + CHILD_TYPES[data.child.type].name + "。你拼命给的，是不是TA拼命想逃的？\n我的结果：" + link +
        "\n——24道题，敢不敢测测你家？";
    }
    if (data.parent) {
      return "我测出来是「" + PARENT_TYPES[data.parent.type].name + "」：" + PARENT_TYPES[data.parent.type].tag +
        "。\n我的结果：" + link + "\n——敢不敢测测你家？";
    }
    return "我测出来是「" + CHILD_TYPES[data.child.type].name + "」：" + CHILD_TYPES[data.child.type].tag +
      "。\n我的结果：" + link + "\n——敢不敢测测你家？";
  }

  /* ---- 对比页迷你卡 ---- */
  function miniCard(data, label) {
    var html = '<h3 class="serif">' + label + '</h3>';
    if (data.parent) {
      var p = PARENT_TYPES[data.parent.type];
      html += '<div class="cmp-line">家长模式：<b>' + p.emoji + " " + p.name + '</b></div>' +
        '<div class="cmp-line" style="color:var(--ink3);font-size:12.5px">「' + p.tag + '」</div>';
    }
    if (data.child) {
      var c = CHILD_TYPES[data.child.type];
      html += '<div class="cmp-line">孩子模式：<b>' + c.emoji + " " + c.name + '</b></div>' +
        '<div class="cmp-line" style="color:var(--ink3);font-size:12.5px">「' + c.tag + '」</div>';
    }
    if (data.combo) {
      html += '<div class="cmp-line" style="margin-top:10px">组合剧本：<b>' + data.combo.name + '</b></div>' +
        '<div class="cmp-line" style="font-size:13px">' + data.combo.text + '</div>';
    }
    return html;
  }

  /* ---- 长图生成 ---- */
  function saveLongImage(captureEl, done) {
    if (typeof html2canvas === "undefined") {
      done(null, "图片组件加载失败，请刷新重试");
      return;
    }
    var w = captureEl.offsetWidth || 360;
    var scale = Math.min(2, Math.floor(3600 / w) || 1);
    html2canvas(captureEl, {
      scale: Math.max(scale, 1),
      useCORS: true,
      backgroundColor: "#f6f1e6",
      logging: false,
    }).then(function (canvas) {
      done(canvas, null);
    }).catch(function (e) {
      done(null, "图片生成失败：" + (e && e.message ? e.message : "未知错误"));
    });
  }

  return {
    computeScores: computeScores,
    rank: rank,
    buildResult: buildResult,
    renderFull: renderFull,
    shareText: shareText,
    miniCard: miniCard,
    bars: bars,
    saveLongImage: saveLongImage,
  };
})();
