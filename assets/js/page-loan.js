/* 대출 이자 · 상환방식 비교 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Loan = window.DotoriLoan;
  if (!UI || !Core || !Loan) return;

  function init() {
    var el = {
      principal: document.getElementById("loan-principal"),
      rate: document.getElementById("loan-rate"),
      years: document.getElementById("loan-years"),
      grace: document.getElementById("loan-grace"),
      method: document.getElementById("loan-method"),
      growth: document.getElementById("loan-growth"),
      growthField: document.querySelector("[data-loan-growth-field]"),
      presets: document.querySelector("[data-loan-presets]"),
      compare: document.getElementById("loan-compare"),
      yearly: document.getElementById("loan-yearly"),
      warnings: document.getElementById("loan-warnings")
    };
    if (!el.principal) return;

    function readInput(methodOverride) {
      return {
        principalMan: UI.toNumber(el.principal, 30000),
        interestRate: UI.toNumber(el.rate, 4),
        years: UI.toNumber(el.years, 30),
        graceMonths: UI.toNumber(el.grace, 0),
        growthRate: UI.toNumber(el.growth, 5) / 100,
        method: methodOverride || el.method.value
      };
    }

    function render() {
      var r = Loan.compute(readInput());
      UI.countTo("loan-first", r.firstPayment, Core.comma);
      UI.setText(
        "loan-sub",
        r.methodLabel + " · 총 이자 " + Core.won(r.totalInterest) + " · 총 납입 " + Core.won(r.totalPayment)
      );
      UI.setText(
        "loan-pill",
        Core.manLabel(r.principalMan) + " · 연 " + r.annualRate + "% · " + r.years + "년" +
          (r.graceMonths > 0 ? " · 거치 " + r.graceMonths + "개월" : "")
      );

      UI.setText("loan-first-row", Core.won(r.firstPayment));
      UI.setText("loan-last-row", Core.won(r.lastPayment));
      UI.setText("loan-avg", Core.won(r.avgPayment));
      UI.setText("loan-total", Core.won(r.totalPayment));
      UI.setText("loan-interest", Core.won(r.totalInterest));
      UI.setText("loan-ratio", (r.interestRatio * 100).toFixed(1) + "%");
      UI.setText("loan-repay-first", Core.won(r.firstRepayPayment));

      if (el.growthField) el.growthField.hidden = r.method !== "gradual";
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

      renderCompare();
      renderYearly(r);
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function renderCompare() {
      if (!el.compare) return;
      var base = readInput("equal");
      var rows = Loan.compare(base);
      var equalInterest = 0;
      rows.forEach(function (row) {
        if (row.method === "equal") equalInterest = row.totalInterest;
      });
      el.compare.innerHTML = rows
        .map(function (row) {
          var diff =
            row.method === "equal"
              ? "-"
              : (row.totalInterest - equalInterest >= 0 ? "+" : "-") +
                Core.won(Math.abs(row.totalInterest - equalInterest));
          return (
            "<tr><th scope=\"row\">" +
            row.label +
            "</th><td>" +
            Core.won(row.firstPayment) +
            "</td><td>" +
            Core.won(row.lastPayment) +
            "</td><td class=\"" +
            (row.best ? "is-best" : "") +
            "\">" +
            Core.won(row.totalInterest) +
            "</td><td>" +
            diff +
            "</td></tr>"
          );
        })
        .join("");
    }

    function renderYearly(result) {
      if (!el.yearly) return;
      var years = result.yearly;
      var pick = [];
      var marks = [1, 2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      marks.forEach(function (m) {
        if (m <= years.length && (m <= 3 || m % 5 === 0)) pick.push(m);
      });
      if (years.length && pick.indexOf(years.length) < 0) pick.push(years.length);
      el.yearly.innerHTML = pick
        .map(function (m) {
          var row = years[m - 1];
          return (
            "<tr><th scope=\"row\">" +
            m +
            "년차</th><td>" +
            Core.won(row.payment) +
            "</td><td>" +
            Core.won(row.interest) +
            "</td><td>" +
            Core.won(row.principal) +
            "</td><td>" +
            Core.won(row.balance) +
            "</td></tr>"
          );
        })
        .join("");
    }

    if (el.presets) {
      UI.$$("button[data-loan-preset]", el.presets).forEach(function (btn) {
        btn.addEventListener("click", function () {
          el.principal.value = btn.getAttribute("data-principal");
          el.rate.value = btn.getAttribute("data-rate");
          el.years.value = btn.getAttribute("data-years");
          el.grace.value = btn.getAttribute("data-grace") || "0";
          if (el.method) el.method.value = "equal";
          UI.$$("button[data-loan-preset]", el.presets).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          render();
        });
      });
    }

    [el.principal, el.rate, el.years, el.grace, el.growth].forEach(function (node) {
      node.addEventListener("change", render);
    });
    if (el.method) el.method.addEventListener("change", render);
    UI.onInput([el.principal, el.rate, el.years, el.grace], render, 100);
    UI.onInput([el.growth], render, 120);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
