/* ==========================================================================
   연차 일수 · 미사용 연차수당 계산기 — 순수 계산 코어
   근거: 근로기준법 제60조(연차 유급휴가)·제61조(사용 촉진)·제49조(소멸시효 3년),
        근로기준법 시행령 제6조(통상임금), 고용노동부고시 제2025-47호(2026년 최저임금)
   - DOM 의존 없음. Node 테스트에서 require()로 그대로 불러 쓸 수 있다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriAnnualLeave = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* 2026년 적용 최저임금 (고용노동부고시 제2025-47호) — 시간급 */
  var MIN_HOURLY_WAGE_2026 = 10320;

  /* 주 소정근로시간별 월 소정근로시간 (유급 주휴 포함, 365/7/12 기준 반올림) */
  var MONTHLY_HOURS = {
    "40": 209,
    "35": 183,
    "30": 156
  };

  function num(value, fallback) {
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "string") {
      var cleaned = value.replace(/[,\s일원]/g, "");
      if (cleaned === "") return fallback;
      var n = Number(cleaned);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function comma(n) {
    if (typeof n !== "number" || !isFinite(n)) n = 0;
    return Math.round(n).toLocaleString("ko-KR");
  }

  function won(n) {
    return comma(n) + "원";
  }

  /* ---------------- 날짜 (UTC 자정 기준 — 시간대 영향 제거) ---------------- */

  function parseISO(text) {
    if (!text) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text).trim());
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var date = new Date(Date.UTC(y, mo - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d
    ) {
      return null;
    }
    return date;
  }

  function toISO(date) {
    if (!date) return "";
    var y = date.getUTCFullYear();
    var m = date.getUTCMonth() + 1;
    var d = date.getUTCDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
  }

  function addMonths(date, months) {
    var y = date.getUTCFullYear();
    var m = date.getUTCMonth();
    var d = date.getUTCDate();
    var target = new Date(Date.UTC(y, m + months, 1));
    var lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
    ).getUTCDate();
    return new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay))
    );
  }

  function addYears(date, years) {
    return addMonths(date, years * 12);
  }

  function daysBetween(from, to) {
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  /* ---------------- 근속 기간 ---------------- */

  /* 입사일~기준일의 개월 수(만). 일(day)이 차지 않으면 그 달은 세지 않는다. */
  function totalMonths(hire, base) {
    var months =
      (base.getUTCFullYear() - hire.getUTCFullYear()) * 12 +
      (base.getUTCMonth() - hire.getUTCMonth());
    if (base.getUTCDate() < hire.getUTCDate()) months -= 1;
    return Math.max(0, months);
  }

  function tenure(hire, base) {
    var months = totalMonths(hire, base);
    return {
      months: months,
      years: Math.floor(months / 12),
      restMonths: months % 12,
      totalDays: daysBetween(hire, base)
    };
  }

  function tenureText(t) {
    if (t.months < 1) {
      return t.totalDays + "일";
    }
    if (t.years < 1) {
      return t.months + "개월";
    }
    return t.restMonths > 0 ? t.years + "년 " + t.restMonths + "개월" : t.years + "년";
  }

  /* ---------------- 연차 일수 ---------------- */

  /* 1년 이상 근속: 15일 + (최초 1년 초과 근속 2년마다 1일), 한도 25일 */
  function daysForYears(years) {
    if (years < 1) return 0;
    return Math.min(25, 15 + Math.floor((years - 1) / 2));
  }

  /* 가산이 한 번 더 붙는 다음 근속 연수 (없으면 0) */
  function nextIncreaseYear(years) {
    if (years < 1) return 1;
    if (daysForYears(years) >= 25) return 0;
    var next = years % 2 === 0 ? years + 1 : years + 2;
    if (next < 3) next = 3;
    return next;
  }

  /* 입사일·기준일 → 이번 연차 연도 연차 일수와 기한 */
  function entitlement(hireText, baseText) {
    var hire = parseISO(hireText);
    var base = parseISO(baseText);
    if (!hire || !base) {
      return { ok: false, reason: "date" };
    }
    if (base.getTime() < hire.getTime()) {
      return { ok: false, reason: "order" };
    }

    var t = tenure(hire, base);
    var result = {
      ok: true,
      hire: hire,
      base: base,
      tenure: t,
      tenureText: tenureText(t),
      underOneYear: t.months < 12,
      days: 0,
      addDays: 0,
      expiry: null,
      nextAccrual: null,
      nextIncrease: null
    };

    if (result.underOneYear) {
      /* 1년 미만: 1개월 개근 시 1일, 최초 1년 안에 최대 11일 */
      result.days = Math.min(11, t.months);
      result.addDays = 0;
      result.expiry = addYears(hire, 1);
      if (t.months + 1 <= 11) {
        result.nextAccrual = addMonths(hire, t.months + 1);
      }
      result.rule =
        "1개월 개근마다 1일 · 최초 1년에 최대 11일 (근로기준법 제60조②)";
    } else {
      result.days = daysForYears(t.years);
      result.addDays = result.days - 15;
      result.anniversary = addYears(hire, t.years);
      result.expiry = addYears(hire, t.years + 1);

      var nextYear = nextIncreaseYear(t.years);
      if (nextYear) {
        result.nextIncrease = {
          years: nextYear,
          days: daysForYears(nextYear),
          date: addYears(hire, nextYear)
        };
      }
      result.rule =
        result.addDays > 0
          ? "15일 + 가산 " + result.addDays + "일 (근로기준법 제60조①④)"
          : "1년간 80% 이상 출근 시 15일 (근로기준법 제60조①)";
    }

    return result;
  }

  /* ---------------- 미사용 연차수당 ---------------- */

  function leavePay(monthlyWage, monthlyHours, unusedDays) {
    var wage = num(monthlyWage, 0);
    var hours = num(monthlyHours, 209);
    var days = num(unusedDays, 0);
    if (hours <= 0) hours = 209;
    if (wage < 0) wage = 0;
    if (days < 0) days = 0;

    var hourly = wage / hours;
    var daily = hourly * 8;
    return {
      wage: wage,
      hours: hours,
      unusedDays: days,
      hourly: hourly,
      daily: daily,
      total: daily * days,
      belowMinWage: hourly > 0 && hourly < MIN_HOURLY_WAGE_2026
    };
  }

  /* ---------------- 요약 문구 ---------------- */

  function summary(state) {
    var lines = ["연차 정리 (" + state.baseText + " 기준)"];
    lines.push(
      "· 근속 " +
        state.tenureText +
        " → 연차 " +
        state.days +
        "일" +
        (state.addDays > 0 ? " (가산 " + state.addDays + "일 포함)" : "")
    );
    lines.push(
      "· 사용 " + state.usedDays + "일 / 남은 연차 " + state.remainDays + "일"
    );
    lines.push(
      "· 1일 통상임금 " +
        won(Math.round(state.pay.daily)) +
        " (월 " +
        comma(state.pay.wage) +
        "원 ÷ " +
        state.pay.hours +
        "시간 × 8시간)"
    );
    lines.push(
      "· 미사용 연차수당 " + won(state.pay.total) + " (세전)"
    );
    if (state.expiryText) {
      lines.push("· 이번 연차 사용기한 " + state.expiryText);
    }
    return lines.join("\n");
  }

  return {
    MIN_HOURLY_WAGE_2026: MIN_HOURLY_WAGE_2026,
    MONTHLY_HOURS: MONTHLY_HOURS,
    parseISO: parseISO,
    toISO: toISO,
    addMonths: addMonths,
    addYears: addYears,
    daysBetween: daysBetween,
    tenure: tenure,
    tenureText: tenureText,
    daysForYears: daysForYears,
    nextIncreaseYear: nextIncreaseYear,
    entitlement: entitlement,
    leavePay: leavePay,
    summary: summary,
    comma: comma,
    won: won,
    num: num
  };
});
