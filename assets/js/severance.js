/* ==========================================================================
   퇴직금 · 퇴직소득세 실수령 & 연차수당 계산기 (순수 계산 코어, DOM 비의존)
   근거
   - 퇴직금: 근로자퇴직급여 보장법 §8 — 1일 평균임금 × 30일 × (계속근로일수 ÷ 365)
            근로기준법 §2(평균임금) — 산정 사유 발생 전 3개월 임금총액 ÷ 그 기간 일수
   - 미사용 연차수당: 근로기준법 §60, 고용노동부 행정해석(1350)
            월 통상임금 ÷ 209시간 × 8시간 × 미사용 연차일수 (주 40시간 기준)
   - 퇴직소득세: 소득세법 §48(퇴직소득공제)·§55(기본세율)·시행규칙 별지 제40호의2
            2023.1.1 이후 근속연수공제 상향분 반영 (국세청 2026년 11월 확인)
   - 연금수령 감면: 소득세법 §120의2 — 연금수령 10년 이하 30%, 11년차 이후 40% 감면
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriSeverance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var MAN = 10000;
  var DAYS_PER_YEAR = 365;
  var MONTHLY_HOURS = 209; /* 주 40시간 월 소정근로시간 (주휴 포함) */
  var DAILY_HOURS = 8;

  /* ---------------- 날짜 ---------------- */

  function parseDate(value) {
    if (!value || typeof value !== "string") return null;
    var m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var stamp = Date.UTC(y, mo - 1, d);
    var check = new Date(stamp);
    if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d, stamp: stamp };
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function diffDays(from, to) {
    if (!from || !to) return 0;
    return Math.round((to.stamp - from.stamp) / 86400000);
  }

  function addMonths(d, k) {
    var total = d.m - 1 + k;
    var y = d.y + Math.floor(total / 12);
    var m = ((total % 12) + 12) % 12 + 1;
    var day = Math.min(d.d, daysInMonth(y, m));
    return { y: y, m: m, d: day, stamp: Date.UTC(y, m - 1, day) };
  }

  /** 총 근속월수 (일 단위는 올림하지 않은 만 개월 수) */
  function serviceMonths(from, to) {
    if (!from || !to || to.stamp <= from.stamp) return 0;
    var k = 0;
    /* 최대 100년(1,200개월)까지 탐색 */
    while (k < 1200 && addMonths(from, k + 1).stamp <= to.stamp) {
      k += 1;
    }
    return k;
  }

  /** 근속기간 상세: 년/월/일 */
  function serviceDetail(from, to) {
    var days = Math.max(0, diffDays(from, to));
    var months = serviceMonths(from, to);
    var years = Math.floor(months / 12);
    var restMonths = months - years * 12;
    var anchor = addMonths(from, months);
    var restDays = Math.max(0, diffDays(anchor, to));
    return {
      days: days,
      months: months,
      years: years,
      restMonths: restMonths,
      restDays: restDays,
      label:
        years +
        "년 " +
        restMonths +
        "개월 " +
        restDays +
        "일"
    };
  }

  /* ---------------- 퇴직소득세 ---------------- */

  /** 근속연수공제 (원) — 소득세법 §48 ② */
  function serviceDeduction(years) {
    var y = Math.max(1, Math.floor(years));
    if (y <= 5) return y * 1000000;
    if (y <= 10) return 5000000 + (y - 5) * 2000000;
    if (y <= 20) return 15000000 + (y - 10) * 2500000;
    return 40000000 + (y - 20) * 3000000;
  }

  /** 환산급여공제 (원) — 소득세법 §48 ① 2호 */
  function convertedDeduction(convertedWon) {
    var v = Math.max(0, convertedWon);
    if (v <= 8000000) return v;
    if (v <= 70000000) return 8000000 + (v - 8000000) * 0.6;
    if (v <= 100000000) return 45200000 + (v - 70000000) * 0.55;
    if (v <= 300000000) return 61700000 + (v - 100000000) * 0.45;
    return 151700000 + (v - 300000000) * 0.35;
  }

  function floor10(n) {
    if (!isFinite(n)) return 0;
    return Math.floor(n / 10) * 10;
  }

  /**
   * 퇴직소득세 계산
   * @param {number} payWon 퇴직소득금액(퇴직금, 원)
   * @param {number} months 총 근속월수 (12로 나눈 뒤 1년 미만은 올림)
   */
  function tax(payWon, months) {
    var pay = Math.max(0, Math.round(Core.num(payWon, 0, 0, 1e13)));
    var totalMonths = Math.max(0, Core.num(months, 0, 0, 1200));
    /* 근속연수: 1년 미만은 1년으로 올림 (소득세법 시행령 §42의2) */
    var years = Math.max(1, Math.ceil(totalMonths / 12));

    var deduction = serviceDeduction(years);
    var base = Math.max(0, pay - deduction);
    var converted = base > 0 ? base * 12 / years : 0;
    var convDeduction = convertedDeduction(converted);
    var taxBase = Math.max(0, converted - convDeduction);
    /* 기본세율은 만원 단위 함수이므로 환산 후 되돌린다 */
    var convertedTax = Math.max(0, Core.incomeTax(taxBase / MAN)) * MAN;
    var taxAmount = pay > 0 ? floor10(convertedTax / 12 * years) : 0;
    var localTax = floor10(taxAmount * 0.1);
    var total = taxAmount + localTax;

    /* 연금수령 감면 (연금수령 10년 이하 30%, 11년차 이후 40%) */
    var irpUnder10Tax = floor10(taxAmount * 0.7);
    var irpUnder10Local = floor10(localTax * 0.7);
    var irpOver10Tax = floor10(taxAmount * 0.6);
    var irpOver10Local = floor10(localTax * 0.6);

    return {
      pay: pay,
      years: years,
      serviceDeduction: deduction,
      base: base,
      converted: Math.floor(converted),
      convertedDeduction: Math.floor(convDeduction),
      taxBase: Math.floor(taxBase),
      convertedTax: floor10(convertedTax),
      incomeTax: taxAmount,
      localTax: localTax,
      total: total,
      net: Math.max(0, pay - total),
      effectiveRate: pay > 0 ? total / pay : 0,
      irp: {
        under10: {
          incomeTax: irpUnder10Tax,
          localTax: irpUnder10Local,
          total: irpUnder10Tax + irpUnder10Local,
          net: Math.max(0, pay - irpUnder10Tax - irpUnder10Local),
          saving: Math.max(0, taxAmount - irpUnder10Tax + (localTax - irpUnder10Local))
        },
        over10: {
          incomeTax: irpOver10Tax,
          localTax: irpOver10Local,
          total: irpOver10Tax + irpOver10Local,
          net: Math.max(0, pay - irpOver10Tax - irpOver10Local),
          saving: Math.max(0, taxAmount - irpOver10Tax + (localTax - irpOver10Local))
        }
      }
    };
  }

  /* ---------------- 퇴직금 · 연차수당 ---------------- */

  /** 미사용 연차수당 (원) — 통상임금 ÷ 209 × 8 × 일수 */
  function leaveAllowance(ordinaryMonthlyWon, days) {
    var wage = Math.max(0, Core.num(ordinaryMonthlyWon, 0, 0, 1e10));
    var d = Math.max(0, Core.num(days, 0, 0, 60));
    return {
      ordinaryMonthly: wage,
      days: d,
      dailyWage: Math.floor(wage * DAILY_HOURS / MONTHLY_HOURS),
      amount: Math.floor(wage / MONTHLY_HOURS * DAILY_HOURS * d)
    };
  }

  /** 퇴직금 (원) */
  function severancePay(dailyAvgWon, serviceDays) {
    var daily = Math.max(0, Core.num(dailyAvgWon, 0, 0, 1e10));
    var days = Math.max(0, Core.num(serviceDays, 0, 0, 36500));
    return Math.floor(daily * 30 * days / DAYS_PER_YEAR);
  }

  /**
   * @param {object} input
   *  mode            'dates' | 'period'
   *  startDate/endDate  'YYYY-MM-DD'
   *  years/months    기간 간편 입력
   *  baseMan         월 기본급(만원)
   *  allowMan        월 고정수당(만원)
   *  bonusMan        연간 상여금(만원)
   *  nonTaxWon       월 비과세액(원)
   *  includeNonTax   비과세액을 평균임금에 포함할지 (기본 true)
   *  leaveDays       미사용 연차일수
   *  leaveOrdinaryMan 월 통상임금(만원, 비우면 기본급+고정수당)
   *  includeLeaveInAvg 미사용 연차수당을 평균임금에 반영(3/12)
   *  avgDays         3개월 일수 (89~92)
   *  irpTerm         'under10' | 'over10'
   */
  function compute(input) {
    var o = input || {};
    var mode = o.mode === "period" ? "period" : "dates";

    var start = parseDate(o.startDate) || { y: 2021, m: 11, d: 18, stamp: Date.UTC(2021, 10, 18) };
    var end = parseDate(o.endDate) || { y: 2026, m: 11, d: 18, stamp: Date.UTC(2026, 10, 18) };
    if (end.stamp < start.stamp) {
      var swap = start;
      start = end;
      end = swap;
    }

    var detail;
    if (mode === "period") {
      var y = Math.floor(Core.num(o.years, 5, 0, 50));
      var m = Math.floor(Core.num(o.months, 0, 0, 11));
      var months = y * 12 + m;
      var days = Math.round(y * DAYS_PER_YEAR + m * DAYS_PER_YEAR / 12);
      detail = {
        days: days,
        months: months,
        years: y,
        restMonths: m,
        restDays: 0,
        label: y + "년 " + m + "개월"
      };
    } else {
      detail = serviceDetail(start, end);
    }

    var base = Math.max(0, Core.num(o.baseMan, 300, 0, 100000)) * MAN;
    var allow = Math.max(0, Core.num(o.allowMan, 0, 0, 100000)) * MAN;
    var bonusYear = Math.max(0, Core.num(o.bonusMan, 0, 0, 1000000)) * MAN;
    var nonTax = o.includeNonTax === false ? 0 : Math.max(0, Core.num(o.nonTaxWon, 0, 0, 5000000));
    var avgDays = Math.floor(Core.num(o.avgDays, 91, 28, 92));

    var ordinaryMan =
      o.leaveOrdinaryMan === undefined || o.leaveOrdinaryMan === null || o.leaveOrdinaryMan === ""
        ? null
        : Math.max(0, Core.num(o.leaveOrdinaryMan, 0, 0, 100000)) * MAN;
    var ordinary = ordinaryMan === null ? base + allow : ordinaryMan;

    var leave = leaveAllowance(ordinary, o.leaveDays);
    var monthlyWage = base + allow + bonusYear / 12 + nonTax;
    var threeMonth = monthlyWage * 3;
    var leaveInAvg = o.includeLeaveInAvg
      ? leave.amount * 3 / 12
      : 0;
    var threeMonthWithLeave = threeMonth + leaveInAvg;
    var dailyAvg = avgDays > 0 ? Math.floor(threeMonthWithLeave / avgDays) : 0;

    var pay = severancePay(dailyAvg, detail.days);
    var eligible = detail.days >= DAYS_PER_YEAR;
    var payable = eligible ? pay : 0;
    /* 미사용 연차수당은 1년 미만 근로자에게도 지급 의무가 있다 */
    var leavePayable = leave.amount;
    var gross = payable + leavePayable;

    var taxResult = tax(pay, detail.months);
    var irpTerm = o.irpTerm === "over10" ? "over10" : "under10";
    var irp = taxResult.irp[irpTerm];

    var warnings = [];
    if (!eligible) {
      warnings.push(
        "계속근로일수가 " +
          detail.days +
          "일로 1년(365일) 미만이라 퇴직금이 발생하지 않습니다. 아래 세금 계산은 1년 근무 가정의 예시입니다."
      );
    }
    if (mode === "period") {
      warnings.push(
        "근속기간 간편 입력은 1개월을 365÷12일로 환산합니다. 정확한 일수는 입사일·퇴사일로 계산하세요."
      );
    }
    if (detail.days > 0 && detail.days % 365 !== 0 && eligible) {
      warnings.push("퇴직금은 1년 미만의 잔여 기간도 일 단위로 비례 계산합니다(365일 기준).");
    }
    if (leave.days > 0 && !o.includeLeaveInAvg) {
      warnings.push(
        "미사용 연차수당은 퇴직금에 자동 포함되지 않습니다. 퇴직 전 지급받은 연차수당을 평균임금에 반영하려면 '연차수당 3/12 반영'을 켜세요."
      );
    }

    return {
      mode: mode,
      serviceDays: detail.days,
      serviceMonths: detail.months,
      serviceYears: detail.years,
      serviceRestMonths: detail.restMonths,
      serviceRestDays: detail.restDays,
      serviceLabel: detail.label,
      taxYears: taxResult.years,
      monthlyWage: monthlyWage,
      threeMonthWage: threeMonth,
      leaveInAvg: Math.floor(leaveInAvg),
      avgDays: avgDays,
      dailyAvg: dailyAvg,
      eligible: eligible,
      pay: payable,
      payRaw: pay,
      leaveAllowance: leave.amount,
      leaveDays: leave.days,
      leaveDailyWage: leave.dailyWage,
      gross: gross,
      tax: taxResult,
      net: Math.max(0, gross - (eligible ? taxResult.total : 0)),
      irpTerm: irpTerm,
      irp: irp,
      warnings: warnings
    };
  }

  /** 근속연수별 퇴직금·세금 표 (같은 월급 기준) */
  function compareByYears(input, yearList) {
    var o = input || {};
    var list = yearList || [1, 3, 5, 7, 10, 15, 20, 25];
    return list.map(function (years) {
      var r = compute({
        mode: "period",
        years: years,
        months: 0,
        baseMan: o.baseMan,
        allowMan: o.allowMan,
        bonusMan: o.bonusMan,
        nonTaxWon: o.nonTaxWon,
        includeNonTax: o.includeNonTax,
        leaveDays: 0,
        avgDays: o.avgDays,
        irpTerm: "under10"
      });
      return {
        years: years,
        pay: r.pay,
        tax: r.tax.total,
        net: Math.max(0, r.pay - r.tax.total),
        rate: r.tax.effectiveRate
      };
    });
  }

  return {
    parseDate: parseDate,
    diffDays: diffDays,
    serviceMonths: serviceMonths,
    serviceDetail: serviceDetail,
    serviceDeduction: serviceDeduction,
    convertedDeduction: convertedDeduction,
    leaveAllowance: leaveAllowance,
    severancePay: severancePay,
    tax: tax,
    compute: compute,
    compareByYears: compareByYears
  };
});
