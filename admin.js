/* 爱的错位 · 管理后台（Supabase Auth 版） */
(function () {
  function $(id) { return document.getElementById(id); }
  function show(id) {
    var ss = document.querySelectorAll(".screen");
    for (var i = 0; i < ss.length; i++) ss[i].classList.remove("on");
    $(id).classList.add("on");
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  function loadPasswords() {
    API.listPasswords().then(function (list) {
      var html = "";
      list.forEach(function (p) {
        var state = p.disabled
          ? '<span class="tag off">已停用</span>'
          : (p.remaining > 0 ? '<span class="tag ok">可用</span>' : '<span class="tag warn">已用完</span>');
        html += "<tr><td><b>" + p.code + "</b></td><td>" + p.uses + "</td><td>" + p.used +
          "</td><td>" + p.remaining + "</td><td>" + state + "</td><td>" + (p.note || "-") +
          '</td><td>' + new Date(p.createdAt).toLocaleString("zh-CN", { hour12: false }) + "</td><td>" +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + p.code + '" style="margin-top:0">' +
          (p.disabled ? "启用" : "停用") + "</button></td></tr>";
      });
      $("pwd-tbody").innerHTML = html || '<tr><td colspan="8" style="text-align:center;color:var(--ink3)">暂无密码，请生成</td></tr>';
      $("pwd-tbody").querySelectorAll("[data-toggle]").forEach(function (btn) {
        btn.onclick = function () {
          var code = btn.getAttribute("data-toggle");
          var willDisable = btn.textContent === "停用";
          API.togglePassword(code, willDisable).then(loadPasswords).catch(function (e) {
            toast((e && e.message) || "操作失败");
          });
        };
      });
    }).catch(function (e) { toast((e && e.message) || "加载失败，请重新登录"); });
  }

  function loadStats() {
    API.stats().then(function (s) {
      $("st-pwd").textContent = s.totalPasswords;
      $("st-use").textContent = s.totalUses;
      $("st-res").textContent = s.totalResults;
    }).catch(function () {});
  }

  function enterMain() {
    show("s-main");
    loadPasswords();
    loadStats();
  }

  function init() {
    API.init();
    if (!API.isConfigured()) {
      $("login-msg").textContent = "网站尚未配置 Supabase，请先编辑 supabase-config.js";
      return;
    }
    // 已有登录会话则直接进入
    API.adminSession().then(function (session) {
      if (session) enterMain();
    });

    $("btn-login").onclick = function () {
      var email = $("admin-email").value.trim();
      var pwd = $("admin-pwd").value;
      if (!email || !pwd) { $("login-msg").textContent = "请输入邮箱和密码"; return; }
      var btn = this;
      btn.disabled = true; btn.textContent = "登录中…";
      API.adminLogin(email, pwd).then(function () {
        btn.disabled = false; btn.textContent = "进入后台";
        $("login-msg").textContent = "";
        enterMain();
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "进入后台";
        $("login-msg").textContent = (e && e.message) || "登录失败，请检查邮箱密码";
      });
    };
    $("admin-pwd").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("btn-login").click();
    });
    $("btn-logout").onclick = function () {
      API.adminLogout().then(function () { show("s-login"); });
    };

    $("btn-generate").onclick = function () {
      var btn = this;
      btn.disabled = true; btn.textContent = "生成中…";
      API.generatePasswords(
        parseInt($("gen-count").value, 10) || 10,
        parseInt($("gen-uses").value, 10) || 3,
        $("gen-prefix").value,
        $("gen-note").value
      ).then(function (codes) {
        btn.disabled = false; btn.textContent = "生成密码";
        toast("已生成 " + codes.length + " 个密码");
        copyText(codes.join("\n"), "全部密码已复制，去粘贴给买家吧");
        loadPasswords();
        loadStats();
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "生成密码";
        toast((e && e.message) || "生成失败");
      });
    };
    $("btn-copy-all").onclick = function () {
      var codes = [];
      $("pwd-tbody").querySelectorAll("td b").forEach(function (b) { codes.push(b.textContent); });
      if (!codes.length) { toast("暂无密码"); return; }
      copyText(codes.join("\n"), "已复制 " + codes.length + " 个密码");
    };
  }

  function copyText(text, okMsg) {
    function ok() { toast(okMsg || "已复制"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(text, ok); });
    } else fallback(text, ok);
  }
  function fallback(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) { toast("复制失败"); }
    document.body.removeChild(ta);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
