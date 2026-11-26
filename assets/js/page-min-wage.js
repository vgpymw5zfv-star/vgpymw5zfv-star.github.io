/* 최저임금 · 주휴수당 계산기 — 페이지 연결
   - 2026년 10,320원 / 2027년 10,700원 기준
   - 주휴수당·주급·월급·연봉, 주휴 포함 시급 역산, 최저임금 판정
   - 주 근무시간별 표, 요약 복사
   코어: assets/js/min-wage.js (window.DotoriMinWage)
*/
(function () {
  "use strict";

  var M = window.DotoriMinWage;
  var UI = window.DotoriUI;
  if (!M || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function hourText(v) {
    var n = Math.round((Number(v) || 0) * 10) / 10;
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
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
    var el = {
      year: $id("mw-year"),
      day: $id("mw-day"),
      days: $id("mw-days"),
      attend: $id("mw-attend"),
      weeklyOut: $id("mw-weekly-out"),
      rate: $id("mw-rate"),
      rateLabel: $id("mw-rate-label"),
      rateHelp: $id("mw-rate-help"),
      mode: $id("mw-mode"),
      minBtn: $id("mw-min"),
      monthly: $id("mw-monthly"),
      monthlySub: $id("mw-monthly-sub"),
      weekly: $id("mw-weekly"),
      holidayHours: $id("mw-holiday-hours"),
      holidayPay: $id("mw-holiday-pay"),
      weeklyPay: $id("mw-weekly-pay"),
      monthHours: $id("mw-month-hours"),
      annual: $id("mw-annual"),
      note: $id("mw-note"),
      judge: $id("mw-judge"),
      judgeText: $id("mw-judge-text"),
      warn: $id("mw-warn"),
      warnText: $id("mw-warn-text"),
      tableRate: $id("mw-table-rate"),
      table: $id("mw-table"),
      text: $id("mw-text"),
      copy: $id("mw-copy"),
      status: $id("mw-status")
    };

    if (!el.rate) return;

    var last = null;
    var lastYear = "2026";

    function yearValue() {
      return UI.segmentValue(el.year) === "2027" ? "2027" : "2026";
    }

    function modeValue() {
      return UI.segmentValue(el.mode) === "package" ? "package" : "hourly";
    }

    function attendValue() {
      return UI.segmentValue(el.attend) !== "absent";
    }

    function options() {
      return {
        year: yearValue(),
        dayHours: el.day ? el.day.value : 8,
        days: el.days ? el.days.value : 5,
        attend: attendValue(),
        rate: el.rate.value,
        mode: modeValue()
      };
    }

    /* 주 근무시간별 표 — 15·20·25·30·35·40시간 */
    function paintTable(r) {
      if (!el.table) return;
      var body = el.table.querySelector("tbody");
      if (!body) return;
      var rows = [15, 20, 25, 30, 35, 40];
      var html = rows
        .map(function (w) {
          var hh = M.holidayHours(w);
          var hp = hh * r.baseRate;
          var week = (w + hh) * r.baseRate;
          var month = (w + hh) * (M.MONTHLY_HOURS / 48) * r.baseRate;
          var on = Math.abs(w - r.weeklyHours) < 0.01 ? ' class="is-best"' : "";
          return (
            "<tr>" +
            '<th scope="row">' + w + "시간</th>" +
            "<td" + on + ' data-label="주휴시간">' + (hh ? hh + "시간" : "없음") + "</td>" +
            "<td" + on + ' data-label="주휴수당">' + M.won(hp) + "</td>" +
            "<td" + on + ' data-label="주급">' + M.won(week) + "</td>" +
            "<td" + on + ' data-label="월급(주휴 포함)">' + M.won(month) + "</td>" +
            "</tr>"
          );
        })
        .join("");
      body.innerHTML = html;
    }

    function paint() {
      var r = M.calc(options());
      last = r;

      setText(el.weeklyOut, "주 " + M.num(r.weeklyHours, 0, 0, 168) + "시간");
      setText(el.monthly, M.won(r.monthlyPay));
      setText(
        el.monthlySub,
        "월 환산 " + hourText(r.monthlyHours) + "시간 · 주휴수당 " + M.won(r.holidayPay) + " 포함"
      );
      setText(el.weekly, r.weeklyHours + "시간");
      setText(el.holidayHours, r.holidayHours ? r.holidayHours + "시간" : "없음");
      setText(el.holidayPay, M.won(r.holidayPay));
      setText(el.weeklyPay, M.won(r.weeklyPay));
      setText(el.monthHours, hourText(r.monthlyHours) + "시간");
      setText(el.annual, M.won(r.annualPay));

      /* 시급 라벨·도움말 — 주휴 포함 모드면 역산한 기본시급을 보여 준다 */
      if (r.mode === "package") {
        setText(el.rateLabel, "주휴수당 포함 시급(원)");
        if (el.rateHelp) {
          el.rateHelp.textContent =
            "주휴 " + r.holidayHours + "시간을 뺀 기본시급은 " + M.won(r.baseRate) + "입니다. 최저임금 비교는 이 기본시급으로 합니다.";
        }
      } else {
        setText(el.rateLabel, "시급(원)");
        if (el.rateHelp) {
          el.rateHelp.textContent =
            r.year + "년 최저임금은 " + M.won(r.minHourly) + "입니다. 수습 3개월은 10% 감액한 " +
            M.won(r.minHourly * 0.9) + "까지 가능합니다.";
        }
      }

      /* 최저임금 판정 */
      var j = r.judge;
      var eligible = r.holidayHours > 0;
      if (el.judge) el.judge.hidden = !j.ok;
      if (el.warn) el.warn.hidden = j.ok;
      if (j.ok) {
        setText(
          el.judgeText,
          r.year + "년 최저임금 " + M.won(j.minHourly) + "을 충족합니다" +
            (j.gap > 0 ? " (시간당 +" + M.won(j.gap) + ")" : "") + "."
        );
      } else {
        setText(
          el.warnText,
          r.year + "년 최저임금 " + M.won(j.minHourly) + "에 시간당 " + M.won(Math.abs(j.gap)) +
            " 부족합니다. 월 " + M.won(j.shortMonthly) + " 적게 받는 셈입니다." +
            (r.mode === "package" ? " 포함 시급이 아니라 기본시급 기준입니다." : "")
        );
      }

      if (el.note) {
        el.note.textContent =
          r.year + "년 최저임금 " + M.won(r.minHourly) + " · 월 환산액 " + M.won(r.minMonthly) +
          "(209시간) 기준입니다. 월 환산시간은 (주 소정근로 + 주휴) × 209 ÷ 48로 계산합니다." +
          (eligible ? "" : " 주 15시간 미만이라 주휴수당은 발생하지 않습니다.");
      }

      setText(el.tableRate, M.won(r.baseRate));
      paintTable(r);

      if (el.text) el.text.value = M.summary(r);
    }

    function readYear() {
      var y = yearValue();
      if (y !== lastYear) {
        var prev = M.yearInfo(lastYear).hourly;
        var next = M.yearInfo(y).hourly;
        /* 시급이 이전 연도 최저임금 그대로면 새 연도 최저임금으로 바꿔 준다 */
        if (el.rate && M.num(el.rate.value, 0, 0, 10000000) === prev) {
          el.rate.value = String(next);
        }
        lastYear = y;
      }
      paint();
    }

    UI.onInput([el.day, el.days, el.rate], paint);

    if (el.year) UI.bindSegment(el.year, readYear);
    if (el.attend) UI.bindSegment(el.attend, paint);
    if (el.mode) UI.bindSegment(el.mode, paint);

    if (el.minBtn) {
      el.minBtn.addEventListener("click", function () {
        if (!el.rate) return;
        el.rate.value = String(M.yearInfo(yearValue()).hourly);
        if (el.mode) {
          Array.prototype.forEach.call(el.mode.querySelectorAll("button"), function (b) {
            b.setAttribute("aria-pressed", b.getAttribute("data-value") === "hourly" ? "true" : "false");
          });
        }
        paint();
      });
    }

    if (el.copy) {
      el.copy.setAttribute("data-label", el.copy.textContent);
      el.copy.addEventListener("click", function () {
        if (!last) return;
        copyText(M.summary(last)).then(
          function () {
            flash(el.copy, "복사 완료 ✓");
            if (el.status) el.status.textContent = "급여 계산 요약을 클립보드에 복사했습니다.";
          },
          function () {
            flash(el.copy, "복사 실패");
            if (el.status) el.status.textContent = "복사하지 못했습니다. 화면의 숫자를 직접 옮겨 주세요.";
          }
        );
      });
    }

    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
