/* 연말정산 공제·서류 체크리스트 — 페이지 연결
   - 유형 필터(자취·신혼·이직) + 3개 묶음 항목
   - localStorage 저장 · 완료율 · 준비 체크 요약 복사
*/
(function () {
  "use strict";
  var UI = window.DotoriUI;
  if (!UI) return;

  var STORE_KEY = "dotori.yearend.v1";
  var PERSONA_LABEL = {
    all: "전체",
    solo: "자취 직장인",
    newly: "신혼·맞벌이",
    move: "올해 이직·퇴사"
  };
  var GROUP_LABEL = {
    a: "12월 31일 전에 끝내는 절세 액션",
    b: "홈택스 간소화에 안 뜨는 서류",
    c: "1월 연말정산 때 확인"
  };

  function readStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch (e) {
      return null;
    }
  }

  function writeStore(data) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {}
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

  function init() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-check]"));
    if (!boxes.length) return;

    var sections = Array.prototype.slice.call(document.querySelectorAll("section[aria-labelledby]"));
    var personaGroup = document.querySelector("[data-persona]").parentNode;
    var personaButtons = Array.prototype.slice.call(personaGroup.querySelectorAll("[data-persona]"));
    var resetBtn = document.getElementById("yc-reset");
    var copyBtn = document.getElementById("yc-copy-summary");
    var countEl = document.getElementById("yc-done-count");
    var totalEl = document.getElementById("yc-total-count");
    var rateEl = document.getElementById("yc-progress-rate");
    var noteEl = document.getElementById("yc-progress-note");
    var barEl = document.getElementById("yc-progress");

    var state = readStore() || {};
    var checks = state.checks && typeof state.checks === "object" ? state.checks : {};
    var persona = PERSONA_LABEL[state.persona] ? state.persona : "all";

    function itemOf(box) {
      return box.closest(".check");
    }

    function matchesPersona(item) {
      if (persona === "all") return true;
      var tags = (item.getAttribute("data-persona") || "").split(/\s+/);
      return tags.length === 0 || tags.indexOf(persona) !== -1;
    }

    function applyPersona() {
      personaButtons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-persona") === persona ? "true" : "false");
      });
      boxes.forEach(function (box) {
        var item = itemOf(box);
        if (item) item.hidden = !matchesPersona(item);
      });
      /* 선택한 유형에 항목이 하나도 없는 묶음은 섹션째 접는다 */
      sections.forEach(function (section) {
        var sectBoxes = Array.prototype.slice.call(section.querySelectorAll("[data-check]"));
        if (!sectBoxes.length) return;
        var visible = sectBoxes.filter(function (box) {
          var item = itemOf(box);
          return item && !item.hidden;
        }).length;
        section.hidden = visible === 0;
      });
      paintProgress();
    }

    function paintProgress() {
      var done = 0;
      var total = 0;
      boxes.forEach(function (box) {
        var key = box.getAttribute("data-check");
        var on = !!checks[key];
        box.checked = on;
        var item = itemOf(box);
        if (!item) return;
        item.classList.toggle("check--done", on);
        if (item.hidden) return;
        total += 1;
        if (on) done += 1;
      });
      var rate = total > 0 ? Math.round((done / total) * 100) : 0;
      if (countEl) countEl.textContent = String(done);
      if (totalEl) totalEl.textContent = String(total);
      if (rateEl) rateEl.textContent = String(rate);
      if (noteEl) noteEl.textContent = (persona === "all" ? "전체 항목" : PERSONA_LABEL[persona] + " 항목") + " 기준";
      if (barEl) barEl.style.width = rate + "%";
    }

    function saveState() {
      writeStore({ checks: checks, persona: persona });
    }

    boxes.forEach(function (box) {
      box.addEventListener("change", function () {
        var key = box.getAttribute("data-check");
        if (box.checked) checks[key] = true;
        else delete checks[key];
        var item = itemOf(box);
        if (item) item.classList.toggle("check--done", box.checked);
        paintProgress();
        saveState();
      });
    });

    personaButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        persona = btn.getAttribute("data-persona");
        applyPersona();
        saveState();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!window.confirm("체크한 항목을 모두 지울까요? 되돌릴 수 없습니다.")) return;
        checks = {};
        try {
          window.localStorage.removeItem(STORE_KEY);
        } catch (e) {}
        paintProgress();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var lines = [];
        var done = 0;
        var total = 0;
        var groups = { a: [], b: [], c: [] };
        boxes.forEach(function (box) {
          var item = itemOf(box);
          if (!item || item.hidden) return;
          total += 1;
          var key = box.getAttribute("data-check") || "";
          var group = key.charAt(0) || "a";
          var label = item.querySelector(".check__label");
          var text = label ? label.textContent.replace(/\s+/g, " ").trim() : "";
          if (checks[box.getAttribute("data-check")]) {
            done += 1;
            if (groups[group]) groups[group].push(text);
          }
        });
        lines.push("연말정산 준비 체크 · " + PERSONA_LABEL[persona] + " (" + done + "/" + total + " 완료)");
        lines.push("");
        Object.keys(groups).forEach(function (g) {
          if (!groups[g].length) return;
          lines.push("[" + GROUP_LABEL[g] + "]");
          groups[g].forEach(function (t, i) {
            lines.push("✓ " + t);
          });
          lines.push("");
        });
        if (total - done > 0) {
          lines.push("남은 항목 " + (total - done) + "개 · 체크리스트에서 이어서 확인하세요.");
        }
        lines.push("기준: 2026년 귀속 · 자세히: https://vgpymw5zfv-star.github.io/year-end-check/");

        copyText(lines.join("\n")).then(
          function () {
            var original = copyBtn.textContent;
            copyBtn.textContent = "복사됨";
            copyBtn.classList.add("is-copied");
            window.clearTimeout(copyBtn._timer);
            copyBtn._timer = window.setTimeout(function () {
              copyBtn.textContent = original;
              copyBtn.classList.remove("is-copied");
            }, 1600);
          },
          function () {
            window.alert("복사가 차단되었습니다. 화면의 체크 항목을 직접 선택해 주세요.");
          }
        );
      });
    }

    applyPersona();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
