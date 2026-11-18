/* 퇴직금 · 퇴직소득세 실수령 & 연차수당 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Sev = window.DotoriSeverance;
  if (!UI || !Core || !Sev) return;

  function init() {
    var el = {
      modeGroup: document.querySelector('[data-segment="sev-mode"]'),
      dateBox: document.querySelector("[data-sev-dates]"),
      periodBox: document.querySelector("[data-sev-period]"),
      start: document.getElementById("sev-start"),
      end: document.getElementById("sev-end"),
      years: document.getElementById("sev-years"),
      months: document.getElementById("sev-months"),
      base: document.getElementById("sev-base"),
      allow: document.getElementById("sev-allow"),
      bonus: document.getElementById("sev-bonus"),
      nontax: document.getElementById("sev-nontax"),
      includeNonTax: document.getElementById("sev-include-nontax"),
      avgDays: document.getElementById("sev-avg-days"),
      leaveDays: document.getElementById("sev-leave-days"),
      leaveInAvg: document.getElementById("sev-leave-in-avg"),
      irpBar: document.querySelector("[data-sev-irp]"),
      warnings: document.getElementById("sev-warnings"),
      table: document.getElementById("sev-table")
    };
    if (!el.start) return;

    var mode = "dates";
    var irpTerm = "under10";

    function readInput() {
      return {
        mode: mode,
        startDate: el.start.value,
        endDate: el.end.value,
        years: UI.toNumber(el.years, 5),
        months: UI.toNumber(el.months, 0),
        baseMan: UI.toNumber(el.base, 300),
        allowMan: UI.toNumber(el.allow, 0),
        bonusMan: UI.toNumber(el.bonus, 0),
        nonTaxWon: UI.toNumber(el.nontax, 0),
        includeNonTax: el.includeNonTax ? el.includeNonTax.checked : true,
        avgDays: UI.toNumber(el.avgDays, 91),
        leaveDays: UI.toNumber(el.leaveDays, 0),
        includeLeaveInAvg: !!(el.leaveInAvg && el.leaveInAvg.checked),
        irpTerm: irpTerm
      };
    }

    function render() {
      var r = Sev.compute(readInput());

      UI.setText("sev-net", Core.won(r.net));
      UI.setText(
        "sev-sub",
        "세전 퇴직금 " + Core.won(r.pay) + " · 퇴직소득세 " + Core.won(r.tax.total)
      );
      UI.setText("sev-gross", Core.won(r.gross));
      UI.setText("sev-leave", Core.won(r.leaveAllowance));
      UI.setText("sev-pay", Core.won(r.pay));
      UI.setText("sev-tax", Core.won(r.tax.incomeTax));
      UI.setText("sev-local", Core.won(r.tax.localTax));
      UI.setText("sev-tax-total", Core.won(r.tax.total));
      UI.setText("sev-rate", (r.tax.effectiveRate * 100).toFixed(2) + "%");
      UI.setText("sev-daily", Core.won(r.dailyAvg));
      UI.setText("sev-service", r.serviceLabel);
      UI.setText("sev-taxyears", r.taxYears + "년");
      UI.setText("sev-monthly-wage", Core.won(r.monthlyWage));

      UI.setText("sev-ded", Core.won(r.tax.serviceDeduction));
      UI.setText("sev-pay2", Core.won(r.tax.pay));
      UI.setText("sev-tax2", Core.won(r.tax.incomeTax));
      UI.setText("sev-converted", Core.won(r.tax.converted));
      UI.setText("sev-conv-ded", Core.won(r.tax.convertedDeduction));
      UI.setText("sev-base-tax", Core.won(r.tax.taxBase));
      UI.setText("sev-conv-tax", Core.won(r.tax.convertedTax));

      UI.setText("sev-irp-won", Core.won(r.tax.total));
      UI.setText("sev-irp-u10", Core.won(r.tax.irp.under10.total));
      UI.setText("sev-irp-o10", Core.won(r.tax.irp.over10.total));
      UI.setText("sev-irp-saving", Core.won(r.irp.saving));

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

      UI.countTo("sev-net", r.net, Core.comma);

      var svc = document.getElementById("sev-service-pill");
      if (svc) svc.textContent = "근속 " + r.serviceLabel + " · 세법상 " + r.taxYears + "년";

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function renderTable() {
      if (!el.table) return;
      var rows = Sev.compareByYears(readInput(), [1, 3, 5, 7, 10, 15, 20, 25]);
      el.table.innerHTML = rows
        .map(function (row) {
          return (
            "<tr><th scope=\"row\">" +
            row.years +
            "년</th><td>" +
            Core.won(row.pay) +
            "</td><td>" +
            Core.won(row.tax) +
            "</td><td class=\"is-best\">" +
            Core.won(row.net) +
            "</td><td>" +
            (row.rate * 100).toFixed(2) +
            "%</td></tr>"
          );
        })
        .join("");
    }

    function syncMode() {
      var v = UI.segmentValue(el.modeGroup) || "dates";
      mode = v === "period" ? "period" : "dates";
      if (el.dateBox) el.dateBox.hidden = mode !== "dates";
      if (el.periodBox) el.periodBox.hidden = mode !== "period";
      render();
      renderTable();
    }

    if (el.modeGroup) UI.bindSegment(el.modeGroup, syncMode);

    var chips = UI.$$("[data-sev-preset]");
    chips.forEach(function (btn) {
      btn.addEventListener("click", function () {
        el.years.value = btn.getAttribute("data-sev-preset");
        el.months.value = "0";
        chips.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        render();
        renderTable();
      });
    });

    if (el.irpBar) {
      UI.bindSegment(el.irpBar, function (v) {
        irpTerm = v === "over10" ? "over10" : "under10";
        render();
      });
    }

    var inputs = [
      el.start,
      el.end,
      el.years,
      el.months,
      el.base,
      el.allow,
      el.bonus,
      el.nontax,
      el.avgDays,
      el.leaveDays
    ].filter(Boolean);
    inputs.forEach(function (node) {
      node.addEventListener("change", function () {
        render();
        renderTable();
      });
    });
    [el.includeNonTax, el.leaveInAvg].filter(Boolean).forEach(function (node) {
      node.addEventListener("change", function () {
        render();
        renderTable();
      });
    });
    UI.onInput(inputs, function () {
      render();
      renderTable();
    }, 100);

    syncMode();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
