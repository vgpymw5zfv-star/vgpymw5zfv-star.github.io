/* ==========================================================================
   최저임금 · 주휴수당 계산 코어 (DOM 의존 없음)
   - 2026년 최저임금 10,320원 / 2027년 10,700원 (고용노동부 고시)
   - 주휴수당: 주 소정근로 15시간 이상 + 소정근로일 개근 → min(8, 주 소정근로 ÷ 5)시간분
   - 월 환산: (주 소정근로 + 주휴) × 209 ÷ 48  ← 고용노동부 최저임금 월 환산액과 같은 비례
   Node 테스트에서 require()로 그대로 불러 쓸 수 있습니다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriMinWage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* 고용노동부 고시 — 2026년 제2025-47호(2025.8.5), 2027년 제2026-60호(2026.8.5) */
  var YEARS = {
    "2026": { hourly: 10320, monthly: 2156880, daily: 82560, label: "2026년" },
    "2027": { hourly: 10700, monthly: 2236300, daily: 85600, label: "2027년" }
  };

  var MONTHLY_HOURS = 209; // 주 40시간 + 주휴 8시간 = 48시간 기준 월 환산시간
  var WEEK_HOURS = 48;
  var HOLIDAY_MIN_WEEK = 15; // 근로기준법 제18조제3항
  var HOLIDAY_MAX_HOURS = 8;

  function num(value, fallback, min, max) {
    var n;
    if (typeof value === "number") {
      n = value;
    } else if (typeof value === "string") {
      var cleaned = value.replace(/[,\s원시간일명]/g, "");
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

  function yearInfo(year) {
    return YEARS[String(year)] || YEARS["2026"];
  }

  /** 주 소정근로시간 = 1일 소정근로시간 × 1주 근무일수 */
  function weeklyHours(dayHours, days) {
    var d = num(dayHours, 0, 0, 24);
    var c = num(days, 0, 0, 7);
    return Math.round(d * c * 100) / 100;
  }

  /** 주휴시간 — 15시간 미만이면 0, 40시간 이상이어도 8시간 한도 */
  function holidayHours(weekly) {
    var w = num(weekly, 0, 0, 168);
    if (w < HOLIDAY_MIN_WEEK) return 0;
    return Math.min(HOLIDAY_MAX_HOURS, Math.round((w / 40) * 8 * 100) / 100);
  }

  /** 주휴수당 = 주휴시간 × 시급 */
  function holidayPay(hourly, weekly) {
    return num(hourly, 0, 0, 10000000) * holidayHours(weekly);
  }

  /** 주급(주휴 포함) = (주 소정근로 + 주휴) × 시급 */
  function weeklyPay(hourly, weekly) {
    var w = num(weekly, 0, 0, 168);
    return num(hourly, 0, 0, 10000000) * (w + holidayHours(w));
  }

  /** 월 환산시간 = (주 소정근로 + 주휴) × 209 ÷ 48 */
  function monthlyHours(weekly) {
    var w = num(weekly, 0, 0, 168);
    return (w + holidayHours(w)) * (MONTHLY_HOURS / WEEK_HOURS);
  }

  /** 월 예상 급여(주휴 포함, 세전) = 월 환산시간 × 시급 */
  function monthlyPay(hourly, weekly) {
    return num(hourly, 0, 0, 10000000) * monthlyHours(weekly);
  }

  /** '주휴수당 포함 시급'을 실제 기본시급으로 환산 (주휴시간만큼 역산) */
  function baseRateFromPackage(packageRate, weekly) {
    var w = num(weekly, 0, 0, 168);
    var hh = holidayHours(w);
    var rate = num(packageRate, 0, 0, 10000000);
    if (w <= 0 || w + hh <= 0) return 0;
    return (rate * w) / (w + hh);
  }

  /** 최저임금 판정 */
  function judge(rate, weekly, year) {
    var info = yearInfo(year);
    var r = num(rate, 0, 0, 10000000);
    var gap = r - info.hourly;
    var minMonthly = monthlyPay(info.hourly, weekly);
    var myMonthly = monthlyPay(r, weekly);
    return {
      year: String(year || "2026"),
      minHourly: info.hourly,
      minMonthly: minMonthly,
      rate: r,
      gap: gap,
      ok: gap >= 0,
      shortMonthly: Math.max(0, minMonthly - myMonthly)
    };
  }

  /** 한 번에 계산 — 페이지·테스트 공용 */
  function calc(o) {
    var opts = o || {};
    var year = String(opts.year || "2026");
    var info = yearInfo(year);
    var dayHours = num(opts.dayHours, 8, 0, 24);
    var days = num(opts.days, 5, 0, 7);
    var weekly = weeklyHours(dayHours, days);
    var attend = opts.attend !== false;
    var hh = attend ? holidayHours(weekly) : 0;
    var packageMode = opts.mode === "package";
    var inputRate = num(opts.rate, info.hourly, 0, 10000000);
    var baseRate = packageMode ? baseRateFromPackage(inputRate, weekly) : inputRate;
    var holiday = hh * baseRate;
    var weeklyTotal = (weekly + hh) * baseRate;
    var monthHours = (weekly + hh) * (MONTHLY_HOURS / WEEK_HOURS);
    var monthly = monthHours * baseRate;
    var judgeInfo = judge(baseRate, weekly, year);

    return {
      year: year,
      minHourly: info.hourly,
      minMonthly: info.monthly,
      dayHours: dayHours,
      days: days,
      weeklyHours: weekly,
      holidayHours: hh,
      holidayOk: attend && weekly >= HOLIDAY_MIN_WEEK,
      mode: packageMode ? "package" : "hourly",
      inputRate: inputRate,
      baseRate: baseRate,
      holidayPay: holiday,
      weeklyPay: weeklyTotal,
      weeklyTotalPay: weekly + hh,
      monthlyHours: monthHours,
      monthlyPay: monthly,
      annualPay: monthly * 12,
      judge: judgeInfo
    };
  }

  /** 요약 문구 (복사용) */
  function summary(r) {
    if (!r) return "";
    var lines = [
      "[" + r.year + "년 최저임금 기준] 주휴수당 포함 급여 계산",
      "· 근무: 1일 " + r.dayHours + "시간 × 주 " + r.days + "일 = 주 " + r.weeklyHours + "시간(소정)",
      "· 주휴시간: " + r.holidayHours + "시간" + (r.holidayOk ? "" : " (주 15시간 미만 또는 결근으로 미발생)"),
      "· 주휴수당: " + won(r.holidayPay) + " / 주급(주휴 포함): " + won(r.weeklyPay),
      "· 월 예상 급여(세전): " + won(r.monthlyPay) + " (월 환산 " + (Math.round(r.monthlyHours * 10) / 10 % 1 === 0 ? Math.round(r.monthlyHours) : r.monthlyHours.toFixed(1)) + "시간)",
      "· 연봉 환산: " + won(r.annualPay),
      r.mode === "package"
        ? "· 주휴 포함 시급 " + won(r.inputRate) + " → 기본시급 " + won(r.baseRate)
        : "· 시급: " + won(r.baseRate),
      r.judge.ok
        ? "· " + r.year + "년 최저임금 " + won(r.minHourly) + " 충족"
        : "· " + r.year + "년 최저임금 " + won(r.minHourly) + " 미달 (시간당 " + won(Math.abs(r.judge.gap)) + " 부족, 월 " + won(r.judge.shortMonthly) + " 부족)"
    ];
    return lines.join("\n");
  }

  return {
    YEARS: YEARS,
    MONTHLY_HOURS: MONTHLY_HOURS,
    HOLIDAY_MIN_WEEK: HOLIDAY_MIN_WEEK,
    num: num,
    comma: comma,
    won: won,
    yearInfo: yearInfo,
    weeklyHours: weeklyHours,
    holidayHours: holidayHours,
    holidayPay: holidayPay,
    weeklyPay: weeklyPay,
    monthlyHours: monthlyHours,
    monthlyPay: monthlyPay,
    baseRateFromPackage: baseRateFromPackage,
    judge: judge,
    calc: calc,
    summary: summary
  };
});
