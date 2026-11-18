/* ==========================================================================
   2026 실업급여(구직급여) 계산기 (순수 계산 코어, DOM 비의존)
   근거
   - 고용보험법 §45~§50, 시행령 §68 — 1일 구직급여 = 평균임금의 60%, 상한·하한 적용
   - 고용노동부 2025.10.2 입법예고 → 2026.1.1 시행: 1일 상한액 68,100원
     (기초임금일액 상한 113,500원 × 60%)
   - 하한액: 2026년 최저임금 10,320원 × 80% × 1일 소정근로시간 (8시간 = 66,048원)
   - 소정급여일수: 고용보험법 [별표 1] — 나이·피보험기간
   - 조기재취업수당: 고용보험법 §64 — 잔여 소정급여일수의 1/2 이상 남기고 재취업 후
     12개월 이상 계속 고용(사업 개시) 시 잔여일수 급여의 50%
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriUnemployment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var MAN = 10000;

  var CONST = {
    MIN_WAGE_2026: 10320,
    FLOOR_RATE: 0.8,
    DAILY_CAP: 68100,
    BASE_WAGE_CAP: 113500,
    RATE: 0.6,
    DEFAULT_3M_DAYS: 91,
    /* 고용보험법 [별표 1] 소정급여일수 */
    BENEFIT_DAYS: {
      under50: [120, 150, 180, 210, 240],
      over50: [120, 180, 210, 240, 270]
    },
    BUCKETS: ["lt1", "1to3", "3to5", "5to10", "gte10"],
    BUCKET_LABELS: {
      lt1: "1년 미만",
      "1to3": "1년 이상~3년 미만",
      "3to5": "3년 이상~5년 미만",
      "5to10": "5년 이상~10년 미만",
      gte10: "10년 이상"
    }
  };

  function bucketIndex(bucket) {
    var i = CONST.BUCKETS.indexOf(bucket);
    return i < 0 ? 0 : i;
  }

  function ageKey(group) {
    return group === "over50" ? "over50" : "under50";
  }

  /** 소정급여일수 */
  function benefitDays(ageGroup, bucket) {
    var table = CONST.BENEFIT_DAYS[ageKey(ageGroup)];
    return table[bucketIndex(bucket)];
  }

  /** 1일 구직급여액 (상한·하한 적용) */
  function dailyBenefit(dailyAvgWon, hoursPerDay) {
    var avg = Math.max(0, Core.num(dailyAvgWon, 0, 0, 1e9));
    var hours = Core.clamp(Core.num(hoursPerDay, 8, 1, 8), 1, 8);
    var candidate = avg * CONST.RATE;
    var floor = CONST.MIN_WAGE_2026 * CONST.FLOOR_RATE * hours;
    var cap = CONST.DAILY_CAP;

    var amount = candidate;
    var applied = "normal";
    if (candidate > cap) {
      amount = cap;
      applied = "cap";
    } else if (candidate < floor) {
      amount = floor;
      applied = "floor";
    }
    return {
      dailyAvg: Math.floor(avg),
      candidate: Math.round(candidate),
      floor: Math.round(floor),
      cap: cap,
      amount: Math.round(amount),
      applied: applied,
      hours: hours
    };
  }

  /**
   * @param {object} input
   *  hours        1일 소정근로시간 (1~8)
   *  ageGroup     'under50' | 'over50'
   *  insured      'lt1' | '1to3' | '3to5' | '5to10' | 'gte10'
   *  monthlyMan   퇴직 전 3개월 월 평균 세전임금(만원)
   *  days3m       3개월 일수 (89~92)
   */
  function compute(input) {
    var o = input || {};
    var hours = Core.clamp(Core.num(o.hours, 8, 1, 8), 1, 8);
    var group = ageKey(o.ageGroup);
    var bucket = CONST.BUCKETS.indexOf(o.insured) >= 0 ? o.insured : "1to3";
    var monthlyMan = Math.max(0, Core.num(o.monthlyMan, 300, 0, 100000));
    var days3m = Math.floor(Core.num(o.days3m, CONST.DEFAULT_3M_DAYS, 28, 92));

    var threeMonthWon = monthlyMan * MAN * 3;
    var dailyAvg = days3m > 0 ? Math.floor(threeMonthWon / days3m) : 0;
    var calc = dailyBenefit(dailyAvg, hours);

    var days = benefitDays(group, bucket);
    var total = calc.amount * days;
    var monthly = calc.amount * 30;
    /* 조기재취업수당: 즉시 재취업(잔여 전부) 가정 → 잔여 급여의 50% */
    var early = Math.floor(total * 0.5);

    var warnings = [];
    if (calc.applied === "floor") {
      warnings.push(
        "평균임금의 60%(" +
          Core.won(calc.candidate) +
          ")가 하한액보다 낮아 하한액 " +
          Core.won(calc.floor) +
          "을 적용했습니다. 하한액은 최저임금의 80%에 소정근로시간을 곱해 정해집니다."
      );
    }
    if (calc.applied === "cap") {
      warnings.push(
        "평균임금의 60%(" +
          Core.won(calc.candidate) +
          ")가 상한액 " +
          Core.won(calc.cap) +
          "을 넘어 상한액까지만 지급됩니다. 2026년에는 상한과 하한 차이가 하루 2,052원뿐입니다."
      );
    }
    if (bucket === "lt1") {
      warnings.push(
        "피보험기간 1년 미만이어도 수급 자격을 위한 피보험단위기간 180일은 넘어야 합니다(주 5일 근무 기준 약 8개월)."
      );
    }
    warnings.push(
      "2026년 9월 고용노동부가 발표한 '주 6일 지급·상한 연동' 개편안은 법률·시행령 개정 전이라, 이 계산은 2026년 11월 현행 시행령(주 7일 산정) 기준입니다."
    );

    return {
      hours: hours,
      ageGroup: group,
      ageLabel: group === "over50" ? "만 50세 이상 또는 장애인" : "만 50세 미만",
      insured: bucket,
      insuredLabel: CONST.BUCKET_LABELS[bucket],
      monthlyMan: monthlyMan,
      days3m: days3m,
      threeMonthWon: threeMonthWon,
      dailyAvg: calc.dailyAvg,
      candidate: calc.candidate,
      floor: calc.floor,
      cap: calc.cap,
      daily: calc.amount,
      applied: calc.applied,
      benefitDays: days,
      total: total,
      monthly: monthly,
      earlyReemployment: early,
      hourlyFloor: Math.round(CONST.MIN_WAGE_2026 * CONST.FLOOR_RATE),
      warnings: warnings
    };
  }

  /** 월급별 1일 구직급여 표 (8시간 기준) */
  function byMonthlyWage(list) {
    var wages = list || [216, 250, 300, 350, 400, 500];
    return wages.map(function (w) {
      var r = compute({ hours: 8, ageGroup: "under50", insured: "1to3", monthlyMan: w, days3m: 91 });
      return {
        monthlyMan: w,
        dailyAvg: r.dailyAvg,
        candidate: r.candidate,
        daily: r.daily,
        applied: r.applied,
        monthly: r.monthly
      };
    });
  }

  return {
    CONST: CONST,
    benefitDays: benefitDays,
    dailyBenefit: dailyBenefit,
    compute: compute,
    byMonthlyWage: byMonthlyWage
  };
});
