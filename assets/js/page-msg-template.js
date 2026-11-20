/* 실무 문자·메일 템플릿 생성기 — 페이지 연결
   - 상황(4) → 템플릿(11) 선택, 공통·개별 입력값 실시간 치환
   - 정중한 업무용 / 부드러운 카톡용 말투 전환
   - 원클릭 복사(본문 / 제목 포함), 링크 공유, 문자 규격 표시
   - 입력값은 브라우저 안에서만 처리하고 주소에도 남기지 않는다 (템플릿 id·말투만 남김)
*/
(function () {
  "use strict";

  var M = window.DotoriMsg;
  var UI = window.DotoriUI;
  if (!M || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  function flash(btn, text) {
    if (!btn) return;
    var label = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", label);
    btn.textContent = text;
    btn.classList.add("is-copied");
    window.clearTimeout(btn._timer);
    btn._timer = window.setTimeout(function () {
      btn.textContent = label;
      btn.classList.remove("is-copied");
    }, 1600);
  }

  function init() {
    var out = $id("msg-out");
    if (!out) return;

    var el = {
      fields: $id("msg-fields"),
      to: $id("msg-to"),
      from: $id("msg-from"),
      desc: $id("msg-tpl-desc"),
      subject: $id("msg-subject"),
      meta: $id("msg-meta"),
      copy: $id("msg-copy"),
      copyAll: $id("msg-copy-all"),
      share: $id("msg-share"),
      reset: $id("msg-reset"),
      status: $id("msg-status"),
      title: $id("msg-title")
    };

    var groupChips = UI.$$("[data-msg-group]");
    var tplChips = UI.$$("[data-msg-tpl]");
    var toneButtons = UI.$$("[data-tone]");

    var store = {};
    var state = { group: "rent", template: "repair", tone: "official" };
    var current = null;

    /* ---------------- 입력값 보관 ---------------- */

    function valuesFor(tpl) {
      if (!store[tpl.id]) {
        var seed = {};
        tpl.fields.forEach(function (field) {
          seed[field.key] = field.example;
        });
        store[tpl.id] = seed;
      }
      return store[tpl.id];
    }

    function allValues(tpl) {
      var v = valuesFor(tpl);
      var merged = {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) merged[k] = v[k];
      merged.to = el.to ? el.to.value : "";
      merged.from = el.from ? el.from.value : "";
      return merged;
    }

    /* ---------------- 입력 필드 그리기 ---------------- */

    function paintFields(tpl) {
      if (!el.fields) return;
      var v = valuesFor(tpl);
      el.fields.innerHTML = "";

      tpl.fields.forEach(function (field) {
        var label = document.createElement("label");
        label.className = "field";

        var name = document.createElement("span");
        name.className = "field-label";
        name.textContent = field.label;
        label.appendChild(name);

        var control = document.createElement("span");
        control.className = "field-control";

        var input = document.createElement("input");
        input.type = "text";
        input.className = "msg-field";
        input.setAttribute("data-key", field.key);
        input.value = v[field.key] == null ? "" : v[field.key];
        input.placeholder = field.placeholder || "";
        input.autocomplete = "off";
        control.appendChild(input);

        label.appendChild(control);
        el.fields.appendChild(label);
      });
    }

    /* ---------------- 결과 그리기 ---------------- */

    function paint() {
      if (!current) return;
      var result = M.render(current.id, allValues(current), state.tone);
      out.value = result.body;

      if (el.subject) {
        el.subject.textContent = result.subject ? "메일 제목: " + result.subject : "";
        el.subject.hidden = !result.subject;
      }
      if (el.title) {
        el.title.textContent = current.title + " · " + result.toneLabel;
      }
      if (el.meta) {
        el.meta.textContent =
          result.chars.toLocaleString("ko-KR") +
          "자 · EUC-KR " +
          result.bytes.toLocaleString("ko-KR") +
          "B · " +
          result.sms.label;
      }
      if (el.desc) {
        el.desc.textContent =
          M.groupById(current.group).label + " · " + current.summary;
      }
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function selectTemplate(id) {
      var tpl = M.templateById(id);
      if (!tpl) return;
      current = tpl;
      state.template = tpl.id;
      state.group = tpl.group;

      groupChips.forEach(function (chip) {
        chip.setAttribute(
          "aria-pressed",
          chip.getAttribute("data-msg-group") === tpl.group ? "true" : "false"
        );
      });
      tplChips.forEach(function (chip) {
        var mine = chip.getAttribute("data-msg-tpl") === tpl.id;
        chip.setAttribute("aria-pressed", mine ? "true" : "false");
        chip.hidden = chip.getAttribute("data-msg-group") !== tpl.group;
      });

      paintFields(tpl);
      paint();
      syncUrl();
      if (el.status) el.status.textContent = "";
    }

    /* ---------------- 주소 공유 (개인 입력값 제외) ---------------- */

    function syncUrl() {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set("t", state.template);
        url.searchParams.set("tone", state.tone);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (e) {
        /* 주소 갱신이 막혀도 동작 */
      }
    }

    function shareUrl() {
      try {
        var url = new URL(window.location.href);
        return url.toString();
      } catch (e) {
        return window.location.href;
      }
    }

    function restoreFromUrl() {
      var params;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (e) {
        return;
      }
      var id = params.get("t");
      var tone = params.get("tone");
      if (tone === "casual" || tone === "official") state.tone = tone;
      if (id && M.templateById(id)) state.template = id;
      toneButtons.forEach(function (btn) {
        btn.setAttribute(
          "aria-pressed",
          btn.getAttribute("data-tone") === state.tone ? "true" : "false"
        );
      });
    }

    /* ---------------- 이벤트 ---------------- */

    groupChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var group = chip.getAttribute("data-msg-group");
        var first = M.templatesOf(group)[0];
        if (first) selectTemplate(first.id);
      });
    });

    tplChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        selectTemplate(chip.getAttribute("data-msg-tpl"));
      });
    });

    toneButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.tone = btn.getAttribute("data-tone") === "casual" ? "casual" : "official";
        toneButtons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        paint();
        syncUrl();
      });
    });

    if (el.fields) {
      el.fields.addEventListener("input", function (e) {
        var target = e.target;
        if (!target || !target.getAttribute) return;
        var key = target.getAttribute("data-key");
        if (!key || !current) return;
        valuesFor(current)[key] = target.value;
        paint();
      });
    }

    [el.to, el.from].forEach(function (input) {
      if (!input) return;
      input.addEventListener("input", paint);
    });

    if (el.reset) {
      el.reset.addEventListener("click", function () {
        if (!current) return;
        var seed = {};
        current.fields.forEach(function (field) {
          seed[field.key] = field.example;
        });
        store[current.id] = seed;
        if (el.to) el.to.value = M.COMMON_FIELDS[0].example;
        if (el.from) el.from.value = M.COMMON_FIELDS[1].example;
        paintFields(current);
        paint();
        if (el.status) el.status.textContent = "예시 값으로 되돌렸습니다. 필요한 부분만 고쳐 쓰세요.";
      });
    }

    if (el.copy) {
      el.copy.setAttribute("data-label", el.copy.textContent);
      el.copy.addEventListener("click", function () {
        copyText(out.value).then(
          function () {
            flash(el.copy, "복사 완료 ✓");
            if (el.status) el.status.textContent = "본문을 클립보드에 복사했습니다.";
          },
          function () {
            flash(el.copy, "복사 실패");
            if (el.status) el.status.textContent = "복사가 차단되었습니다. 본문을 직접 선택해 복사해 주세요.";
          }
        );
      });
    }

    if (el.copyAll) {
      el.copyAll.setAttribute("data-label", el.copyAll.textContent);
      el.copyAll.addEventListener("click", function () {
        if (!current) return;
        var result = M.render(current.id, allValues(current), state.tone);
        copyText(result.withSubject).then(
          function () {
            flash(el.copyAll, "복사 완료 ✓");
            if (el.status) el.status.textContent = "메일 제목과 본문을 함께 복사했습니다.";
          },
          function () {
            flash(el.copyAll, "복사 실패");
          }
        );
      });
    }

    if (el.share) {
      el.share.setAttribute("data-label", el.share.textContent);
      el.share.addEventListener("click", function () {
        var url = shareUrl();
        var title = current ? "실무 문자 템플릿 · " + current.title : "실무 문자 템플릿";

        function copyLink() {
          copyText(url).then(
            function () {
              flash(el.share, "링크 복사됨 ✓");
              if (el.status)
                el.status.textContent = "템플릿 링크를 복사했습니다. 입력한 내용은 링크에 담기지 않습니다.";
            },
            function () {
              flash(el.share, "복사 실패");
            }
          );
        }

        if (navigator.share) {
          var pending;
          try {
            pending = navigator.share({ title: title, url: url });
          } catch (e) {
            copyLink();
            return;
          }
          if (pending && typeof pending.then === "function") {
            pending.then(
              function () {
                if (el.status) el.status.textContent = "";
              },
              function (err) {
                if (err && (err.name === "AbortError" || err.name === "Abort")) return;
                copyLink();
              }
            );
          }
          return;
        }
        copyLink();
      });
    }

    /* ---------------- 시작 ---------------- */

    if (el.to) el.to.value = M.COMMON_FIELDS[0].example;
    if (el.from) el.from.value = M.COMMON_FIELDS[1].example;
    restoreFromUrl();
    selectTemplate(state.template);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
