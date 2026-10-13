/* 爱的错位 · 主逻辑（index 页，Supabase 版） */
var App = (function () {
  var state = {
    password: null, token: null, remaining: 0, total: 3,
    mode: "both", order: [], idx: 0, answers: {}, lock: false,
    resultCode: null, resultData: null,
  };
  var RECENT_KEY = "lt_recent_results";

  function $(id) { return document.getElementById(id); }
  function show(id) {
    var ss = document.querySelectorAll(".screen");
    for (var i = 0; i < ss.length; i++) ss[i].classList.remove("on");
    $(id).classList.add("on");
    window.scrollTo(0, 0);
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function openModal(id) { $(id).classList.add("on"); }
  function closeModal(id) { $(id).classList.remove("on"); }

  /* 结果链接（兼容 GitHub Pages 子路径） */
  function resultLink(code) {
    var base = location.origin + location.pathname.replace(/[^/]*$/, "");
    return base + "r.html?code=" + code;
  }

  function guard(fn) {
    return function () {
      if (!API.isConfigured()) { toast("网站尚未配置 Supabase，暂无法使用"); return; }
      fn.apply(this, arguments);
    };
  }

  /* ---------- 密码门 ---------- */
  function verifyPassword() {
    var code = $("pwd").value.trim();
    if (!code) { gateMsg("请输入测评密码", "err"); return; }
    var btn = $("btn-verify");
    btn.disabled = true; btn.textContent = "验证中…";
    API.verify(code).then(function (res) {
      btn.disabled = false; btn.textContent = "验证密码";
      if (!res.ok) { gateMsg(res.error || "验证失败", "err"); return; }
      state.password = res.code;
      state.token = res.token;
      state.remaining = res.remaining;
      state.total = res.total;
      enterModeSelect();
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = "验证密码";
      gateMsg(errText(e, "网络异常，请稍后重试"), "err");
    });
  }
  function errText(e, fallback) {
    return (e && e.message) ? e.message : fallback;
  }
  function gateMsg(text, cls) {
    var m = $("gate-msg");
    m.textContent = text;
    m.className = "gate-msg " + (cls || "");
  }
  function enterModeSelect() {
    $("gate-input").style.display = "none";
    $("gate-mode").style.display = "block";
    refreshRemain();
  }
  function refreshRemain() {
    $("remain-pill").textContent = "本密码还可测 " + state.remaining + " 次（共 " + state.total + " 次）";
  }
  function backToGate(msg) {
    state.token = null; state.password = null; state.finished = false;
    $("gate-mode").style.display = "none";
    $("gate-input").style.display = "block";
    $("pwd").value = "";
    gateMsg(msg || "", msg ? "err" : "");
  }

  /* ---------- 模式选择 ---------- */
  function bindModeCards() {
    var cards = document.querySelectorAll(".mode-card");
    for (var i = 0; i < cards.length; i++) {
      cards[i].onclick = function () {
        var all = document.querySelectorAll(".mode-card");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("sel");
        this.classList.add("sel");
        state.mode = this.getAttribute("data-mode");
      };
    }
  }

  /* ---------- 答题 ---------- */
  function startQuiz() {
    if (state.remaining <= 0) {
      backToGate("该密码的测评次数已用完，请更换密码");
      return;
    }
    state.idx = 0;
    state.answers = {};
    state.finished = false;
    state.order = [];
    if (state.mode === "both" || state.mode === "parent") for (var i = 1; i <= 12; i++) state.order.push("P" + i);
    if (state.mode === "both" || state.mode === "child") for (var j = 1; j <= 12; j++) state.order.push("C" + j);
    show("s-quiz");
    renderQ();
  }
  function curQ() {
    var key = state.order[state.idx];
    if (key.charAt(0) === "P") return { q: PARENT_Q[parseInt(key.slice(1), 10) - 1], vol: "家长卷" };
    return { q: CHILD_Q[parseInt(key.slice(1), 10) - 1], vol: "孩子卷" };
  }
  function renderQ() {
    var c = curQ();
    var total = state.order.length;
    $("pvol").textContent = c.vol + (state.mode === "both" ? " · 共24题" : "");
    $("pnum").textContent = "第 " + (state.idx + 1) + " / " + total + " 题";
    $("pfill").style.width = (state.idx / total * 100) + "%";
    $("qscene").innerHTML = '<span class="q-tag">' + c.vol + " · 第" + (state.idx + 1) +
      '题</span><br>' + c.q.scene;
    var box = $("qopts");
    box.innerHTML = "";
    var keys = ["A", "B", "C", "D"];
    for (var i = 0; i < 4; i++) {
      (function (i) {
        var b = document.createElement("button");
        b.className = "opt";
        b.innerHTML = '<span class="opt-key">' + keys[i] + '</span><span class="opt-text">' + c.q.opts[i].t + "</span>";
        b.onclick = function () {
          if (state.lock) return;
          state.lock = true;
          b.classList.add("picked");
          state.answers[state.order[state.idx]] = i;
          setTimeout(function () {
            state.lock = false;
            var curKey = state.order[state.idx];
            if (state.idx === state.order.length - 1) { finish(); return; }
            var nextKey = state.order[state.idx + 1];
            if (curKey.charAt(0) === "P" && nextKey.charAt(0) === "C") show("s-mid");
            else { state.idx++; renderQ(); }
          }, 240);
        };
        box.appendChild(b);
      })(i);
    }
    $("qback").style.visibility = state.idx > 0 ? "visible" : "hidden";
  }
  function resumeChild() { state.idx++; renderQ(); show("s-quiz"); }
  function goBack() { if (state.idx > 0) { state.idx--; renderQ(); } }

  /* ---------- 完成 → 保存 → 渲染 ---------- */
  function finish() {
    if (state.finished) return;   // 防止重复提交
    state.finished = true;
    show("s-loading");
    var steps = ["正在比对 24 个作答维度……", "正在检索 32 种亲子错位模式……",
      "正在调用依恋理论与家庭系统模型……", "正在生成你的家庭关系画像……"];
    var k = 0;
    var el = $("loadstep");
    el.textContent = steps[0];
    var timer = setInterval(function () {
      k++;
      if (k < steps.length) el.textContent = steps[k];
      else {
        clearInterval(timer);
        var data = LT.buildResult(state.mode, state.answers);
        API.saveResult(state.token, data).then(function (res) {
          if (!res.ok) {
            toast(res.error || "保存失败");
            backToGate(res.error);
            return;
          }
          state.resultCode = res.code;
          state.resultData = data;
          state.remaining = Math.max(0, state.remaining - 1);
          saveRecent(res.code, data);
          renderResult();
        }).catch(function (e) {
          toast(errText(e, "网络异常，结果未保存"));
          backToGate();
        });
      }
    }, 420);
  }

  function renderResult() {
    $("capture").innerHTML = LT.renderFull(state.resultData, { resultCode: state.resultCode });
    $("result-code").textContent = state.resultCode;
    show("s-result");
    setTimeout(function () {
      var fills = document.querySelectorAll("#capture .bar-fill");
      for (var i = 0; i < fills.length; i++) fills[i].style.width = fills[i].getAttribute("data-w") + "%";
    }, 150);
  }

  /* ---------- 本机最近记录（对比用） ---------- */
  function saveRecent(code, data) {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      list.unshift({
        code: code, at: Date.now(), mode: data.mode,
        parentType: data.parent ? data.parent.type : null,
        childType: data.child ? data.child.type : null,
      });
      list = list.slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /* ---------- 长图 ---------- */
  function saveImage() {
    var btn = $("btn-save-img");
    btn.disabled = true; btn.textContent = "生成中…";
    LT.saveLongImage($("capture"), function (canvas, err) {
      btn.disabled = false; btn.textContent = "📷 保存长图";
      if (err) { toast(err); return; }
      var url = canvas.toDataURL("image/png");
      $("img-out").src = url;
      $("img-hint").innerHTML = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? "手机：长按图片即可保存到相册 ✅"
        : "电脑：右键图片「另存为」，或点下方按钮下载";
      openModal("img-modal");
      $("btn-download-img").onclick = function () {
        var a = document.createElement("a");
        a.href = url;
        a.download = "爱的错位-" + (state.resultCode || "result") + ".png";
        document.body.appendChild(a); a.click(); a.remove();
      };
    });
  }

  /* ---------- 复制 ---------- */
  function copyText(text, okMsg) {
    function ok() { toast(okMsg || "已复制"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text, ok); });
    } else fallbackCopy(text, ok);
  }
  function fallbackCopy(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) { toast("复制失败，请手动长按选中"); }
    document.body.removeChild(ta);
  }

  /* ---------- 再测一次 ---------- */
  function retest() {
    if (!state.password) { backToGate(); return; }
    API.verify(state.password).then(function (res) {
      if (!res.ok) {
        toast(res.error || "次数已用完");
        backToGate(res.error || "该密码次数已用完，请更换密码");
        return;
      }
      state.token = res.token;
      state.remaining = res.remaining;
      state.total = res.total;
      toast("已消耗 1 次，剩余 " + res.remaining + " 次");
      enterModeSelect();
    }).catch(function (e) { toast(errText(e, "网络异常，请稍后重试")); });
  }

  /* ---------- 好评有礼 ---------- */
  function openReview() {
    var shop = (typeof SHOP_CONFIG !== "undefined") ? SHOP_CONFIG : {};
    $("review-body").innerHTML =
      "亲，感谢参与《爱的错位》测评！💐<br><br>" +
      "如果这次测评让你对家里的相处方式有了一点新想法，欢迎前往店铺 <span class=\"hl\">" + (shop.name || "我们的店铺") +
      "</span> 给个好评~<br><br>" +
      "好评之后，联系客服发送<span class=\"hl\">好评截图</span>，即可获得 <span class=\"hl\">" + (shop.reward || "1元") +
      "返现</span>！🧧<br><br>" +
      "<span style=\"font-size:12.5px;color:var(--ink3)\">（每位用户每次测评后可参与一次）</span>";
    $("review-service").textContent = shop.service || "客服微信：kefu888";
    openModal("review-modal");
  }

  /* ---------- 初始化 ---------- */
  function init() {
    API.init();
    if (!API.isConfigured()) $("cfg-warn").style.display = "block";
    bindModeCards();
    $("btn-verify").onclick = guard(verifyPassword);
    $("pwd").addEventListener("keydown", function (e) { if (e.key === "Enter") verifyPassword(); });
    $("btn-switch").onclick = function () { backToGate(); };
    $("btn-start").onclick = startQuiz;
    $("btn-save-img").onclick = saveImage;
    $("btn-copy-link").onclick = function () {
      copyText(resultLink(state.resultCode), "链接已复制，去粘贴给家人吧 🔗");
    };
    $("btn-compare").onclick = function () {
      location.href = "compare.html?a=" + state.resultCode;
    };
    $("btn-retest").onclick = retest;
    $("btn-review").onclick = openReview;
    $("btn-copy-service").onclick = function () {
      copyText($("review-service").textContent, "客服联系方式已复制");
    };
    document.querySelectorAll(".modal-mask").forEach(function (m) {
      m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("on"); });
    });
  }
  document.addEventListener("DOMContentLoaded", init);

  return {
    resumeChild: resumeChild,
    goBack: goBack,
    closeModal: closeModal,
    openModal: openModal,
    toast: toast,
  };
})();
