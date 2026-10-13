/* 爱的错位 · 对比页（Supabase 版） */
(function () {
  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  var RECENT_KEY = "lt_recent_results";

  function fetchResult(code) {
    return API.getResult(code).then(function (res) {
      if (!res || !res.ok) return { ok: false };
      return res;
    }).catch(function () { return { ok: false }; });
  }

  /* 本机最近记录 */
  function renderRecent() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) {}
    if (!list.length) {
      $("recent-a").innerHTML = '<span style="font-size:12px;color:var(--ink3)">本机暂无记录（在结果页点「对比结果」可带入）</span>';
      return;
    }
    function chips(box, input) {
      var html = '<span style="font-size:12px;color:var(--ink3);width:100%">本机最近：</span>';
      for (var i = 0; i < list.length; i++) {
        (function (r) {
          var label = r.code + "（" + (r.parentType ? PARENT_TYPES[r.parentType].name : "") +
            (r.childType ? "×" + CHILD_TYPES[r.childType].name : "") + "）";
          html += '<span class="recent-chip" data-code="' + r.code + '">' + label + "</span>";
        })(list[i]);
      }
      box.innerHTML = html;
      box.querySelectorAll(".recent-chip").forEach(function (chip) {
        chip.onclick = function () {
          $(input).value = chip.getAttribute("data-code");
        };
      });
    }
    chips($("recent-a"), "code-a");
    chips($("recent-b"), "code-b");
  }

  function compare() {
    var a = $("code-a").value.trim().toUpperCase();
    var b = $("code-b").value.trim().toUpperCase();
    var msg = $("cmp-msg");
    msg.textContent = "";
    if (!a || !b) { msg.textContent = "请输入两个结果码"; return; }
    if (a === b) { msg.textContent = "两个结果码相同，请输入不同人的结果码"; return; }
    var btn = $("btn-compare");
    btn.disabled = true; btn.textContent = "查询中…";
    Promise.all([fetchResult(a), fetchResult(b)]).then(function (rs) {
      btn.disabled = false; btn.textContent = "开始对比";
      if (!rs[0].ok || !rs[1].ok) {
        msg.textContent = "有结果码不存在，请检查后重试";
        return;
      }
      var da = rs[0].result, db = rs[1].result;
      var out = "";
      out += '<div class="sec-label serif">对比结果</div><div class="cmp-cols">';
      out += '<div class="cmp-col">' + LT.miniCard(da, "结果码 " + a) + "</div>";
      out += '<div class="cmp-col">' + LT.miniCard(db, "结果码 " + b) + "</div>";
      out += "</div>";

      /* 综合结论 */
      var conclusion = "";
      if (da.combo && db.combo) {
        conclusion = "你们各自的关系剧本分别是「" + da.combo.name + "」和「" + db.combo.name +
          "」。同一屋檐下，两个人体验到的可能完全是两个家庭——这不是谁对谁错，而是两套爱的语法在各自的经历里形成。把这两页结果放在一起看，或许就是你们第一次真正「看见」对方的位置。";
      } else if (da.combo) {
        conclusion = "A 是完整的双卷结果（「" + da.combo.name + "」），B 只测了单卷。建议 B 也完成双卷，才能生成属于 TA 的关系剧本，对比才完整。";
      } else if (db.combo) {
        conclusion = "B 是完整的双卷结果（「" + db.combo.name + "」），A 只测了单卷。建议 A 也完成双卷，才能生成属于 TA 的关系剧本，对比才完整。";
      } else {
        conclusion = "两个人都只测了单卷。建议都完成「双卷」，才能生成错位组合报告，对比会更有意思。";
      }
      out += '<div class="cmp-summary"><div class="k">写 给 你 们</div><div class="v serif">同一屋檐，两个家庭</div><div class="t">' + conclusion + "</div></div>";

      var linkA = location.origin + location.pathname.replace(/[^/]*$/, "") + "r.html?code=" + a;
      out += '<div class="action-grid" style="margin-top:16px">' +
        '<button class="btn btn-ghost" id="btn-save-cmp">📷 保存对比长图</button>' +
        '<button class="btn btn-gold" id="btn-copy-a">🔗 复制 A 链接</button>' +
        "</div>" +
        '<div class="foot">提示：把结果码或链接发给家人，让 TA 也测一次，再来对比。</div>';

      $("cmp-out").innerHTML = out;
      window.scrollTo(0, 0);

      $("btn-copy-a").onclick = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(linkA).then(function () { toast("A 的结果链接已复制"); });
        } else toast("请手动复制：" + linkA);
      };
      $("btn-save-cmp").onclick = function () {
        var btn2 = this;
        btn2.disabled = true; btn2.textContent = "生成中…";
        LT.saveLongImage($("cmp-out"), function (canvas, err) {
          btn2.disabled = false; btn2.textContent = "📷 保存对比长图";
          if (err) { toast(err); return; }
          var url = canvas.toDataURL("image/png");
          var w = window.open("");
          if (w) {
            w.document.write('<html><body style="margin:0;background:#f6f1e6"><img src="' + url +
              '" style="width:100%;display:block"/></body></html>');
            toast("已打开图片窗口，长按或右键保存");
          } else {
            var a2 = document.createElement("a");
            a2.href = url; a2.download = "爱的错位-对比-" + a + "-" + b + ".png";
            document.body.appendChild(a2); a2.click(); a2.remove();
          }
        });
      };
    }).catch(function () {
      btn.disabled = false; btn.textContent = "开始对比";
      msg.textContent = "网络异常，请稍后重试";
    });
  }

  function init() {
    API.init();
    renderRecent();
    var params = new URLSearchParams(location.search);
    if (params.get("a")) $("code-a").value = params.get("a").toUpperCase();
    if (params.get("b")) $("code-b").value = params.get("b").toUpperCase();
    $("btn-compare").onclick = compare;
    ["code-a", "code-b"].forEach(function (id) {
      $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") compare(); });
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
