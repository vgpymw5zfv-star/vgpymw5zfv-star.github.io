/* 월세 세액공제 비교 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Rent = window.DotoriRent;
  if (!UI || !Core || !Rent) return;

  function init() {
    var el = {
      salary: document.getElementById("rent-salary"),
      rent: document.getElementById("rent-rent"),
      months: document.getElementById("rent-months"),
      years: document.getElementById("rent-years"),
      householder: document.getElementById("rent-householder"),
      housing: document.getElementById("rent-housing"),
      compare: document.getElementById("rent-compare"),
      warnings: document.getElementById("rent-warnings"),
      example: document.getElementById("rent-example-table")
    };
    if (!el.salary) return;

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
    clampField(el.rent, 0, 1000);
    clampField(el.months, 0, 12);

    function render() {
      var result = Rent.compute({
        salaryMan: UI.toNumber(el.salary, 4000),
        rentMan: UI.toNumber(el.rent, 0),
        months: UI.toNumber(el.months, 12),
        householder: el.householder ? el.householder.checked : true,
        housingOk: el.housing ? el.housing.checked : true,
        years: Number(el.years.value || 5)
      });

      var labels = {
        credit: "월세 세액공제가 유리",
        cash: "현금영수증 소득공제가 유리",
        same: "두 방식이 동일"
      };
      UI.setText("rent-better", labels[result.better] || "비교 불가");
      UI.countTo("rent-saving", result.betterWon, Core.comma);
      UI.setText(
        "rent-sub",
        "연 월세 " + Core.manLabel(result.annualRentMan) +
          " · 총급여 " + Core.comma(result.salaryMan) + "만원" +
          (result.creditEligible
            ? " · " + Math.round(result.creditRate * 100) + "% 적용"
            : " · 세액공제 요건 미충족")
      );

      UI.setText("rent-credit", Core.won(result.creditTotalWon));
      UI.setText("rent-cash", Core.won(result.cashTotalWon));
      UI.setText("rent-diff", Core.won(Math.abs(result.diffMonthlyWon)));
      UI.setText("rent-base", Core.manLabel(result.creditBaseMan));
      UI.setText("rent-total5", Core.won(result.totalRefund));

      if (el.compare) {
        var creditBest = result.better === "credit";
        el.compare.innerHTML =
          '<tr><th scope="row">1년 절세</th>' +
          '<td class="' + (creditBest ? "is-best" : "") + '">' + Core.won(result.creditTotalWon) + "</td>" +
          '<td class="' + (!creditBest ? "is-best" : "") + '">' + Core.won(result.cashTotalWon) + "</td></tr>" +
          '<tr><th scope="row">공제율</th><td>' +
          (result.creditRate > 0 ? Math.round(result.creditRate * 100) + "%" : "-") +
          "</td><td>30% 소득공제</td></tr>" +
          '<tr><th scope="row">' + result.years + "년 합계</th><td>" +
          Core.won(result.credit5) + "</td><td>" + Core.won(result.cash5) + "</td></tr>";
      }

      if (el.warnings) {
        var warns = result.creditReasons.slice();
        if (result.better === "cash" && result.cashTotalWon > 0) {
          warns.push(
            "월세 세액공제가 불가능한 조건이라 현금영수증 소득공제(" +
              Core.won(result.cashTotalWon) +
              ")를 기준으로 계산했습니다."
          );
        }
        if (result.annualRentMan > 1000) {
          warns.push(
            "월세 세액공제는 연 1,000만원까지만 공제됩니다. 초과분 " +
              Core.manLabel(result.annualRentMan - 1000) +
              "은 계산에서 제외했습니다."
          );
        }
        el.warnings.innerHTML = warns
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

    function renderExamples() {
      if (!el.example) return;
      var salaries = [3000, 4000, 5500, 6500, 7500, 9000];
      el.example.innerHTML = salaries
        .map(function (s) {
          var r = Rent.compute({
            salaryMan: s,
            rentMan: 60,
            months: 12,
            householder: true,
            housingOk: true,
            years: 5
          });
          var label = r.creditEligible ? "세액공제" : "현금영수증";
          return (
            "<tr><th scope=\"row\">" + Core.comma(s) + "만원</th><td>" +
            Core.won(r.creditTotalWon) + "</td><td>" + Core.won(r.cashTotalWon) +
            "</td><td class=\"is-best is-center\">" + label + "</td></tr>"
          );
        })
        .join("");
    }

    [el.salary, el.rent, el.months, el.years, el.householder, el.housing]
      .filter(Boolean)
      .forEach(function (node) {
        node.addEventListener("change", render);
      });
    UI.onInput([el.salary, el.rent, el.months], render, 90);

    renderExamples();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
