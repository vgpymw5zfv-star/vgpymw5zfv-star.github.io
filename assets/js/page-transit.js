/* K-패스 vs 기후동행카드 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Transit = window.DotoriTransit;
  if (!UI || !Core || !Transit) return;

  function init() {
    var el = {
      days: document.getElementById("transit-days"),
      rounds: document.getElementById("transit-rounds"),
      fare: document.getElementById("transit-fare"),
      weekend: document.getElementById("transit-weekend"),
      seoul: document.getElementById("transit-seoul"),
      bike: document.getElementById("transit-bike"),
      fareBar: document.querySelector("[data-fare-bar]"),
      compare: document.getElementById("transit-compare"),
      warnings: document.getElementById("transit-warnings"),
      example: document.getElementById("transit-example-table")
    };
    if (!el.days) return;

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
    clampField(el.days, 0, 7);
    clampField(el.rounds, 0, 6);
    clampField(el.fare, 0, 10000);
    clampField(el.weekend, 0, 40);

    function render() {
      var result = Transit.compute({
        workDays: UI.toNumber(el.days, 5),
        roundTrips: UI.toNumber(el.rounds, 1),
        fare: UI.toNumber(el.fare, 1550),
        weekendTrips: UI.toNumber(el.weekend, 0),
        type: UI.radioValue("transit-type", "general"),
        bike: !!(el.bike && el.bike.checked),
        seoulArea: el.seoul ? el.seoul.checked : true
      });

      var labels = { kpass: "K-패스가 유리", climate: "기후동행카드가 유리", same: "차이 없음" };
      UI.setText("transit-better", labels[result.cheaper] || "비교 불가");
      UI.countTo("transit-saving", result.bestSaving, Core.comma);
      UI.setText(
        "transit-sub",
        "월 " + result.monthlyTrips + "회 이용 · " + result.typeLabel + " 기준"
      );

      UI.setText("transit-total", Core.won(result.totalCost));
      UI.setText("transit-refund", Core.won(result.kpassRefund));
      UI.setText("transit-kpass-pay", Core.won(result.kpassPay));
      UI.setText("transit-climate-fee", Core.won(result.climateFee));
      UI.setText("transit-climate-pay", Core.won(result.climatePay));
      UI.setText("transit-yearly", Core.won(result.yearlyBestSaving));

      if (el.compare) {
        var bestK = result.kpassPay <= result.climatePay;
        el.compare.innerHTML =
          '<tr><th scope="row">월 부담</th>' +
          '<td class="' + (bestK ? "is-best" : "") + '">' + Core.won(result.kpassPay) + "</td>" +
          '<td class="' + (!bestK ? "is-best" : "") + '">' + Core.won(result.climatePay) + "</td></tr>" +
          '<tr><th scope="row">환급·할인</th><td>' + Core.won(result.kpassRefund) + "</td><td>무제한</td></tr>" +
          '<tr><th scope="row">손익분기</th><td>' +
          (result.kpassEligible ? "월 15회 이상" : "월 15회 미달") +
          "</td><td>월 " + result.breakEvenTrips + "회</td></tr>";
      }

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

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    if (el.fareBar) {
      UI.$$("button[data-fare]", el.fareBar).forEach(function (btn) {
        btn.addEventListener("click", function () {
          el.fare.value = btn.getAttribute("data-fare");
          UI.$$("button[data-fare]", el.fareBar).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          render();
        });
      });
    }

    function renderExamples() {
      if (!el.example) return;
      var fare = 1550;
      var fee = 62000;
      var rows = [20, 30, 40, 43, 50, 60, 70];
      el.example.innerHTML = rows
        .map(function (trips) {
          var r = Transit.byTrips(trips, fare, 0.2, fee);
          var label =
            r.cheaper === "kpass"
              ? "K-패스 " + Core.won(r.diff)
              : r.cheaper === "climate"
              ? "기후동행 " + Core.won(r.diff)
              : "동일";
          return (
            "<tr><th scope=\"row\">" + trips + "회</th><td>" + Core.won(r.cost) +
            "</td><td>" + Core.won(r.kpassPay) + "</td><td>" + Core.won(r.climatePay) +
            "</td><td class=\"is-best\">" + label + "</td></tr>"
          );
        })
        .join("");
    }

    [el.days, el.rounds, el.fare, el.weekend]
      .filter(Boolean)
      .forEach(function (node) {
        node.addEventListener("change", render);
      });
    [el.seoul, el.bike].filter(Boolean).forEach(function (node) {
      node.addEventListener("change", render);
    });
    UI.$$('input[name="transit-type"]').forEach(function (r) {
      r.addEventListener("change", render);
    });
    UI.onInput([el.days, el.rounds, el.fare, el.weekend], render, 90);

    renderExamples();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
