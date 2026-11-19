/* 전세 vs 월세 손익분기 계산기 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Housing = window.DotoriHousing;
  if (!UI || !Core || !Housing) return;

  function init() {
    var el = {
      jDeposit: document.getElementById("housing-jdeposit"),
      jLoan: document.getElementById("housing-jloan"),
      loanRate: document.getElementById("housing-loan-rate"),
      wDeposit: document.getElementById("housing-wdeposit"),
      wLoan: document.getElementById("housing-wloan"),
      wRent: document.getElementById("housing-wrent"),
      maint: document.getElementById("housing-maint"),
      ret: document.getElementById("housing-return"),
      band: document.getElementById("housing-band"),
      ltvBar: document.querySelector("[data-ltv-bar]"),
      compare: document.getElementById("housing-compare-table"),
      conversion: document.getElementById("housing-conversion-table"),
      warnings: document.getElementById("housing-warnings")
    };
    if (!el.jDeposit) return;

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
    clampField(el.jDeposit, 0, 2000000);
    clampField(el.jLoan, 0, 2000000);
    clampField(el.wDeposit, 0, 2000000);
    clampField(el.wLoan, 0, 2000000);
    clampField(el.wRent, 0, 5000);
    clampField(el.maint, -500, 500);
    clampField(el.loanRate, 0, 30);
    clampField(el.ret, 0, 30);

    /* LTV 칩: 전세대출 금액을 보증금 대비 비율로 채운다 */
    if (el.ltvBar) {
      el.ltvBar.addEventListener("click", function (event) {
        var btn = event.target.closest("button[data-ltv]");
        if (!btn) return;
        Array.prototype.forEach.call(el.ltvBar.querySelectorAll("button"), function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        var ratio = Number(btn.getAttribute("data-ltv")) || 0;
        var deposit = UI.toNumber(el.jDeposit, 0);
        el.jLoan.value = String(Math.round((deposit * ratio) / 100));
        render();
      });
    }

    function readInput() {
      return {
        jeonseDepositMan: UI.toNumber(el.jDeposit, 0),
        jeonseLoanMan: UI.toNumber(el.jLoan, 0),
        wolseDepositMan: UI.toNumber(el.wDeposit, 0),
        wolseLoanMan: UI.toNumber(el.wLoan, 0),
        wolseMan: UI.toNumber(el.wRent, 0),
        maintDiffMan: UI.toNumber(el.maint, 0),
        loanRatePercent: UI.toNumber(el.loanRate, 0),
        returnPercent: UI.toNumber(el.ret, 0),
        salaryBand: el.band ? el.band.value : "none"
      };
    }

    function won(n) {
      return Core.won(n);
    }

    function pct(v) {
      return (Math.round(v * 100) / 100).toFixed(2) + "%";
    }

    function render() {
      var input = readInput();
      var r = Housing.compute(input);

      var winnerLabel =
        r.winner === "wolse" ? "월세가 유리" : r.winner === "jeonse" ? "전세가 유리" : "두 조건이 동일";
      UI.setText("housing-pill", "전세 " + won(r.jeonseCost) + " vs 월세 " + won(r.wolseCost));
      UI.setText(
        "housing-hero-label",
        r.winner === "same" ? "두 조건의 월 주거비가 같습니다" : winnerLabel
      );
      UI.countTo("housing-gap", r.gap, Core.comma);
      UI.setText(
        "housing-sub",
        "월 " + won(r.gap) + " 차이 · 2년(24개월) 총액 " + won(r.total24) + " 차이"
      );
      UI.setText("housing-jcost", won(r.jeonseCost));
      UI.setText("housing-wcost", won(r.wolseCost));
      UI.setText("housing-month-gap", won(r.gap) + (r.winner === "same" ? "" : r.winner === "wolse" ? " (월세 유리)" : " (전세 유리)"));
      UI.setText("housing-total24", won(r.total24) + (r.winner === "wolse" ? " 월세 유리" : r.winner === "jeonse" ? " 전세 유리" : ""));
      UI.setText("housing-breakeven", won(r.breakEvenWolse));
      UI.setText(
        "housing-breakeven-rate",
        r.breakEvenRate === null ? "-" : pct(r.breakEvenRate)
      );

      /* 항목별 비교 */
      if (el.compare) {
        el.compare.innerHTML =
          '<tr><th scope="row">대출이자</th><td>' + won(r.jeonseInterest) + "</td><td>" + won(r.wolseInterest) + "</td></tr>" +
          '<tr><th scope="row">보증금 기회비용</th><td>' + won(r.jeonseOpp) + "</td><td>" + won(r.wolseOpp) + "</td></tr>" +
          '<tr><th scope="row">월세</th><td>0원</td><td>' + won(r.wolseMan * 10000) + "</td></tr>" +
          '<tr><th scope="row">관리비 차이</th><td>0원</td><td>' + won(r.maintDiffMan * 10000) + "</td></tr>" +
          '<tr><th scope="row">세액공제 환산</th><td>0원</td><td>' +
          (r.creditMonthly > 0 ? "−" + won(r.creditMonthly) : "0원") + "</td></tr>" +
          '<tr style="font-weight:700"><th scope="row">순 월 주거비</th><td>' + won(r.jeonseCost) + "</td><td>" + won(r.wolseCost) + "</td></tr>" +
          '<tr><th scope="row">2년 총액</th><td>' + won(r.jeonse24) + "</td><td>" + won(r.wolse24) + "</td></tr>";
      }

      /* 손익분기 안내 */
      UI.setText(
        "housing-breakeven-text",
        "전세와 비용이 같아지는 월세는 " + won(r.breakEvenWolse) + "입니다. " +
          (r.breakEvenRate === null ? "" : "보증금 차액 " + Core.manLabel(r.depositGapWon / 10000) + " 기준 전환율 " + pct(r.breakEvenRate) + "에 해당합니다.")
      );
      var verdictEl = document.getElementById("housing-verdict-text");
      if (verdictEl) {
        var diffRent = r.breakEvenWolse - r.wolseMan * 10000;
        if (r.breakEvenWolse <= 0) {
          verdictEl.textContent = "현재 조건에서는 월세를 0원으로 내도 전세가 더 비쌉니다.";
          var box = document.getElementById("housing-verdict");
          if (box) box.className = "notice notice--good";
        } else if (diffRent > 0) {
          verdictEl.textContent =
            "지금 월세(" + won(r.wolseMan * 10000) + ")는 손익분기보다 " + won(diffRent) +
            " 낮아 월세가 유리합니다. 월세가 " + won(r.breakEvenWolse) + "을 넘으면 전세가 유리해집니다.";
          var box2 = document.getElementById("housing-verdict");
          if (box2) box2.className = "notice notice--good";
        } else if (diffRent < 0) {
          verdictEl.textContent =
            "지금 월세(" + won(r.wolseMan * 10000) + ")는 손익분기보다 " + won(-diffRent) +
            " 높아 전세가 유리합니다. 월세가 " + won(r.breakEvenWolse) + " 아래로 내려가면 월세가 유리해집니다.";
          var box3 = document.getElementById("housing-verdict");
          if (box3) box3.className = "notice notice--warn";
        } else {
          verdictEl.textContent = "지금 월세가 정확히 손익분기 지점입니다.";
        }
      }

      /* 전환율 시뮬레이션 */
      if (el.conversion) {
        el.conversion.innerHTML = r.conversion
          .map(function (row) {
            var diff = row.convertedWolse - r.breakEvenWolse;
            var diffText =
              diff === 0
                ? "동일"
                : (diff > 0 ? "+" : "−") + won(Math.abs(diff)) + (diff > 0 ? " 초과" : " 낮음");
            return (
              '<tr' + (row.verdict === "wolse" ? ' class="is-best" style="background:rgba(47,111,237,0.06)"' : "") + ">" +
              "<th scope=\"row\">" + row.rate.toFixed(1) + "%</th>" +
              "<td>" + won(row.convertedWolse) + "</td>" +
              "<td>" + diffText + "</td>" +
              "<td class=\"is-center\">" + (row.verdict === "wolse" ? "월세" : "전세") + "</td>" +
              "</tr>"
            );
          })
          .join("");
      }

      /* 경고 */
      if (el.warnings) {
        var warns = [];
        if (r.jeonseDepositMan <= 0) {
          warns.push("전세 보증금을 입력하면 비교가 시작됩니다.");
        }
        if (r.wolseMan <= 0 && r.creditRate > 0) {
          warns.push("월세가 0원이면 세액공제도 0원입니다(보증금만 있는 반전세).");
        }
        if (r.creditRate === 0) {
          warns.push("총급여 8,000만원 초과로 월세 세액공제는 반영하지 않았습니다. 실제 주거비 차이는 세액공제만큼 더 벌어질 수 있습니다.");
        }
        if (r.creditCapped) {
          warns.push("월세 세액공제는 연 1,000만원까지만 적용되어, 초과분은 공제 없이 계산했습니다.");
        }
        if (r.wolseLoanMan > 0 && r.returnPercent > 0) {
          warns.push("월세 보증금 대출도 같은 금리(" + r.loanRatePercent + "%)로 계산했습니다. 실제 상품 금리가 다르면 결과가 달라집니다.");
        }
        if (r.jeonseLoanMan >= r.jeonseDepositMan && r.jeonseDepositMan > 0) {
          warns.push("전세대출이 보증금 전액이라 자기자본 기회비용은 0으로 계산했습니다.");
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

    UI.onInput(
      [el.jDeposit, el.jLoan, el.loanRate, el.wDeposit, el.wLoan, el.wRent, el.maint, el.ret, el.band],
      render,
      60
    );

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
