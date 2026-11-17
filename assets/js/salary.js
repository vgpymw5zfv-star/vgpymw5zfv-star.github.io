/* ==========================================================================
   도토리 계산기 — 2026 연봉 실수령액 계산기 (비과세 · 중소기업 감면 반영)
   근거
   - 국민연금법 §88 (2026년 보험료율 9.5%, 근로자 4.75%)
     기준소득월액 2026.7~2027.6 하한 410,000원 / 상한 6,590,000원, 천원 미만 절사
   - 국민건강보험법 시행령 §44 (2026년 7.19%, 근로자 3.595%)
     근로자 부담 보험료 상한 4,591,740원 / 하한 10,080원 (보건복지부 고시)
   - 노인장기요양보험법 시행령 §4 (보수월액의 0.9448% = 건강보험료의 13.14%)
   - 고용보험법 시행령 §12 (실업급여 1.8%, 근로자 0.9%)
   - 소득세법 §47·§55·§59의2, 소득세법 시행령 [별표 2] 근로소득 간이세액표
   - 조세특례제한법 §30 중소기업 취업자 소득세 감면 (청년 90%, 연 200만원 한도)
   모든 금액은 '원' 단위, 소득세 계산 내부만 '만원' 단위를 씁니다.
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriSalary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var C = {
    /* 근로자 부담 요율 (2026년) */
    PENSION_RATE: 0.0475,
    HEALTH_RATE: 0.03595,
    /* 장기요양 = 건강보험료 × (0.9448% ÷ 7.19%) — 13.14% 반올림 값 */
    LTC_RATE: 0.1314,
    EMPLOY_RATE: 0.009,
    LOCAL_RATE: 0.1,
    /* 국민연금 기준소득월액 상·하한 (2026.7~2027.6) */
    PENSION_MIN_BASE: 410000,
    PENSION_MAX_BASE: 6590000,
    /* 건강보험 근로자 부담 보험료 상·하한 (본인 몫) */
    HEALTH_MIN: 10080,
    HEALTH_MAX: 4591740,
    /* 기본공제 1인당 연 150만원 */
    PERSONAL_DEDUCTION_MAN: 150,
    MAX_DEPENDENTS: 11,
    MAX_CHILDREN: 10,
    /* 중소기업 취업자 소득세 감면 */
    SME_RATE: 0.9,
    SME_CAP_YEAR: 2000000,
    SME_CAP_MONTH: 166660,
    /* 무비과세 한도 참고값: 식대 월 20만원 */
    MEAL_NONTAX: 200000,
    /* 자녀세액공제 (연, 원) — 8~20세 자녀 수 기준 */
    CHILD_CREDIT_1: 250000,
    CHILD_CREDIT_2: 550000,
    CHILD_CREDIT_EXTRA: 400000
  };

  /* 10원 미만 절사 — 0.009 같은 요율의 부동소수 오차(26,999.999…)를 보정 */
  function floorWon(n) {
    return Math.floor((n + 1e-6) / 10) * 10;
  }

  function floorThousand(n) {
    return Math.floor(n / 1000) * 1000;
  }

  /** 자녀세액공제 연간 금액 (원) */
  function childCreditAnnual(children) {
    var n = Math.max(0, Math.round(children || 0));
    if (n <= 0) return 0;
    if (n === 1) return C.CHILD_CREDIT_1;
    if (n === 2) return C.CHILD_CREDIT_2;
    return C.CHILD_CREDIT_2 + C.CHILD_CREDIT_EXTRA * (n - 2);
  }

  /** 월 자녀세액공제 환산 (원, 10원 미만 절사) */
  function childCreditMonthly(children) {
    return floorWon(childCreditAnnual(children) / 12);
  }

  /**
   * 세전 월급(원) → 4대보험 근로자 부담
   * @param {number} taxableWon 월 과세급여(비과세 제외)
   */
  function insurances(taxableWon) {
    var base = Math.max(0, taxableWon || 0);
    if (base <= 0) {
      return {
        pension: 0,
        health: 0,
        ltc: 0,
        employment: 0,
        total: 0,
        pensionBase: 0,
        healthCapped: false,
        pensionCapped: false
      };
    }

    /* 국민연금: 기준소득월액 상·하한 적용 후 천원 미만 절사, 10원 미만 절사 */
    var rawPensionBase = floorThousand(base);
    var pensionBase = Core.clamp(rawPensionBase, C.PENSION_MIN_BASE, C.PENSION_MAX_BASE);
    var pension = floorWon(pensionBase * C.PENSION_RATE);

    /* 건강보험: 보수월액 × 3.595%, 10원 미만 절사 + 본인 부담 상·하한 */
    var healthRaw = floorWon(base * C.HEALTH_RATE);
    var health = Core.clamp(healthRaw, C.HEALTH_MIN, C.HEALTH_MAX);

    /* 장기요양: 건강보험료 × 13.14%, 10원 미만 절사 */
    var ltc = floorWon(health * C.LTC_RATE);

    /* 고용보험(실업급여): 보수 × 0.9%, 10원 미만 절사 */
    var employment = floorWon(base * C.EMPLOY_RATE);

    return {
      pension: pension,
      health: health,
      ltc: ltc,
      employment: employment,
      total: pension + health + ltc + employment,
      pensionBase: pensionBase,
      healthCapped: healthRaw !== health,
      pensionCapped: pensionBase !== rawPensionBase
    };
  }

  /**
   * 월 소득세·지방소득세 (원천징수 기준)
   * 연간 환산 → 근로소득공제 → 기본공제(부양가족) → 보험료 소득공제
   * → 산출세액 → 근로소득세액공제 → 자녀세액공제 → 1/12 → 원천징수 비율
   */
  function incomeTaxes(taxableMonthlyWon, dependents, children, insuranceTotalWon, withholding) {
    var annualTaxableMan = (Math.max(0, taxableMonthlyWon || 0) * 12) / 10000;
    var earnedDeduction = Core.earnedIncomeDeduction(annualTaxableMan);
    var earnedIncomeMan = Math.max(0, annualTaxableMan - earnedDeduction);

    var personalMan = Math.min(
      C.PERSONAL_DEDUCTION_MAN * Core.clamp(Math.round(dependents || 1), 1, C.MAX_DEPENDENTS),
      earnedIncomeMan
    );
    /* 연금보험료공제 + 건강·고용보험료(특별소득공제) — 근로자 부담분 전액 */
    var insuranceMan = Math.min(
      ((Math.max(0, insuranceTotalWon || 0) * 12) / 10000),
      Math.max(0, earnedIncomeMan - personalMan)
    );

    var baseMan = Math.max(0, earnedIncomeMan - personalMan - insuranceMan);
    var computedMan = Core.incomeTax(baseMan);
    var earnedCreditMan = Core.earnedTaxCredit(computedMan, annualTaxableMan);
    var childMan = childCreditAnnual(children) / 10000;

    var determinedMan = Math.max(0, computedMan - earnedCreditMan - childMan);
    var monthlyBase = floorWon((determinedMan * 10000) / 12);

    var ratio = Core.clamp(Math.round(withholding || 100), 80, 120) / 100;
    var incomeTax = floorWon(monthlyBase * ratio);
    var localTax = floorWon(incomeTax * C.LOCAL_RATE);

    return {
      annualTaxableMan: annualTaxableMan,
      earnedDeduction: earnedDeduction,
      earnedIncomeMan: earnedIncomeMan,
      personalMan: personalMan,
      insuranceMan: insuranceMan,
      baseMan: baseMan,
      computedMan: computedMan,
      earnedCreditMan: earnedCreditMan,
      childMan: childMan,
      determinedMan: determinedMan,
      monthlyBase: monthlyBase,
      ratio: ratio,
      incomeTax: incomeTax,
      localTax: localTax,
      total: incomeTax + localTax
    };
  }

  /**
   * @param {object} input
   *  mode           "annual" | "monthly"
   *  annualMan      연봉 (만원)
   *  monthlyMan     월급 (만원)
   *  severance      "separate" | "included" (퇴직금 포함이면 연봉÷13)
   *  nonTaxableWon  월 비과세액 (원)
   *  dependents     부양가족 수 (본인 포함, 1~11)
   *  children       8~20세 자녀 수 (0~10)
   *  withholding    80 | 100 | 120
   *  sme            중소기업 취업자 90% 감면 적용 여부
   */
  function compute(input) {
    var opts = input || {};
    var mode = opts.mode === "monthly" ? "monthly" : "annual";
    var severance = opts.severance === "included" ? "included" : "separate";
    var annualMan = Core.num(opts.annualMan, 4000, 0, 1000000);
    var monthlyMan = Core.num(opts.monthlyMan, 0, 0, 100000);
    var nonTaxable = Core.clamp(Core.num(opts.nonTaxableWon, 0, 0, 2000000), 0, 2000000);
    var dependents = Math.round(Core.num(opts.dependents, 1, 1, C.MAX_DEPENDENTS));
    var children = Math.round(Core.num(opts.children, 0, 0, C.MAX_CHILDREN));
    var withholding = Math.round(Core.num(opts.withholding, 100, 80, 120));
    var smeOn = !!opts.sme;

    var divisor = severance === "included" ? 13 : 12;
    var grossMonthly = mode === "monthly" ? monthlyMan * 10000 : (annualMan * 10000) / divisor;
    grossMonthly = Math.max(0, Math.round(grossMonthly));
    var annualGross = Math.round(grossMonthly * 12);
    var annualInputWon = mode === "monthly" ? Math.round(monthlyMan * 10000 * 12) : Math.round(annualMan * 10000);

    /* 비과세는 월급을 넘을 수 없다 */
    var nonTaxableUsed = Math.min(nonTaxable, grossMonthly);
    var taxableMonthly = Math.max(0, grossMonthly - nonTaxableUsed);

    var ins = insurances(taxableMonthly);
    var tax = incomeTaxes(taxableMonthly, dependents, children, ins.total, withholding);

    var deduction = ins.total + tax.total;
    var net = Math.max(0, grossMonthly - deduction);

    /* 중소기업 취업자 소득세 감면 (청년 90%, 월 환산 한도 166,660원) */
    var smeIncomeTax = 0;
    var smeLocalTax = 0;
    var smeReduction = 0;
    if (smeOn && tax.incomeTax > 0) {
      smeReduction = floorWon(Math.min(tax.incomeTax * C.SME_RATE, C.SME_CAP_MONTH));
      smeIncomeTax = Math.max(0, tax.incomeTax - smeReduction);
      smeLocalTax = floorWon(smeIncomeTax * C.LOCAL_RATE);
    }
    var smeTotalDeduction = ins.total + smeIncomeTax + smeLocalTax;
    var smeNet = Math.max(0, grossMonthly - smeTotalDeduction);
    var smeSaving = net === 0 ? 0 : Math.max(0, smeNet - net);

    var capped = smeReduction >= floorWon(C.SME_CAP_MONTH) - 0.5 && smeOn;

    return {
      mode: mode,
      severance: severance,
      divisor: divisor,
      grossMonthly: grossMonthly,
      annualGross: annualGross,
      annualInputWon: annualInputWon,
      nonTaxableInput: nonTaxable,
      nonTaxableUsed: nonTaxableUsed,
      taxableMonthly: taxableMonthly,
      dependents: dependents,
      children: children,
      withholding: withholding,
      /* 4대보험 */
      pension: ins.pension,
      health: ins.health,
      ltc: ins.ltc,
      employment: ins.employment,
      insuranceTotal: ins.total,
      pensionBase: ins.pensionBase,
      /* 세금 */
      incomeTax: tax.incomeTax,
      localTax: tax.localTax,
      taxTotal: tax.total,
      /* 합계 */
      deduction: deduction,
      net: net,
      netAnnual: Math.round(net * 12),
      deductionRate: grossMonthly > 0 ? deduction / grossMonthly : 0,
      netRate: grossMonthly > 0 ? net / grossMonthly : 0,
      /* 중소기업 감면 */
      smeApplied: smeOn,
      smeReduction: smeReduction,
      smeCapped: capped,
      smeIncomeTax: smeIncomeTax,
      smeLocalTax: smeLocalTax,
      smeTotalDeduction: smeTotalDeduction,
      smeNet: smeNet,
      smeNetAnnual: Math.round(smeNet * 12),
      smeSaving: smeSaving,
      smeSavingAnnual: Math.round(smeSaving * 12),
      /* 소득세 계산 상세 (설명용) */
      taxDetail: {
        annualTaxableMan: tax.annualTaxableMan,
        earnedDeduction: tax.earnedDeduction,
        earnedIncomeMan: tax.earnedIncomeMan,
        personalMan: tax.personalMan,
        insuranceMan: tax.insuranceMan,
        baseMan: tax.baseMan,
        computedMan: tax.computedMan,
        earnedCreditMan: tax.earnedCreditMan,
        childMan: tax.childMan,
        determinedMan: tax.determinedMan,
        monthlyBase: tax.monthlyBase,
        ratio: tax.ratio
      }
    };
  }

  /** 원천징수 80% / 100% / 120% 비교 */
  function withholdingTable(input) {
    var opts = input || {};
    return [80, 100, 120].map(function (ratio) {
      var copy = {};
      Object.keys(opts).forEach(function (k) {
        copy[k] = opts[k];
      });
      copy.withholding = ratio;
      var r = compute(copy);
      return {
        ratio: ratio,
        incomeTax: r.incomeTax,
        localTax: r.localTax,
        net: r.net,
        netAnnual: r.netAnnual
      };
    });
  }

  /**
   * 연봉 구간별 비교 — 같은 조건(비과세·부양가족·자녀·원천징수)을 유지하고 연봉만 바꿉니다.
   * @param {object} input compute()와 같은 입력 (mode는 연봉 기준으로 변환)
   * @param {number[]} levels 비교할 연봉(만원) 목록
   */
  function compareBySalary(input, levels) {
    var opts = input || {};
    var list = Array.isArray(levels) && levels.length ? levels : [3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000, 9000, 10000];
    return list.map(function (man) {
      var copy = {};
      Object.keys(opts).forEach(function (k) {
        copy[k] = opts[k];
      });
      copy.mode = "annual";
      copy.annualMan = man;
      if (copy.severance === "included" && man > 0) {
        /* 연봉에 퇴직금이 포함된 경우 그대로 유지 */
        copy.severance = "included";
      }
      var r = compute(copy);
      return {
        annualMan: man,
        grossMonthly: r.grossMonthly,
        net: r.net,
        netAnnual: r.netAnnual,
        deduction: r.deduction,
        deductionRate: r.deductionRate
      };
    });
  }

  return {
    CONST: C,
    compute: compute,
    insurances: insurances,
    incomeTaxes: incomeTaxes,
    childCreditAnnual: childCreditAnnual,
    childCreditMonthly: childCreditMonthly,
    withholdingTable: withholdingTable,
    compareBySalary: compareBySalary
  };
});
