/* 爱的错位 · 分享结果页（r.html?code=XXXXXX，Supabase 版） */
var RPage = (function () {
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
    try { document.execCommand("copy"); cb(); } catch (e) { toast("复制失败，请手动长按选中"); }
    document.body.removeChild(ta);
  }

  var code = (new URLSearchParams(location.search).get("code") || "").toUpperCase().trim();

  function init() {
    API.init();
    if (!code) { show("s-error"); return; }
    API.getResult(code).then(function (res) {
      if (!res || !res.ok) { show("s-error"); return; }
      var r = res.result;
      var data = { mode: r.mode, parent: r.parent, child: r.child, combo: r.combo };
      $("capture").innerHTML = LT.renderFull(data, { resultCode: code });
      $("result-code").textContent = code;
      show("s-result");
      setTimeout(function () {
        var fills = document.querySelectorAll("#capture .bar-fill");
        for (var i = 0; i < fills.length; i++) fills[i].style.width = fills[i].getAttribute("data-w") + "%";
      }, 150);

      $("btn-copy-link").onclick = function () {
        copyText(location.href, "链接已复制 🔗");
      };
      $("btn-save-img").onclick = function () {
        var btn = this;
        btn.disabled = true; btn.textContent = "生成中…";
        LT.saveLongImage($("capture"), function (canvas, err) {
          btn.disabled = false; btn.textContent = "📷 保存长图";
          if (err) { toast(err); return; }
          var url = canvas.toDataURL("image/png");
          $("img-out").src = url;
          $("img-hint").innerHTML = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            ? "手机：长按图片即可保存到相册 ✅"
            : "电脑：右键图片「另存为」，或点下方按钮下载";
          $("img-modal").classList.add("on");
          $("btn-download-img").onclick = function () {
            var a = document.createElement("a");
            a.href = url; a.download = "爱的错位-" + code + ".png";
            document.body.appendChild(a); a.click(); a.remove();
          };
        });
      };
    }).catch(function () { show("s-error"); });

    document.querySelectorAll(".modal-mask").forEach(function (m) {
      m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("on"); });
    });
  }
  document.addEventListener("DOMContentLoaded", init);
  return { closeModal: function (id) { $(id).classList.remove("on"); }, toast: toast };
})();
