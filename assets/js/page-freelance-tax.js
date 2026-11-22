/* 프리랜서 3.3% 원천징수 계산기 — 페이지 연결
   - 사업소득 3.3% / 기타소득 8.8% 전환
   - 세전 → 실수령, 받을 금액 → 세전 역산
   - 연간 수입·업종 경비율로 5월 종합소득세 간이 추정
*/
(function () {
  "use strict";

  var F = window.DotoriFreelance;
  var UI = window.DotoriUI;
  if (!F || !UI) return;

  function $id(id) {
    return document.getElementById(id);
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
      type: $id("ft-type"),
      mode: $id("ft-mode"),
      amount: $id("ft-amount"),
      amountLabel: $id("ft-amount-label"),
      amountHelp: $id("ft-amount-help"),
      quick: $id("ft-quick"),
      reset: $id("ft-reset"),
      copy: $id("ft-copy"),
      status: $id("ft-status"),
      resultLabel: $id("ft-result-label"),
      value: $id("ft-value"),
      sub: $id("ft-sub"),
      gross: $id("ft-gross"),
      expenseRow: $id("ft-expense-row"),
      expense: $id("ft-expense"),
      incomeRow: $id("ft-income-row"),
      income: $id("ft-income"),
      taxRate: $id("ft-tax-rate"),
      tax: $id("ft-tax"),
      local: $id("ft-local"),
      withheld: $id("ft-withheld"),
      net: $id("ft-net"),
      rate: $id("ft-rate"),
      roundRow: $id("ft-round-row"),
      round: $id("ft-round"),
      note: $id("ft-note"),
      anGross: $id("ft-an-gross"),
      anJob: $id("ft-an-job"),
      anDeps: $id("ft-an-deps"),
      anDirect: $id("ft-an-direct"),
      anBase: $id("ft-an-base"),
      anOver: $id("ft-an-over"),
      anGrossOut: $id("ft-an-gross-out"),
      anRateOut: $id("ft-an-rate-out"),
      anExpense: $id("ft-an-expense"),
      anIncome: $id("ft-an-income"),
      anDeduction: $id("ft-an-deduction"),
      anTaxable: $id("ft-an-taxable"),
      anTax: $id("ft-an-tax"),
      anLocal: $id("ft-an-local"),
      anPrepaid: $id("ft-an-prepaid"),
      anDiff: $id("ft-an-diff"),
      anDiffLabel: $id("ft-an-diff-label") || $id("ff-an-diff-label"),
      anMarginal: $id("ft-an-marginal")
    };

    if (!el.amount) return;

    var last = null;

    function typeValue() {
      return (UI.segmentValue(el.type) || "business") === "other" ? "other" : "business";
    }

    function modeValue() {
      return (UI.segmentValue(el.mode) || "gross") === "net" ? "net" : "gross";
    }

    function anRates() {
      var job = el.anJob ? el.anJob.value : "4";
      if (job === "direct") {
        return {
          base: F.num(el.anBase && el.anBase.value, 58.4),
          over: F.num(el.anOver && el.anOver.value, 41.8)
        };
      }
      var preset = F.JOB_PRESETS[Number(job)] || F.JOB_PRESETS[4];
      return { base: preset.base, over: preset.over };
    }

    function paintAnnual() {
      if (!el.anGross) return;
      var rates = anRates();
      var deps = el.anDeps ? Number(el.anDeps.value) || 1 : 1;
      var gross = F.num(el.anGross.value, 0);
      var a = F.annualSettle({
        gross: gross,
        baseRate: rates.base,
        overRate: rates.over,
        dependents: deps
      });

      if (el.anDirect) el.anDirect.hidden = !(el.anJob && el.anJob.value === "direct");

      setText(el.anGrossOut, gross > 0 ? F.won(a.gross) : "—");
      setText(
        el.anRateOut,
        gross > 0
          ? rates.base.toFixed(1) + "%" + (a.over > 0 ? " + 초과분 " + rates.over.toFixed(1) + "%" : "")
          : "—"
      );
      setText(el.anExpense, gross > 0 ? F.won(a.expense) : "—");
      setText(el.anIncome, gross > 0 ? F.won(a.income) : "—");
      setText(el.anDeduction, gross > 0 ? F.won(a.deduction) : "—");
      setText(el.anTaxable, gross > 0 ? F.won(a.taxable) : "—");
      setText(el.anTax, gross > 0 ? F.won(a.computedTax) : "—");
      setText(
        el.anMarginal,
        gross > 0 ? "한계 " + (a.marginalRate * 100).toFixed(0) + "%" : "—"
      );
      setText(el.anLocal, gross > 0 ? F.won(a.localTax) : "—");
      setText(el.anPrepaid, gross > 0 ? F.won(a.prepaid) : "—");

      if (gross <= 0) {
        setText(el.anDiff, "—");
        return;
      }
      if (a.diff >= 0) {
        setText(el.anDiffLabel, "5월 추가 납부 (추정)");
        setText(el.anDiff, F.won(a.diff));
      } else {
        setText(el.anDiffLabel, "5월 환급 예상 (추정)");
        setText(el.anDiff, F.won(-a.diff));
      }
      lastAnnual = a;
    }

    var lastAnnual = null;

    function paint() {
      var type = typeValue();
      var mode = modeValue();
      var input = F.num(el.amount.value, 0);

      if (el.amountLabel) setText(el.amountLabel, mode === "net" ? "받고 싶은 금액" : "세전 지급액");
      if (el.amountHelp) {
        el.amountHelp.textContent =
          mode === "net"
            ? "통장에 이만큼 들어오게 하려면 계약서에 얼마를 적어야 하는지 계산합니다."
            : "계약서·견적서에 적힌 금액을 그대로 넣으세요.";
      }

      if (!(input > 0)) {
        setText(el.resultLabel, mode === "net" ? "필요한 세전 금액" : "실수령액");
        setText(el.value, "—");
        setText(el.sub, "금액을 넣으면 원천징수와 실수령액을 계산합니다.");
        [el.gross, el.expense, el.income, el.tax, el.local, el.withheld, el.net, el.rate, el.round].forEach(
          function (node) {
            setText(node, "—");
          }
        );
        if (el.roundRow) el.roundRow.hidden = true;
        last = null;
        return;
      }

      var gross = mode === "net" ? F.solveNet(input, type) : Math.round(input);
      var r = F.calc(gross, type);
      var isOther = type === "other";

      if (isOther) {
        if (el.expenseRow) el.expenseRow.hidden = false;
        if (el.incomeRow) el.incomeRow.hidden = false;
        setText(el.taxRate, "20%");
        setText(el.note, "일시적 인적용역 기타소득은 지급액의 60%를 필요경비로 인정하고, 남은 40%에 20%를 적용합니다. 기타소득금액이 5만원 이하(지급액 12.5만원 이하)면 0원입니다.");
      } else {
        if (el.expenseRow) el.expenseRow.hidden = true;
        if (el.incomeRow) el.incomeRow.hidden = true;
        setText(el.taxRate, "3%");
        setText(el.note, "소득세 3%와 그 10%인 지방소득세 0.3%를 합쳐 3.3%를 뗍니다. 두 세금 각각에서 10원 미만은 버립니다.");
      }

      setText(el.gross, F.won(r.gross));
      setText(el.expense, F.won(r.expense));
      setText(el.income, F.won(r.income));
      setText(el.tax, F.won(r.incomeTax));
      setText(el.local, F.won(r.localTax));
      setText(el.withheld, F.won(r.withheld));
      setText(el.net, F.won(r.net));
      setText(el.rate, (r.rate * 100).toFixed(2).replace(/\.?0+$/, "") + "%");

      if (mode === "net") {
        setText(el.resultLabel, "필요한 세전 금액");
        UI.countTo(el.value, r.gross, F.won, 420);
        setText(
          el.sub,
          "실수령 " + F.won(r.net) + " · 원천징수 " + F.won(r.withheld) + " (목표 " + F.won(input) + ")"
        );
        if (el.roundRow) {
          var rounded = F.roundUpTo(r.gross, 1000);
          var rr = F.calc(rounded, type);
          el.roundRow.hidden = rounded === r.gross;
          setText(el.round, F.won(rounded) + " (실수령 " + F.won(rr.net) + ")");
        }
      } else {
        setText(el.resultLabel, "실수령액");
        UI.countTo(el.value, r.net, F.won, 420);
        setText(
          el.sub,
          "세전 " +
            F.won(r.gross) +
            " → " +
            (isOther ? "소득세 " + F.won(r.incomeTax) + " + " : "소득세 " + F.won(r.incomeTax) + " + ") +
            "지방소득세 " +
            F.won(r.localTax) +
            " = " +
            F.won(r.withheld) +
            " 공제"
        );
        if (el.roundRow) el.roundRow.hidden = true;
      }

      last = { type: type, mode: mode, result: r };
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    UI.onInput([el.amount, el.anGross, el.anBase, el.anOver], function () {
      paint();
      paintAnnual();
    }, 80);

    [el.anJob, el.anDeps].forEach(function (node) {
      if (!node) return;
      node.addEventListener("change", function () {
        paintAnnual();
      });
    });

    if (el.type) UI.bindSegment(el.type, paint);
    if (el.mode) UI.bindSegment(el.mode, paint);

    if (el.quick) {
      Array.prototype.forEach.call(el.quick.querySelectorAll("button[data-amount]"), function (btn) {
        btn.addEventListener("click", function () {
          el.amount.value = F.comma(Number(btn.getAttribute("data-amount")));
          paint();
        });
      });
    }

    if (el.reset) {
      el.reset.addEventListener("click", function () {
        el.amount.value = "1,000,000";
        if (el.anGross) el.anGross.value = "30,000,000";
        if (el.anJob) el.anJob.value = "4";
        if (el.anDeps) el.anDeps.value = "1";
        paint();
        paintAnnual();
        if (el.status) el.status.textContent = "예시 값으로 되돌렸습니다.";
      });
    }

    if (el.copy) {
      el.copy.setAttribute("data-label", el.copy.textContent);
      el.copy.addEventListener("click", function () {
        if (!last) {
          flash(el.copy, "금액 입력");
          return;
        }
        copyText(F.summary({ result: last.result, annual: lastAnnual })).then(
          function () {
            flash(el.copy, "복사 완료 ✓");
            if (el.status) el.status.textContent = "정산 내역을 클립보드에 복사했습니다.";
          },
          function () {
            flash(el.copy, "복사 실패");
            if (el.status) el.status.textContent = "복사하지 못했습니다. 화면의 숫자를 직접 옮겨 주세요.";
          }
        );
      });
    }

    paint();
    paintAnnual();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
