/* 爱的错位 · Supabase 访问层（所有页面共用） */
var API = (function () {
  var client = null;

  function init() {
    if (!isConfigured()) return null;
    if (!client && typeof supabase !== "undefined" && supabase.createClient) {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    return client;
  }

  function get() {
    if (!client) client = init();
    return client;
  }

  function isConfigured() {
    return typeof SUPABASE_URL !== "undefined" &&
      SUPABASE_URL.indexOf("你的项目ID") < 0 &&
      SUPABASE_URL.indexOf("supabase.co") >= 0 &&
      typeof SUPABASE_ANON_KEY !== "undefined" &&
      SUPABASE_ANON_KEY.indexOf("你的anon") < 0 &&
      SUPABASE_ANON_KEY.length > 10;
  }

  /* ---------- 用户侧 ---------- */
  // 验证密码并消耗一次；成功返回 {ok, token, remaining, total}
  function verify(code) {
    return get().rpc("verify_password", { p_code: String(code || "").trim() }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  // 保存结果，返回 {ok, code}
  function saveResult(token, payload) {
    return get().rpc("save_result", {
      p_token: token,
      p_mode: payload.mode,
      p_parent: payload.parent || null,
      p_child: payload.child || null,
      p_combo: payload.combo || null,
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  // 按结果码读取
  function getResult(code) {
    return get().rpc("get_result", { p_code: String(code || "").trim() }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  /* ---------- 管理后台 ---------- */
  function adminLogin(email, password) {
    return get().auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }
  function adminLogout() {
    return get().auth.signOut();
  }
  function adminSession() {
    return get().auth.getSession().then(function (res) { return res.data.session; });
  }
  function listPasswords() {
    return get().from("passwords").select("code,uses,used,disabled,note,created_at")
      .order("created_at", { ascending: false }).then(function (res) {
        if (res.error) throw res.error;
        return res.data.map(function (p) {
          return {
            code: p.code, uses: p.uses, used: p.used,
            remaining: Math.max(0, p.uses - p.used),
            disabled: p.disabled, note: p.note || "",
            createdAt: new Date(p.createdAt).getTime()
          };
        });
      });
  }
  function generatePasswords(count, uses, prefix, note) {
    var rows = [];
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function rand(n) {
      var s = "";
      for (var i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
      return s;
    }
    for (var i = 0; i < count; i++) {
      rows.push({
        code: (prefix || "").toUpperCase() + rand(6),
        uses: uses, used: 0, disabled: false, note: note || ""
      });
    }
    return get().from("passwords").insert(rows).then(function (res) {
      if (res.error) throw res.error;
      return rows.map(function (r) { return r.code; });
    });
  }
  function togglePassword(code, disabled) {
    return get().from("passwords").update({ disabled: disabled }).eq("code", code).then(function (res) {
      if (res.error) throw res.error;
      return true;
    });
  }
  function stats() {
    return get().from("results").select("code,mode,created_at", { count: "exact" })
      .order("created_at", { ascending: false }).limit(10).then(function (res) {
        if (res.error) throw res.error;
        return get().from("passwords").select("used").then(function (p) {
          var totalUses = (p.data || []).reduce(function (s, x) { return s + (x.used || 0); }, 0);
          return {
            totalPasswords: (p.data || []).length,
            totalUses: totalUses,
            totalResults: res.count || 0,
            recent: (res.data || []).map(function (r) {
              return { code: r.code, mode: r.mode, at: new Date(r.createdAt).getTime() };
            })
          };
        });
      });
  }

  return {
    init: init, get: get, isConfigured: isConfigured,
    verify: verify, saveResult: saveResult, getResult: getResult,
    adminLogin: adminLogin, adminLogout: adminLogout, adminSession: adminSession,
    listPasswords: listPasswords, generatePasswords: generatePasswords,
    togglePassword: togglePassword, stats: stats,
  };
})();
