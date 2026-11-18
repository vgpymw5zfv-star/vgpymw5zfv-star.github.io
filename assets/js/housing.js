/* ==========================================================================
   도토리 툴즈 — 전세 vs 월세 주거비 손익분기 계산기 (세액공제 포함)
   근거
   - 조세특례제한법 §95의2 월세액 세액공제
     총급여 5,500만원 이하 17% / 5,500만~8,000만원 이하 15% / 초과 미해당
     공제대상 월세액 연 1,000만원 한도, 무주택 세대주
   - 주택임대차보호법 §7조의2·시행령 §9 전월세 전환율
     월세 = (전세보증금 − 월세보증금) × 전환율 ÷ 12
     법정 상한 = 연 10%와 한국은행 기준금리 + 2%p 중 낮은 비율
   - 전세대출은 만기일시(이자만 납부) 가정, 보증료·인상·세금은 제외
   단위: 입력은 만원, 내부 계산은 원.
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriHousing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var C = {
    /* 월세 세액공제 */
    RENT_CREDIT_RATE_LOW: 0.17,
    RENT_CREDIT_RATE_MID: 0.15,
    RENT_CREDIT_CAP_YEAR: 10000000,
    LOCAL_TAX_RATE: 0.1,
    /* 기본 기회비용 수익률 (연 %) */
    DEFAULT_RETURN: 3.5,
    DEFAULT_LOAN_RATE: 4.0,
    MONTHS: 24,
    /* 전환율 시뮬레이션 구간 */
    CONVERSION_RATES: [3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5]
  };

  function manToWon(v) {
    return Math.round((v || 0) * 10000);
  }

  function creditRate(band) {
    if (band === "low") return C.RENT_CREDIT_RATE_LOW;
    if (band === "mid") return C.RENT_CREDIT_RATE_MID;
    return 0;
  }

  /**
   * @param {object} input
   *  jeonseDepositMan 전세 보증금 (만원)
   *  jeonseLoanMan    전세대출 (만원)
   *  loanRatePercent  대출 금리 (연 %)
   *  wolseDepositMan  월세 보증금 (만원)
   *  wolseLoanMan     월세 보증금 대출 (만원)
   *  wolseMan         월세 (만원/월)
   *  maintDiffMan     관리비 차이 (월세 − 전세, 만원/월)
   *  returnPercent    자기자본 기회비용 수익률 (연 %)
   *  salaryBand       "low" | "mid" | "none"
   */
  function compute(input) {
    var opts = input || {};
    var jDepositMan = Core.num(opts.jeonseDepositMan, 30000, 0, 2000000);
    var jLoanMan = Core.clamp(Core.num(opts.jeonseLoanMan, 0, 0, 2000000), 0, jDepositMan);
    var loanRate = Core.clamp(Core.num(opts.loanRatePercent, C.DEFAULT_LOAN_RATE, 0, 30), 0, 30);
    var wDepositMan = Core.num(opts.wolseDepositMan, 3000, 0, 2000000);
    var wLoanMan = Core.clamp(Core.num(opts.wolseLoanMan, 0, 0, 2000000), 0, wDepositMan);
    var wolseMan = Core.num(opts.wolseMan, 60, 0, 5000);
    var maintDiffMan = Core.num(opts.maintDiffMan, 0, -500, 500);
    var returnPct = Core.clamp(Core.num(opts.returnPercent, C.DEFAULT_RETURN, 0, 30), 0, 30);
    var band = opts.salaryBand === "low" || opts.salaryBand === "mid" ? opts.salaryBand : "none";

    var jDeposit = manToWon(jDepositMan);
    var jLoan = manToWon(jLoanMan);
    var wDeposit = manToWon(wDepositMan);
    var wLoan = manToWon(wLoanMan);
    var wolseWon = manToWon(wolseMan);
    var maintDiffWon = manToWon(maintDiffMan);

    var monthlyRate = loanRate / 100 / 12;
    var returnMonthly = returnPct / 100 / 12;

    /* ---- 전세: 대출이자 + 자기자본 기회비용 ---- */
    var jEquity = Math.max(0, jDeposit - jLoan);
    var jInterest = Math.round(jLoan * monthlyRate);
    var jOpp = Math.round(jEquity * returnMonthly);
    var jCost = jInterest + jOpp;

    /* ---- 월세: 대출이자 + 보증금 기회비용 + 월세 + 관리비 차이 − 세액공제 ---- */
    var wEquity = Math.max(0, wDeposit - wLoan);
    var wInterest = Math.round(wLoan * monthlyRate);
    var wOpp = Math.round(wEquity * returnMonthly);
    var rate = creditRate(band);
    var creditCapMonthly = C.RENT_CREDIT_CAP_YEAR / 12;
    var creditableRent = Math.min(wolseWon, creditCapMonthly);
    var creditTax = Math.round(creditableRent * rate);
    var creditLocal = Math.round(creditTax * C.LOCAL_TAX_RATE);
    var creditMonthly = creditTax + creditLocal; /* 세액공제 + 지방소득세 감소분 */
    var wCost = wInterest + wOpp + wolseWon + maintDiffWon - creditMonthly;

    /* ---- 비교 ---- */
    var diff = jCost - wCost; /* > 0 이면 월세가 유리 */
    var winner = diff > 0 ? "wolse" : diff < 0 ? "jeonse" : "same";
    var gap = Math.abs(diff);

    /* ---- 손익분기 월세 ---- */
    var sideCost = wInterest + wOpp + maintDiffWon; /* 월세 변동과 무관한 부분 */
    var breakEvenWolse = solveBreakEven(jCost, sideCost, rate);
    if (!isFinite(breakEvenWolse) || breakEvenWolse < 0) breakEvenWolse = 0;

    /* ---- 전환율 시뮬레이션 ---- */
    var depositGap = Math.max(0, jDeposit - wDeposit);
    var conversion = C.CONVERSION_RATES.map(function (pct) {
      var convertedWolse = Math.round((depositGap * (pct / 100)) / 12);
      var verdict = convertedWolse <= breakEvenWolse ? "wolse" : "jeonse";
      return {
        rate: pct,
        convertedWolse: convertedWolse,
        verdict: verdict,
        gap: Math.abs(breakEvenWolse - convertedWolse)
      };
    });

    var breakEvenRate = depositGap > 0 ? (breakEvenWolse * 12) / depositGap * 100 : null;

    return {
      /* 입력 */
      jeonseDepositMan: jDepositMan,
      jeonseLoanMan: jLoanMan,
      wolseDepositMan: wDepositMan,
      wolseLoanMan: wLoanMan,
      wolseMan: wolseMan,
      maintDiffMan: maintDiffMan,
      loanRatePercent: loanRate,
      returnPercent: returnPct,
      salaryBand: band,
      creditRate: rate,
      depositGapWon: depositGap,
      /* 전세 */
      jeonseEquity: jEquity,
      jeonseInterest: jInterest,
      jeonseOpp: jOpp,
      jeonseCost: jCost,
      /* 월세 */
      wolseEquity: wEquity,
      wolseInterest: wInterest,
      wolseOpp: wOpp,
      creditMonthly: creditMonthly,
      creditAnnual: creditMonthly * 12,
      creditCapped: wolseWon > creditCapMonthly,
      wolseCost: wCost,
      /* 비교 */
      diff: diff,
      gap: gap,
      winner: winner,
      monthGap: gap,
      total24: gap * C.MONTHS,
      jeonse24: jCost * C.MONTHS,
      wolse24: wCost * C.MONTHS,
      months: C.MONTHS,
      /* 손익분기 */
      breakEvenWolse: Math.round(breakEvenWolse),
      breakEvenRate: breakEvenRate,
      /* 현재 월세가 손익분기 대비 얼마나 낮은지 */
      belowBreakEvenGap: breakEvenWolse - wolseWon,
      conversion: conversion
    };
  }

  /**
   * 월세 비용 = sideCost + R − (min(R, cap) × rate × 1.1)
   * 이 값이 전세 비용과 같아지는 R을 구합니다. (구간별 1차식)
   */
  function solveBreakEven(targetCost, sideCost, rate) {
    var cap = C.RENT_CREDIT_CAP_YEAR / 12;
    var slope = rate * (1 + C.LOCAL_TAX_RATE);
    var need = targetCost - sideCost;
    if (need <= 0) return 0;

    /* R ≤ cap 구간 */
    var r1 = need / (1 - slope);
    if (r1 <= cap) return r1;

    /* R > cap 구간 (공제 상한 고정) */
    return need + cap * slope;
  }

  /** 두 조건의 월 주거비만 비교 (간단 조회용) */
  function monthlyCost(input) {
    var r = compute(input);
    return { jeonse: r.jeonseCost, wolse: r.wolseCost, diff: r.diff, winner: r.winner };
  }

  return {
    CONST: C,
    compute: compute,
    monthlyCost: monthlyCost,
    creditRate: creditRate
  };
});
