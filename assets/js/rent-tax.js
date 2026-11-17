/* ==========================================================================
   월세 세액공제 vs 현금영수증 소득공제 비교 · 5년 경정청구 계산기
   근거: 조세특례제한법 §95의2, 소득세법 §52·§59의2, 국세기본법 §45조의2
   - 월세 세액공제: 총급여 5,500만원 이하 17%, 5,500만~8,000만원 이하 15%
     (연 1,000만원 한도) · 무주택 세대주 · 기준시가 4억원 이하 또는 85㎡ 이하
   - 현금영수증 소득공제: 월세액의 30% 소득공제
     (공제 한도 총급여 7,000만원 이하 300만원, 초과 250만원)
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriRent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var C = Core.CONST;

  function creditRate(salaryMan) {
    if (salaryMan <= 5500) return 0.17;
    if (salaryMan <= 8000) return 0.15;
    return 0;
  }

  function cashReceiptLimit(salaryMan) {
    return salaryMan <= 7000 ? 300 : 250; /* 만원 */
  }

  /**
   * @param {object} input
   *  salaryMan  총급여 (만원)
   *  rentMan    월세 (만원)
   *  months     연 납부 개월 수 (1~12)
   *  householder 무주택 세대주 여부
   *  housingOk  기준시가 4억 이하 또는 국민주택규모(85㎡) 이하 여부
   *  years      경정청구 연수 (1~5)
   */
  function compute(input) {
    var opts = input || {};
    var salary = Core.num(opts.salaryMan, 4000, 0, 100000);
    var rent = Core.num(opts.rentMan, 60, 0, 1000);
    var months = Core.clamp(Math.round(Core.num(opts.months, 12, 0, 12)), 0, 12);
    var householder = opts.householder === undefined ? true : !!opts.householder;
    var housingOk = opts.housingOk === undefined ? true : !!opts.housingOk;
    var years = Core.clamp(Math.round(Core.num(opts.years, 5, 1, 5)), 1, 5);

    var annualRentMan = rent * months;
    var annualRentWon = Math.round(annualRentMan * 10000);
    var estimate = Core.estimateIncomeTax(salary);
    var rate = creditRate(salary);

    /* ---- 1) 월세 세액공제 ---- */
    var creditBaseMan = Math.min(annualRentMan, C.RENT_CREDIT_CAP);
    var creditEligible = rentalCheck(householder, housingOk, rate, annualRentMan);
    var creditTaxMan = creditEligible ? creditBaseMan * rate : 0;
    var creditTaxWon = Math.round(creditTaxMan * 10000);
    var creditLocalWon = Math.round(creditTaxWon * C.LOCAL_TAX_RATE);
    var creditTotalWon = creditTaxWon + creditLocalWon;

    var creditReasons = [];
    if (!householder) {
      creditReasons.push("무주택 세대주만 월세 세액공제를 받을 수 있습니다(세대원 불가).");
    }
    if (rate === 0) {
      creditReasons.push(
        "총급여가 8,000만원을 넘어 월세 세액공제 대상이 아닙니다(현금영수증 소득공제는 가능)."
      );
    }
    if (!housingOk) {
      creditReasons.push(
        "기준시가 4억원 초과이면서 국민주택규모(85㎡)를 넘는 주택은 월세 세액공제 대상이 아닙니다."
      );
    }
    if (annualRentMan <= 0) {
      creditReasons.push("월세 납부 내역이 없습니다.");
    }

    /* ---- 2) 현금영수증 소득공제 ---- */
    var cashLimitMan = cashReceiptLimit(salary);
    var deductionMan = Math.min(annualRentMan * 0.3, cashLimitMan);
    var cashSaving = Core.deductionSaving(deductionMan, salary); /* 만원 */
    var cashTaxWon = Math.round(cashSaving.taxSaving * 10000);
    var cashLocalWon = Math.round(cashSaving.localSaving * 10000);
    var cashTotalWon = cashTaxWon + cashLocalWon;

    /* ---- 3) 비교 ---- */
    var better = "credit";
    var betterWon = creditTotalWon;
    var diff = creditTotalWon - cashTotalWon;

    if (cashTotalWon > creditTotalWon) {
      better = "cash";
      betterWon = cashTotalWon;
    } else if (creditTotalWon === cashTotalWon) {
      better = "same";
    }

    if (!creditEligible) better = "cash";

    /* 5년 경정청구 */
    var totalRefund = betterWon * years;
    var credit5 = creditTotalWon * years;
    var cash5 = cashTotalWon * years;

    return {
      salaryMan: salary,
      rentMan: rent,
      months: months,
      annualRentMan: annualRentMan,
      annualRentWon: annualRentWon,
      estimate: estimate,
      /* 세액공제 */
      creditRate: rate,
      creditBaseMan: creditBaseMan,
      creditEligible: creditEligible,
      creditReasons: creditReasons,
      creditTaxWon: creditTaxWon,
      creditLocalWon: creditLocalWon,
      creditTotalWon: creditTotalWon,
      /* 현금영수증 */
      cashLimitMan: cashLimitMan,
      deductionMan: deductionMan,
      cashTaxWon: cashTaxWon,
      cashLocalWon: cashLocalWon,
      cashTotalWon: cashTotalWon,
      cashMarginalRate: cashSaving.taxSaving / (deductionMan || 1),
      /* 비교 */
      better: better,
      betterWon: betterWon,
      diffMonthlyWon: diff,
      years: years,
      credit5: credit5,
      cash5: cash5,
      totalRefund: totalRefund
    };
  }

  function rentalCheck(householder, housingOk, rate, annualRentMan) {
    return !!householder && !!housingOk && rate > 0 && annualRentMan > 0;
  }

  return { compute: compute, creditRate: creditRate, cashReceiptLimit: cashReceiptLimit };
});
