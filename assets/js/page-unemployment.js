/* 2026 실업급여(구직급여) — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Un = window.DotoriUnemployment;
  if (!UI || !Core || !Un) return;

  function init() {
    var el = {
      hours: document.getElementById("un-hours"),
      ageGroup: document.querySelector('[data-segment="un-age"]'),
      insured: document.getElementById("un-insured"),
      monthly: document.getElementById("un-monthly-pay"),
      days3m: document.getElementById("un-days3m"),
      warnings: document.getElementById("un-warnings"),
      table: document.getElementById("un-wage-table")
    };
    if (!el.hours) return;

    function readInput() {
      return {
        hours: UI.toNumber(el.hours, 8),
        ageGroup: UI.segmentValue(el.ageGroup) || "under50",
        insured: el.insured.value,
        monthlyMan: UI.toNumber(el.monthly, 300),
        days3m: UI.toNumber(el.days3m, 91)
      };
    }

    function render() {
      var r = Un.compute(readInput());

      UI.countTo("un-daily", r.daily, Core.comma);
      var badge = { cap: "상한액 적용", floor: "하한액 적용", normal: "평균임금 60% 적용" };
      UI.setText("un-badge", badge[r.applied] || "");
      UI.setText(
        "un-sub",
        r.ageLabel + " · " + r.insuredLabel + " · 소정급여일수 " + r.benefitDays + "일"
      );
      UI.setText("un-pill", "1일 평균임금 " + Core.won(r.dailyAvg) + " × 60%");

      UI.setText("un-avg", Core.won(r.dailyAvg));
      UI.setText("un-candidate", Core.won(r.candidate));
      UI.setText("un-floor", Core.won(r.floor));
      UI.setText("un-cap", Core.won(r.cap));
      UI.setText("un-days", r.benefitDays + "일");
      UI.setText("un-total", Core.won(r.total));
      UI.setText("un-monthly", Core.won(r.monthly));
      UI.setText("un-early", Core.won(r.earlyReemployment));

      if (el.warnings) {
        el.warnings.innerHTML = r.warnings
          .map(function (w) {
            return (
              '<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">!</span><span>' +
              w +
              "</span></div>"
            );
          })
          .join("");
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function renderTable() {
      if (!el.table) return;
      var hours = UI.toNumber(el.hours, 8);
      var rows = Un.byMonthlyWage([216, 250, 300, 350, 400, 500]).map(function (row) {
        /* 표는 8시간 기준 엔진 결과를 소정근로시간에 맞춰 다시 계산 */
        var calc = Un.dailyBenefit(row.dailyAvg, hours);
        return {
          monthlyMan: row.monthlyMan,
          dailyAvg: row.dailyAvg,
          daily: calc.amount,
          applied: calc.applied
        };
      });
      el.table.innerHTML = rows
        .map(function (row) {
          var tag =
            row.applied === "floor" ? "하한" : row.applied === "cap" ? "상한" : "60%";
          return (
            "<tr><th scope=\"row\">" +
            row.monthlyMan +
            "만원</th><td>" +
            Core.won(row.dailyAvg) +
            "</td><td class=\"is-best\">" +
            Core.won(row.daily) +
            "</td><td class=\"is-center\">" +
            tag +
            "</td><td>" +
            Core.won(row.daily * 30) +
            "</td></tr>"
          );
        })
        .join("");
    }

    if (el.ageGroup) UI.bindSegment(el.ageGroup, render);
    [el.hours, el.monthly, el.days3m].forEach(function (node) {
      node.addEventListener("change", function () {
        render();
        renderTable();
      });
    });
    if (el.insured) {
      el.insured.addEventListener("change", render);
    }
    UI.onInput([el.monthly, el.days3m], function () {
      render();
      renderTable();
    }, 100);

    render();
    renderTable();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
