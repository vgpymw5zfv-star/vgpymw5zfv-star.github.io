/* 연봉 실수령액 계산기 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Salary = window.DotoriSalary;
  if (!UI || !Core || !Salary) return;

  function init() {
    var el = {
      mode: document.querySelector('[data-segment="salary-mode"]'),
      severance: document.querySelector('[data-segment="salary-severance"]'),
      withhold: document.querySelector('[data-segment="salary-withhold"]'),
      amount: document.getElementById("salary-amount"),
      amountLabel: document.getElementById("salary-amount-label"),
      nontax: document.getElementById("salary-nontax"),
      nontaxBar: document.querySelector("[data-nontax-bar]"),
      dependents: document.getElementById("salary-dependents"),
      children: document.getElementById("salary-children"),
      sme: document.getElementById("salary-sme"),
      smeBlock: document.getElementById("salary-sme-block"),
      withholdTable: document.getElementById("salary-withhold-table"),
      compareTable: document.getElementById("salary-compare-table"),
      warnings: document.getElementById("salary-warnings")
    };
    if (!el.amount) return;

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
    clampField(el.amount, 0, 1000000);
    clampField(el.nontax, 0, 2000000);

    function currentMode() {
      return UI.segmentValue(el.mode) || "annual";
    }

    function currentSeverance() {
      return UI.segmentValue(el.severance) || "separate";
    }

    function currentWithhold() {
      return Number(UI.segmentValue(el.withhold) || 100);
    }

    function readInput() {
      var mode = currentMode();
      var severance = currentSeverance();
      var amount = UI.toNumber(el.amount, 0);
      var input = {
        mode: mode,
        severance: severance,
        nonTaxableWon: UI.toNumber(el.nontax, 0),
        dependents: Number(el.dependents ? el.dependents.value : 1),
        children: Number(el.children ? el.children.value : 0),
        withholding: currentWithhold(),
        sme: !!(el.sme && el.sme.checked)
      };
      if (mode === "monthly") input.monthlyMan = amount;
      else input.annualMan = amount;
      return input;
    }

    /* 입력 기준(연봉 ↔ 월급)을 바꾸면 금액을 환산해서 들고 간다 */
    UI.bindSegment(el.mode, function (value) {
      var amount = UI.toNumber(el.amount, 0);
      if (value === "monthly") {
        var divisor = currentSeverance() === "included" ? 13 : 12;
        var monthly = (amount * 10000) / divisor / 10000;
        el.amount.value = String(Math.round(monthly * 10) / 10);
        el.amount.max = "100000";
        el.amountLabel.innerHTML = "월급 <small>세전 · 비과세 포함</small>";
      } else {
        el.amount.value = String(Math.round(amount * 12));
        el.amount.max = "1000000";
        el.amountLabel.innerHTML = "연봉 <small>세전 · 계약서상 금액</small>";
      }
      render();
    });

    UI.bindSegment(el.severance, render);
    UI.bindSegment(el.withhold, render);

    if (el.nontaxBar) {
      el.nontaxBar.addEventListener("click", function (event) {
        var btn = event.target.closest("button[data-nontax]");
        if (!btn) return;
        var value = btn.getAttribute("data-nontax");
        Array.prototype.forEach.call(el.nontaxBar.querySelectorAll("button"), function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        if (value === "custom") {
          el.nontax.focus();
          el.nontax.select && el.nontax.select();
          return;
        }
        el.nontax.value = value;
        render();
      });
    }

    if (el.nontax) {
      el.nontax.addEventListener("input", function () {
        if (!el.nontaxBar) return;
        var v = String(UI.toNumber(el.nontax, 0));
        Array.prototype.forEach.call(el.nontaxBar.querySelectorAll("button"), function (b) {
          var t = b.getAttribute("data-nontax");
          b.setAttribute("aria-pressed", t === v ? "true" : "false");
        });
      });
    }

    function won(n) {
      return Core.won(n);
    }

    function render() {
      var input = readInput();
      var r = Salary.compute(input);
      var showSme = r.smeApplied;
      var heroNet = showSme ? r.smeNet : r.net;
      var heroTax = showSme ? r.smeIncomeTax : r.incomeTax;
      var heroLocal = showSme ? r.smeLocalTax : r.localTax;
      var heroDeduction = showSme ? r.smeTotalDeduction : r.deduction;

      UI.setText(
        "salary-hero-label",
        showSme ? "월 실수령액 · 중소기업 90% 감면 반영" : "월 실수령액"
      );
      UI.countTo("salary-net", heroNet, Core.comma);
      UI.setText(
        "salary-sub",
        "세전 월급 " + won(r.grossMonthly) + " · 공제 " + won(heroDeduction) +
          " (" + Math.round((heroDeduction / (r.grossMonthly || 1)) * 1000) / 10 + "%)"
      );

      var pillText;
      if (r.mode === "monthly") {
        pillText = "월급 " + Core.comma(r.grossMonthly) + "원 · 비과세 " + Core.comma(r.nonTaxableUsed) + "원";
      } else {
        pillText =
          "연봉 " + Core.comma(input.annualMan || 0) + "만원" +
          (r.severance === "included" ? " (퇴직금 포함)" : "") +
          " · 비과세 " + Core.comma(r.nonTaxableUsed) + "원";
      }
      UI.setText("salary-pill", pillText);

      UI.setText("salary-pension", won(r.pension));
      UI.setText("salary-health", won(r.health));
      UI.setText("salary-ltc", won(r.ltc));
      UI.setText("salary-employment", won(r.employment));
      UI.setText("salary-tax", won(heroTax));
      UI.setText("salary-local", won(heroLocal));
      UI.setText("salary-deduction", won(heroDeduction));
      UI.setText(
        "salary-rate",
        (Math.round((heroDeduction / (r.grossMonthly || 1)) * 1000) / 10).toFixed(1) + "%"
      );
      UI.setText("salary-net-year", won(showSme ? r.smeNetAnnual : r.netAnnual));

      if (el.smeBlock) {
        el.smeBlock.hidden = !r.smeApplied;
        if (r.smeApplied) {
          UI.setText("salary-sme-net", won(r.smeNet));
          UI.setText("salary-sme-reduction", won(r.smeReduction) + (r.smeCapped ? " (한도 도달)" : ""));
          UI.setText("salary-sme-saving", "+" + won(r.smeSaving));
          UI.setText("salary-sme-saving-year", "+" + won(r.smeSavingAnnual));
        }
      }

      /* 원천징수 비교 */
      if (el.withholdTable) {
        var rows = Salary.withholdingTable(input);
        el.withholdTable.innerHTML = rows
          .map(function (row) {
            var current = row.ratio === r.withholding;
            return (
              '<tr' + (current ? ' style="font-weight:700"' : "") + ">" +
              '<th scope="row">' + row.ratio + "%" + (current ? " (지금)" : "") + "</th>" +
              "<td>" + won(row.incomeTax) + "</td>" +
              "<td>" + won(row.net) + "</td>" +
              "</tr>"
            );
          })
          .join("");
      }

      /* 연봉 구간별 비교 */
      if (el.compareTable) {
        var list = Salary.compareBySalary(input, [3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 9000, 10000]);
        el.compareTable.innerHTML = list
          .map(function (row) {
            var current =
              r.mode === "annual" && Number(input.annualMan) === row.annualMan;
            return (
              '<tr' + (current ? ' style="font-weight:700;background:var(--blue-wash,#F3F8FF)"' : "") + ">" +
              '<th scope="row">' + Core.comma(row.annualMan) + "만원" + (current ? " · 지금" : "") + "</th>" +
              "<td>" + won(row.grossMonthly) + "</td>" +
              "<td>" + won(row.net) + "</td>" +
              "<td>" + won(row.netAnnual) + "</td>" +
              "<td>" + (Math.round(row.deductionRate * 1000) / 10).toFixed(1) + "%</td>" +
              "</tr>"
            );
          })
          .join("");
      }

      /* 경고 · 안내 */
      if (el.warnings) {
        var warns = [];
        if (r.grossMonthly <= 0) {
          warns.push("연봉(월급)이 0이라 계산할 금액이 없습니다. 금액을 입력해 주세요.");
        }
        if (r.nonTaxableInput > r.nonTaxableUsed && r.grossMonthly > 0) {
          warns.push(
            "비과세액이 월급보다 커서 월급 전체(" + won(r.nonTaxableUsed) + ")만 비과세로 처리했습니다."
          );
        }
        if (r.pensionBase >= Salary.CONST.PENSION_MAX_BASE && r.grossMonthly > 0) {
          warns.push(
            "국민연금은 기준소득월액 상한 659만원이 적용되어, 그 이상 소득은 보험료가 늘지 않습니다."
          );
        }
        if (r.health >= Salary.CONST.HEALTH_MAX) {
          warns.push("건강보험료는 근로자 부담 상한(월 459만 1,740원)이 적용되었습니다.");
        }
        if (r.smeApplied && r.smeCapped) {
          warns.push(
            "중소기업 감면은 소득세 기준 연 200만원 한도라, 월 감면액이 16만 6,660원에서 멈췄습니다."
          );
        }
        if (r.children > 0 && r.children > r.dependents - 1) {
          warns.push(
            "자녀 수가 부양가족 수(본인 제외 " + (r.dependents - 1) + "명)보다 많습니다. 부양가족 수를 자녀와 배우자를 포함해 다시 확인해 주세요."
          );
        }
        if (r.withholding === 80) {
          warns.push("원천징수 80%는 연말정산에서 더 낼 수 있는 선택입니다. 매달 실수령은 늘지만 총부담은 같습니다.");
        } else if (r.withholding === 120) {
          warns.push("원천징수 120%는 미리 더 내고 연말정산에서 돌려받는 선택입니다. 매달 실수령은 줄어듭니다.");
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

    UI.onInput([el.amount, el.nontax, el.dependents, el.children, el.sme], render, 60);
    if (el.sme) el.sme.addEventListener("change", render);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
