/* ==========================================================================
   예금 · 적금 이자 계산 코어 (DOM 의존 없음)
   - 예금(거치식): 단리 원금 × 연이율 × 개월/12 · 월복리 원금 × ((1+r/12)^n − 1)
   - 적금(적립식, 매월 초 납입): 단리 월납입 × r/12 × n(n+1)/2
                                월복리 월납입 × (1+i) × ((1+i)^n − 1) / i
   - 이자소득세 15.4% = 소득세 14% + 지방소득세(소득세의 10% = 1.4%), 각각 원 단위 절사
   Node 테스트에서 require()로 그대로 불러 쓸 수 있습니다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriDeposit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var INCOME_TAX = 0.14; // 소득세법 제129조
  var LOCAL_RATE = 0.1; // 지방소득세 = 소득세의 10% (지방세법 제103조의13)
  var GENERAL_RATE = 15.4;
  var FINANCIAL_INCOME_LIMIT = 20000000; // 금융소득종합과세 기준 2,000만원
  var PROTECTION_LIMIT = 100000000; // 예금자보호 한도 1억원 (2025.9.1~)

  function num(value, fallback, min, max) {
    var n;
    if (typeof value === "number") {
      n = value;
    } else if (typeof value === "string") {
      var cleaned = value.replace(/[,\s원개월%]/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;
      n = Number(cleaned);
    } else {
      return fallback;
    }
    if (!isFinite(n) || isNaN(n)) return fallback;
    if (typeof min === "number" && n < min) n = min;
    if (typeof max === "number" && n > max) n = max;
    return n;
  }

  function comma(n) {
    var v = typeof n === "number" && isFinite(n) ? n : 0;
    return Math.round(v).toLocaleString("ko-KR");
  }

  function won(n) {
    return comma(n) + "원";
  }

  function floorWon(v) {
    return Math.floor(v + 1e-9);
  }

  function monthsOf(value) {
    return Math.round(num(value, 12, 1, 600));
  }

  /** 예금(거치식) 세전 이자 */
  function depositInterest(principal, ratePct, months, compound) {
    var p = num(principal, 0, 0, 1e15);
    var r = num(ratePct, 0, 0, 100) / 100;
    var m = monthsOf(months);
    if (p <= 0 || r <= 0) return 0;
    if (compound) {
      var i = r / 12;
      return p * (Math.pow(1 + i, m) - 1);
    }
    return (p * r * m) / 12;
  }

  /** 적금(적립식, 매월 초 납입) 세전 이자 */
  function savingsInterest(monthly, ratePct, months, compound) {
    var a = num(monthly, 0, 0, 1e12);
    var r = num(ratePct, 0, 0, 100) / 100;
    var m = monthsOf(months);
    if (a <= 0 || r <= 0) return 0;
    var i = r / 12;
    if (compound) {
      /* 각 납입분의 만기금액 합계에서 원금(월납입 × 개월)을 뺀 이자 */
      return (a * (1 + i) * (Math.pow(1 + i, m) - 1)) / i - a * m;
    }
    return (a * i * m * (m + 1)) / 2;
  }

  /** 이자 과세 — 일반과세(15.4%) 또는 비과세(0%) */
  function taxOf(gross, taxMode) {
    var g = Math.max(0, num(gross, 0, 0, 1e16));
    if (taxMode === "none") {
      return { mode: "none", income: 0, local: 0, total: 0, net: g, rate: 0 };
    }
    var income = floorWon(g * INCOME_TAX);
    var local = floorWon(income * LOCAL_RATE);
    return {
      mode: "general",
      income: income,
      local: local,
      total: income + local,
      net: g - income - local,
      rate: GENERAL_RATE
    };
  }

  /** 한 번에 계산 */
  function calc(o) {
    var opts = o || {};
    var type = opts.type === "savings" ? "savings" : "deposit";
    var compound = opts.compound === "monthly" || opts.compound === true;
    var months = monthsOf(opts.months);
    var amount = num(opts.amount, type === "savings" ? 500000 : 10000000, 0, 1e15);
    var rate = num(opts.rate, 3, 0, 100);

    var principal = type === "savings" ? amount * months : amount;
    var gross =
      type === "savings"
        ? savingsInterest(amount, rate, months, compound)
        : depositInterest(amount, rate, months, compound);
    var tax = taxOf(gross, opts.tax === "none" ? "none" : "general");
    var maturity = principal + tax.net;
    var effective = principal > 0 ? (tax.net / principal) * (12 / months) * 100 : 0;

    // 같은 총액을 예금(거치식)에 넣었을 때와 비교
    var depositGross = depositInterest(principal, rate, months, compound);
    var depositTax = taxOf(depositGross, opts.tax === "none" ? "none" : "general");

    return {
      type: type,
      compound: compound,
      months: months,
      amount: amount,
      rate: rate,
      principal: principal,
      gross: gross,
      tax: tax,
      net: tax.net,
      maturity: maturity,
      effectiveRate: effective,
      depositGross: depositGross,
      depositNet: depositTax.net,
      depositMaturity: principal + depositTax.net,
      gap: depositTax.net - tax.net,
      financialIncomeWarning: gross > FINANCIAL_INCOME_LIMIT,
      protectionWarning: maturity > PROTECTION_LIMIT
    };
  }

  /** 요약 문구 (복사용) */
  function summary(r) {
    if (!r) return "";
    var lines = [
      (r.type === "savings" ? "[적금] 월 " + won(r.amount) : "[예금] " + won(r.amount)) +
        " · 연 " + r.rate + "% · " + r.months + "개월 · " +
        (r.compound ? "월복리" : "단리"),
      "· 총 납입 원금: " + won(r.principal),
      "· 세전 이자: " + won(r.gross),
      "· 이자소득세(" + r.tax.rate + "%): " + won(r.tax.total) +
        (r.tax.mode === "none" ? " (비과세)" : " = 소득세 " + won(r.tax.income) + " + 지방소득세 " + won(r.tax.local)),
      "· 세후 이자: " + won(r.net),
      "· 만기 수령액: " + won(r.maturity),
      "· 연 환산 실효수익률: " + r.effectiveRate.toFixed(2) + "%"
    ];
    if (r.type === "savings") {
      lines.push("· 같은 총액을 예금에 넣었다면 세후 이자 " + won(r.depositNet) + " (차이 " + won(Math.abs(r.gap)) + ")");
    }
    return lines.join("\n");
  }

  return {
    INCOME_TAX: INCOME_TAX,
    GENERAL_RATE: GENERAL_RATE,
    FINANCIAL_INCOME_LIMIT: FINANCIAL_INCOME_LIMIT,
    PROTECTION_LIMIT: PROTECTION_LIMIT,
    num: num,
    comma: comma,
    won: won,
    monthsOf: monthsOf,
    depositInterest: depositInterest,
    savingsInterest: savingsInterest,
    taxOf: taxOf,
    calc: calc,
    summary: summary
  };
});
