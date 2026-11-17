/* 중소기업 취업자 소득세 감면 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Sme = window.DotoriSme;
  if (!UI || !Core || !Sme) return;

  function init() {
    var el = {
      salary: document.getElementById("sme-salary"),
      tax: document.getElementById("sme-tax"),
      age: document.getElementById("sme-age"),
      military: document.getElementById("sme-military"),
      years: document.getElementById("sme-years"),
      excluded: document.getElementById("sme-excluded"),
      modeGroup: document.querySelector('[data-segment="tax-mode"]'),
      autoWrap: document.getElementById("sme-auto-wrap"),
      manualWrap: document.getElementById("sme-manual-wrap"),
      autoTax: document.getElementById("sme-auto-tax"),
      verdict: document.getElementById("sme-verdict"),
      warnings: document.getElementById("sme-warnings"),
      byYear: document.getElementById("sme-by-year"),
      example: document.getElementById("sme-example-table")
    };
    if (!el.salary || !el.tax) return;

    function clampField(input, min, max) {
      if (!input) return;
      function fix() {
        if (input.value === "" || input.value === "-") return;
        var v = Number(input.value);
        if (!isFinite(v)) {
          input.value = "";
          return;
        }
        if (v < min) input.value = String(min);
        else if (v > max) input.value = String(max);
      }
      input.addEventListener("change", fix);
      input.addEventListener("blur", fix);
    }
    clampField(el.salary, 0, 100000);
    clampField(el.tax, 0, 100000);
    clampField(el.age, 15, 100);
    clampField(el.military, 0, 6);

    function mode() {
      return UI.segmentValue(el.modeGroup) || "auto";
    }

    function applyMode() {
      var manual = mode() === "manual";
      el.autoWrap.hidden = manual;
      el.manualWrap.hidden = !manual;
      render();
    }

    function render() {
      var salaryMan = UI.toNumber(el.salary, 4000);
      var result = Sme.compute({
        salaryMan: salaryMan,
        taxMode: mode(),
        taxMan: UI.toNumber(el.tax, 0),
        type: UI.radioValue("sme-type", "youth"),
        age: UI.toNumber(el.age, 29),
        militaryYears: UI.toNumber(el.military, 0),
        years: Number(el.years.value || 5),
        excluded: !!(el.excluded && el.excluded.checked)
      });

      /* 자동 추정 안내 */
      UI.setText(
        el.autoTax,
        Core.won(Math.round(result.estimatedDeterminedMan * 10000))
      );

      /* 큰 숫자 */
      UI.countTo("sme-total", result.totalRefund, Core.comma);
      UI.setText(
        "sme-sub",
        result.years > 0
          ? result.typeLabel + " · " + result.years + "년치 기준 · 지방소득세 포함"
          : "대상 아님 · 환급 예상액 0원"
      );

      UI.setText("sme-year-tax", Core.won(result.taxSaving));
      UI.setText("sme-year-local", Core.won(result.localSaving));
      UI.setText("sme-year-total", Core.won(result.yearTotal));
      UI.setText("sme-rate", Math.round(result.rate * 100) + "%");
      UI.setText("sme-after", Core.won(result.afterTax));
      UI.setText(
        "sme-cap",
        result.capHit ? "한도 도달 (200만원)" : "한도 미도달"
      );

      /* 판정 */
      if (el.verdict) {
        el.verdict.className = "notice " + (result.eligible ? "notice--good" : "notice--bad");
        var icon = result.eligible ? "✓" : "!";
        el.verdict.innerHTML =
          '<span class="notice__icon" aria-hidden="true">' +
          icon +
          "</span><span>" +
          result.verdict +
          "</span>";
      }
      UI.setText(
        "sme-verdict-title",
        result.eligible ? "대상 판정 · 감면 가능" : "대상 판정 · 확인 필요"
      );

      /* 경고 리스트 */
      if (el.warnings) {
        el.warnings.innerHTML = result.warnings
          .map(function (w) {
            return (
              '<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">!</span><span>' +
              w +
              "</span></div>"
            );
          })
          .join("");
      }

      /* 연도별 표 */
      if (el.byYear) {
        el.byYear.innerHTML = result.byYear
          .map(function (row) {
            if (!row.applied) {
              return (
                '<tr><th scope="row">' +
                row.year +
                '년차</th><td class="is-muted">—</td></tr>'
              );
            }
            return (
              '<tr><th scope="row">' +
              row.year +
              '년차</th><td>' +
              Core.manLabel(row.total / 10000) +
              "</td></tr>"
            );
          })
          .join("");
      }

      renderExamples();
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function renderExamples() {
      if (!el.example) return;
      var salaries = [3000, 4000, 5000, 6000, 8000];
      el.example.innerHTML = salaries
        .map(function (s) {
          var r = Sme.compute({
            salaryMan: s,
            type: "youth",
            age: 29,
            years: 5
          });
          return (
            "<tr><th scope=\"row\">" +
            Core.comma(s) +
            "만원</th><td>" +
            Core.manLabel(r.determinedMan) +
            "</td><td>" +
            Core.manLabel(r.yearTotal / 10000) +
            "</td><td>" +
            Core.manLabel(r.totalRefund / 10000) +
            "</td></tr>"
          );
        })
        .join("");
    }

    UI.bindSegment(el.modeGroup, applyMode);
    [el.salary, el.tax, el.age, el.military, el.years, el.excluded]
      .filter(Boolean)
      .forEach(function (node) {
        node.addEventListener("change", render);
      });
    UI.$$('input[name="sme-type"]').forEach(function (r) {
      r.addEventListener("change", render);
    });
    UI.onInput([el.salary, el.tax, el.age, el.military], render, 90);

    applyMode();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
