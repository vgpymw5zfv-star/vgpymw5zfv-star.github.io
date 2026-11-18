/* 전세·월세 안전 계약 체크리스트 — 페이지 연결
   - 위험도 계산(DotoriLease.compute)
   - 3단계 체크리스트 localStorage 저장 · 완료율
   - 특약 문구 원클릭 복사 · 전체 복사
*/
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Lease = window.DotoriLease;
  if (!UI || !Lease) return;

  var STORE_KEY = "dotori.lease.v1";
  var LEVEL_TEXT = { safe: "안전", caution: "주의", danger: "위험", unknown: "확인 필요" };
  var LEVEL_CLASS = { safe: "badge--good", caution: "badge--warn", danger: "badge--bad", unknown: "badge--neutral" };

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
    } catch (e) {
      /* 저장 불가(사생활 보호 모드 등)여도 화면 동작은 유지 */
    }
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

  function flashButton(btn, label) {
    if (!btn) return;
    var original = btn.getAttribute("data-original-label") || btn.textContent;
    btn.setAttribute("data-original-label", original);
    btn.textContent = label;
    btn.classList.add("is-copied");
    window.clearTimeout(btn._timer);
    btn._timer = window.setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("is-copied");
    }, 1600);
  }

  function init() {
    var el = {
      deposit: document.getElementById("lease-deposit"),
      senior: document.getElementById("lease-senior"),
      market: document.getElementById("lease-market"),
      official: document.getElementById("lease-official"),
      region: document.getElementById("lease-region"),
      level: document.getElementById("lease-level"),
      ratio: document.getElementById("lease-ratio"),
      sub: document.getElementById("lease-sub"),
      gauge: document.getElementById("lease-gauge"),
      debt: document.getElementById("lease-debt"),
      seniorRatio: document.getElementById("lease-senior-ratio"),
      hug: document.getElementById("lease-hug"),
      cap: document.getElementById("lease-cap"),
      warnings: document.getElementById("lease-warnings")
    };
    if (!el.deposit) return;

    var modeGroup = document.querySelector("[data-price-mode]").parentNode;
    var modeButtons = Array.prototype.slice.call(modeGroup.querySelectorAll("[data-price-mode]"));

    var stepGroup = document.querySelector("[data-step]").parentNode;
    var stepButtons = Array.prototype.slice.call(stepGroup.querySelectorAll("[data-step]"));
    var panels = Array.prototype.slice.call(document.querySelectorAll("[data-step-panel]"));
    var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-check]"));
    var resetBtn = document.getElementById("lease-reset");
    var copyAllBtn = document.getElementById("lease-copy-all");
    var countEl = document.getElementById("lease-done-count");
    var totalEl = document.getElementById("lease-total-count");
    var rateEl = document.getElementById("lease-progress-rate");
    var barEl = document.getElementById("lease-progress");

    var state = readStore() || {};
    var checks = state.checks && typeof state.checks === "object" ? state.checks : {};
    var priceMode = state.priceMode === "official" ? "official" : "market";

    if (totalEl) totalEl.textContent = String(boxes.length || 0);

    /* ---------------- 위험도 계산 ---------------- */

    function pct(v) {
      return (Math.round(v * 1000) / 10).toFixed(1).replace(/\.0$/, "");
    }

    function setModeButton(mode) {
      modeButtons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-price-mode") === mode ? "true" : "false");
      });
      if (el.market) el.market.closest(".field").hidden = mode !== "market";
      if (el.official) el.official.closest(".field").hidden = mode !== "official";
    }

    function renderSafety() {
      var result = Lease.compute({
        depositMan: UI.toNumber(el.deposit, 0),
        seniorMan: UI.toNumber(el.senior, 0),
        marketMan: UI.toNumber(el.market, 0),
        officialMan: UI.toNumber(el.official, 0),
        priceMode: priceMode,
        region: el.region ? el.region.value : "metro"
      });

      if (el.level) {
        el.level.textContent = LEVEL_TEXT[result.level] || "확인 필요";
        el.level.className = "badge " + (LEVEL_CLASS[result.level] || "badge--neutral");
      }
      if (el.ratio) el.ratio.textContent = pct(result.ratio);
      if (el.sub) {
        el.sub.textContent = result.officialUsed
          ? "전세가율 = 보증금 ÷ 주택가격(공시가 × 140% = " +
            result.priceMan.toLocaleString("ko-KR") + "만원)"
          : "전세가율 = 보증금 ÷ 주택 시세 " + result.priceMan.toLocaleString("ko-KR") + "만원";
      }
      if (el.gauge) {
        var w = Math.max(0, Math.min(1, result.ratio)) * 100;
        el.gauge.style.width = w + "%";
        el.gauge.className =
          "gauge__fill" + (result.level === "caution" ? " is-warn" : result.level === "danger" ? " is-bad" : "");
      }
      if (el.debt) el.debt.textContent = pct(result.debtRatio) + "%";
      if (el.seniorRatio) {
        el.seniorRatio.textContent = pct(result.seniorRatio) + "%";
      }
      if (el.hug) {
        el.hug.textContent = result.hugOk ? "가능" : "어려움";
        el.hug.className = result.hugOk ? "is-good" : "is-bad";
      }
      if (el.cap) {
        el.cap.textContent =
          (result.region === "metro" ? "수도권 7억" : "그 외 5억") +
          " · 보증한도 " + result.hugLimitMan.toLocaleString("ko-KR") + "만원";
      }

      if (el.warnings) {
        var html = result.reasons
          .map(function (text) {
            var cls =
              result.level === "danger" || result.hugOk === false
                ? "notice notice--warn"
                : "notice";
            return (
              '<div class="' + cls + '"><span class="notice__icon" aria-hidden="true">!</span><span>' +
              text + "</span></div>"
            );
          })
          .join("");
        if (result.hugOk && result.level === "safe") {
          html =
            '<div class="notice notice--good"><span class="notice__icon" aria-hidden="true">✓</span><span>전세가율 80% 미만이고 HUG 가입 요건도 충족하는 것으로 보입니다. 다만 보증 가입은 HUG 심사로만 확정되니 계약 전 사전 확인을 받으세요.</span></div>' +
            html;
        }
        el.warnings.innerHTML = html;
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    /* ---------------- 체크리스트 ---------------- */

    function paintProgress() {
      var done = 0;
      boxes.forEach(function (box) {
        var on = !!checks[box.getAttribute("data-check")];
        box.checked = on;
        var wrap = box.closest(".check");
        if (wrap) wrap.classList.toggle("check--done", on);
        if (on) done += 1;
      });
      var total = boxes.length || 1;
      var rate = Math.round((done / total) * 100);
      if (countEl) countEl.textContent = String(done);
      if (rateEl) rateEl.textContent = String(rate);
      if (barEl) barEl.style.width = rate + "%";
    }

    function saveState() {
      writeStore({
        checks: checks,
        priceMode: priceMode,
        step: currentStep(),
        deposit: el.deposit.value,
        senior: el.senior ? el.senior.value : "",
        market: el.market ? el.market.value : "",
        official: el.official ? el.official.value : "",
        region: el.region ? el.region.value : "metro"
      });
    }

    function currentStep() {
      var active = stepButtons.filter(function (b) {
        return b.getAttribute("aria-pressed") === "true";
      })[0];
      return active ? active.getAttribute("data-step") : "before";
    }

    function showStep(step) {
      stepButtons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-step") === step ? "true" : "false");
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-step-panel") !== step;
      });
    }

    boxes.forEach(function (box) {
      box.addEventListener("change", function () {
        var key = box.getAttribute("data-check");
        if (box.checked) checks[key] = true;
        else delete checks[key];
        box.closest(".check").classList.toggle("check--done", box.checked);
        paintProgress();
        saveState();
      });
    });

    stepButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        showStep(btn.getAttribute("data-step"));
        saveState();
      });
    });

    modeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        priceMode = btn.getAttribute("data-price-mode");
        setModeButton(priceMode);
        renderSafety();
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

    /* ---------------- 복사 ---------------- */

    Array.prototype.slice.call(document.querySelectorAll(".copy-btn")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = document.getElementById(btn.getAttribute("data-copy-target"));
        if (!target) return;
        var text = target.textContent.replace(/\s+/g, " ").trim();
        copyText(text).then(
          function () {
            flashButton(btn, "복사됨");
          },
          function () {
            flashButton(btn, "직접 선택해 주세요");
          }
        );
      });
    });

    if (copyAllBtn) {
      copyAllBtn.addEventListener("click", function () {
        var nodes = Array.prototype.slice.call(document.querySelectorAll("#lease-terms .term"));
        var text = nodes
          .map(function (node, i) {
            var title = node.querySelector("h3") ? node.querySelector("h3").textContent.trim() : "";
            var body = node.querySelector(".term__text") ? node.querySelector(".term__text").textContent.replace(/\s+/g, " ").trim() : "";
            return i + 1 + ". " + title.replace(/^\d+\.\s*/, "") + "\n" + body;
          })
          .join("\n\n");
        copyText(text).then(
          function () {
            flashButton(copyAllBtn, "8개 문구 복사됨");
          },
          function () {
            flashButton(copyAllBtn, "복사 실패 — 직접 선택");
          }
        );
      });
    }

    /* ---------------- 초기값 복원 ---------------- */

    if (state.deposit) el.deposit.value = state.deposit;
    if (state.senior && el.senior) el.senior.value = state.senior;
    if (state.market && el.market) el.market.value = state.market;
    if (state.official && el.official) el.official.value = state.official;
    if (state.region && el.region) el.region.value = state.region;
    setModeButton(priceMode);
    showStep(state.step === "day" || state.step === "after" ? state.step : "before");
    paintProgress();

    [el.deposit, el.senior, el.market, el.official].filter(Boolean).forEach(function (node) {
      node.addEventListener("change", function () {
        renderSafety();
        saveState();
      });
      node.addEventListener("blur", function () {
        renderSafety();
        saveState();
      });
    });
    if (el.region) {
      el.region.addEventListener("change", function () {
        renderSafety();
        saveState();
      });
    }
    UI.onInput([el.deposit, el.senior, el.market, el.official].filter(Boolean), renderSafety, 90);

    renderSafety();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
