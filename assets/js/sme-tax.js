/* ==========================================================================
   중소기업 취업자 소득세 감면 · 5년 경정청구 계산기
   근거: 조세특례제한법 §30, 소득세법 §55, 국세기본법 §45조의2
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriSme = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var CAP = Core.CONST.SME_CAP; /* 200만원 */

  var TYPES = {
    youth: { label: "청년 (만 15~34세)", rate: 0.9 },
    senior: { label: "만 60세 이상", rate: 0.7 },
    disabled: { label: "장애인", rate: 0.7 },
    career: { label: "경력단절여성", rate: 0.7 }
  };

  /**
   * @param {object} input
   *  salaryMan   총급여 (만원)
   *  taxMode     'auto' | 'manual'
   *  taxMan      결정세액 직접 입력 (만원)
   *  type        'youth' | 'senior' | 'disabled' | 'career'
   *  age         취업일 기준 만 나이
   *  militaryYears 병역 이행 기간 (0~6년)
   *  years       경정청구 가능 연수 (1~5)
   *  excluded    제외업종 해당 여부
   */
  function compute(input) {
    var opts = input || {};
    var salary = Core.num(opts.salaryMan, 4000, 0, 100000);
    var type = TYPES[opts.type] ? opts.type : "youth";
    var typeInfo = TYPES[type];
    var rate = typeInfo.rate;

    var age = Core.num(opts.age, 29, 15, 100);
    var military = Core.clamp(Core.num(opts.militaryYears, 0, 0, 6), 0, 6);
    var years = Core.clamp(Math.round(Core.num(opts.years, 5, 1, 5)), 1, 5);
    var excluded = !!opts.excluded;

    var estimate = Core.estimateIncomeTax(salary);
    var taxMode = opts.taxMode === "manual" ? "manual" : "auto";
    var determinedMan =
      taxMode === "manual"
        ? Core.num(opts.taxMan, estimate.determined, 0, 100000)
        : estimate.determined;
    var determinedWon = Math.round(determinedMan * 10000);

    /* ---- 대상 판정 ---- */
    var youthAge = age - military; /* 병역기간 차감(최대 6년) */
    var warnings = [];
    var eligible = true;
    var verdict = "";

    if (excluded) {
      eligible = false;
      verdict = "제외업종에 해당해 감면을 받을 수 없습니다.";
      warnings.push(
        "전문직·금융보험업 등은 감면 제외 업종입니다. 2025년 2월 28일 이후 취업자부터는 통관업·가상자산 매매·중개업·수의업·부동산임대업도 제외됩니다."
      );
    } else if (type === "youth") {
      if (!(youthAge <= 34 && age >= 15)) {
        eligible = false;
        verdict = "청년 요건(만 15~34세)을 충족하지 않습니다.";
        warnings.push(
          "병역 이행 기간(최대 6년)을 차감한 나이가 만 34세 이하여야 청년 90% 감면 대상입니다. 만 60세 이상·장애인·경력단절여성은 70% 감면으로 신청할 수 있습니다."
        );
      } else {
        verdict = "청년 90% 감면 대상입니다.";
      }
    } else if (type === "senior" && age < 60) {
      eligible = false;
      verdict = "만 60세 이상 요건을 충족하지 않습니다.";
      warnings.push(
        "고령자 감면은 취업일 기준 만 60세 이상이어야 합니다. 청년(만 15~34세)이면 90% 감면 대상입니다."
      );
    } else {
      verdict = typeInfo.label + " 70% 감면 대상입니다.";
    }


    /* ---- 1년 절세액 (소득세 감면 + 지방소득세 10%) ---- */
    var grossSaving = eligible ? determinedWon * rate : 0;
    var cappedSaving = Math.min(grossSaving, CAP);
    var capHit = eligible && grossSaving > CAP + 0.5;
    var localSaving = Math.round(cappedSaving * 0.1);
    var yearTotal = Math.round(cappedSaving + localSaving);

    var afterTax = Math.max(0, determinedWon - Math.round(cappedSaving));

    if (eligible && determinedWon <= 0) {
      warnings.push(
        "결정세액이 0원이면 감면할 소득세가 없어 환급액도 0원입니다. 공제·감면을 많이 받아 낼 세금이 없는 경우입니다."
      );
      verdict = "감면 대상이지만 돌려받을 세금이 없습니다.";
    }

    /* ---- 5년 소급 (연도별 총급여 동일 가정) ---- */
    var yearsApplied = eligible ? years : 0;
    var totalRefund = yearTotal * yearsApplied;

    /* 연도별 표 */
    var byYear = [];
    for (var i = 1; i <= 5; i += 1) {
      byYear.push({
        year: i,
        applied: i <= yearsApplied,
        tax: i <= yearsApplied ? Math.round(cappedSaving) : 0,
        local: i <= yearsApplied ? localSaving : 0,
        total: i <= yearsApplied ? yearTotal : 0
      });
    }

    return {
      eligible: eligible,
      verdict: verdict,
      warnings: warnings,
      rate: rate,
      typeLabel: typeInfo.label,
      youthAge: youthAge,
      military: military,
      age: age,
      salaryMan: salary,
      taxMode: taxMode,
      determinedMan: determinedMan,
      determinedWon: determinedWon,
      estimatedDeterminedMan: estimate.determined,
      estimate: estimate,
      taxSaving: Math.round(cappedSaving),
      localSaving: localSaving,
      yearTotal: yearTotal,
      afterTax: afterTax,
      capHit: capHit,
      cap: CAP,
      years: yearsApplied,
      totalRefund: totalRefund,
      byYear: byYear
    };
  }

  return { compute: compute, TYPES: TYPES, CAP: CAP };
});
