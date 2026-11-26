/* 예금·적금 이자 계산기 — 페이지 연결
   - 예금(거치식)·적금(적립식), 단리·월복리, 일반과세 15.4%·비과세
   - 세전/세후 이자와 만기 수령액, 기간별 표, 예금↔적금 비교, 요약 복사
   코어: assets/js/deposit-interest.js (window.DotoriDeposit)
*/
(function () {
  "use strict";

  var D = window.DotoriDeposit;
  var UI = window.DotoriUI;
  if (!D || !UI) return;

  var DEFAULT = { deposit: 10000000, savings: 500000 };
  var PERIODS = [6, 12, 24, 36];

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
      type: $id("di-type"),
      compound: $id("di-compound"),
      amount: $id("di-amount"),
      amountLabel: $id("di-amount-label"),
      amountHelp: $id("di-amount-help"),
      months: $id("di-months"),
      chips: $id("di-month-chips"),
      rate: $id("di-rate"),
      tax: $id("di-tax"),
      maturity: $id("di-maturity"),
      sub: $id("di-sub"),
      principal: $id("di-principal"),
      gross: $id("di-gross"),
      taxOut: $id("di-tax-out"),
      net: $id("di-net"),
      effective: $id("di-effective"),
      note: $id("di-note"),
      warn: $id("di-warn"),
      warnText: $id("di-warn-text"),
      table: $id("di-table"),
      compare: $id("di-compare"),
      text: $id("di-text"),
      copy: $id("di-copy"),
      status: $id("di-status")
    };

    if (!el.amount) return;

    var last = null;
    var lastType = "deposit";

    function typeValue() {
      return UI.segmentValue(el.type) === "savings" ? "savings" : "deposit";
    }

    function compoundValue() {
      return UI.segmentValue(el.compound) === "monthly" ? "monthly" : "simple";
    }

    function taxValue() {
      return UI.segmentValue(el.tax) === "none" ? "none" : "general";
    }

    function options(months) {
      return {
        type: typeValue(),
        compound: compoundValue(),
        tax: taxValue(),
        amount: el.amount.value,
        rate: el.rate ? el.rate.value : 3,
        months: months || (el.months ? el.months.value : 12)
      };
    }

    function rowsHtml(body, items) {
      if (!body) return;
      body.innerHTML = items
        .map(function (it) {
          return (
            "<tr" + (it.on ? ' class="is-best"' : "") + ">" +
            '<th scope="row">' + it.head + "</th>" +
            it.cells
              .map(function (c, i) {
                return '<td data-label="' + (it.labels[i] || "") + '">' + c + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");
    }

    function paintTable(r) {
      if (el.table) {
        var body = el.table.querySelector("tbody");
        rowsHtml(
          body,
          PERIODS.map(function (m) {
            var row = D.calc({
              type: r.type,
              compound: r.compound,
              tax: r.tax.mode,
              amount: r.amount,
              rate: r.rate,
              months: m
            });
            return {
              head: m + "개월" + (m % 12 === 0 ? " (" + m / 12 + "년)" : ""),
              on: m === r.months,
              labels: ["세전 이자", "세후 이자", "만기 수령액"],
              cells: [D.won(row.gross), D.won(row.net), D.won(row.maturity)]
            };
          })
        );
      }

      if (el.compare) {
        var cbody = el.compare.querySelector("tbody");
        var same = D.calc({
          type: "deposit",
          compound: r.compound,
          tax: r.tax.mode,
          amount: r.principal,
          rate: r.rate,
          months: r.months
        });
        var monthly = r.months > 0 ? r.principal / r.months : 0;
        var savings = D.calc({
          type: "savings",
          compound: r.compound,
          tax: r.tax.mode,
          amount: monthly,
          rate: r.rate,
          months: r.months
        });
        rowsHtml(cbody, [
          {
            head: "예금 · 한 번에",
            on: r.type === "deposit",
            labels: ["세전 이자", "세후 이자", "만기 수령액"],
            cells: [D.won(same.gross), D.won(same.net), D.won(same.maturity)]
          },
          {
            head: "적금 · 매달",
            on: r.type === "savings",
            labels: ["세전 이자", "세후 이자", "만기 수령액"],
            cells: [D.won(savings.gross), D.won(savings.net), D.won(savings.maturity)]
          },
          {
            head: "차이",
            labels: ["세전 이자", "세후 이자", "만기 수령액"],
            cells: [
              D.won(same.gross - savings.gross),
              D.won(same.net - savings.net),
              D.won(same.maturity - savings.maturity)
            ]
          }
        ]);
      }
    }

    function paint() {
      var r = D.calc(options());
      last = r;

      setText(el.maturity, D.won(r.maturity));
      setText(
        el.sub,
        (r.type === "savings" ? "월 " + D.won(r.amount) + " × " + r.months + "개월 = " : "") +
          "원금 " + D.won(r.principal) + " + 세후 이자 " + D.won(r.net)
      );
      setText(el.principal, D.won(r.principal));
      setText(el.gross, D.won(r.gross));
      setText(el.taxOut, r.tax.mode === "none" ? "비과세 0원" : D.won(r.tax.total));
      setText(el.net, D.won(r.net));
      setText(el.effective, r.effectiveRate.toFixed(2) + "%");

      if (el.amountLabel) {
        setText(el.amountLabel, r.type === "savings" ? "월 납입액(원)" : "예치 원금(원)");
      }
      if (el.amountHelp) {
        el.amountHelp.textContent =
          r.type === "savings"
            ? "매달 같은 날 같은 금액을 넣는다고 가정합니다. 총 납입액은 " + D.won(r.principal) + "입니다."
            : "가입할 때 한 번에 넣는 금액입니다."
      }

      setText(
        el.note,
        r.tax.mode === "none"
          ? "비과세 상품으로 계산했습니다. 비과세종합저축은 원금 5,000만원 한도, ISA는 이자·배당 200만원까지 비과세입니다."
          : "이자소득세 " + D.won(r.tax.total) + " = 소득세 " + D.won(r.tax.income) + " + 지방소득세 " +
            D.won(r.tax.local) + ". 15.4%(소득세 14% + 지방세 1.4%)를 각각 원 단위 미만 절사해 계산했습니다."
      );

      if (el.warn) el.warn.hidden = !(r.financialIncomeWarning || r.protectionWarning);
      if (r.financialIncomeWarning) {
        setText(el.warnText, "이자만 2,000만원을 넘어 금융소득종합과세 대상입니다. 다음 해 5월 다른 소득과 합산해 신고해야 합니다.");
      } else if (r.protectionWarning) {
        setText(el.warnText, "만기 수령액이 1억원(예금자보호 한도)을 넘습니다. 금융회사를 나눠 넣으면 각각 1억원까지 보호됩니다.");
      }

      paintTable(r);

      if (el.text) el.text.value = D.summary(r);
    }

    function syncType() {
      var t = typeValue();
      if (t !== lastType) {
        var prev = DEFAULT[lastType];
        var next = DEFAULT[t];
        if (el.amount && D.num(el.amount.value, 0, 0, 1e15) === prev) {
          el.amount.value = String(next);
        }
        lastType = t;
      }
      paint();
    }

    function syncChips() {
      if (!el.chips) return;
      var current = D.monthsOf(el.months ? el.months.value : 12);
      Array.prototype.forEach.call(el.chips.querySelectorAll("button[data-months]"), function (b) {
        b.setAttribute(
          "aria-pressed",
          D.num(b.getAttribute("data-months"), 0, 0, 600) === current ? "true" : "false"
        );
      });
    }

    UI.onInput([el.amount, el.months, el.rate], function () {
      syncChips();
      paint();
    });

    if (el.type) UI.bindSegment(el.type, syncType);
    if (el.compound) UI.bindSegment(el.compound, paint);
    if (el.tax) UI.bindSegment(el.tax, paint);

    if (el.chips) {
      Array.prototype.forEach.call(el.chips.querySelectorAll("button[data-months]"), function (b) {
        b.addEventListener("click", function () {
          if (el.months) el.months.value = b.getAttribute("data-months");
          syncChips();
          paint();
        });
      });
    }

    if (el.copy) {
      el.copy.setAttribute("data-label", el.copy.textContent);
      el.copy.addEventListener("click", function () {
        if (!last) return;
        copyText(D.summary(last)).then(
          function () {
            flash(el.copy, "복사 완료 ✓");
            if (el.status) el.status.textContent = "가입 비교 요약을 클립보드에 복사했습니다.";
          },
          function () {
            flash(el.copy, "복사 실패");
            if (el.status) el.status.textContent = "복사하지 못했습니다. 화면의 숫자를 직접 옮겨 주세요.";
          }
        );
      });
    }

    syncChips();
    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
