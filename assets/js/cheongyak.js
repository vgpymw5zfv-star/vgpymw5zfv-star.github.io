/* ==========================================================================
   청약 가점 계산기 — 순수 계산 코어 (DOM 의존 없음)
   근거: 「주택공급에 관한 규칙」 제28조(민영주택 일반공급 1순위 가점제) 및 별표 1
        한국부동산원 청약홈 가점계산 안내
   - 무주택기간 최대 32점 · 부양가족 수 최대 35점 · 입주자저축 가입기간 최대 17점
   - 배우자 통장 가입기간은 50%를 인정해 최대 3점까지 합산 (합계 17점 상한, 2024.3.25. 시행)
   - 만 19세 미만 가입기간은 최대 5년까지 인정 (규칙 제10조제6항, 2024.7.1. 시행)
   Node 테스트에서 require()로 그대로 불러 쓸 수 있다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriCheongyak = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_NO_HOUSE = 32;
  var MAX_DEPENDENT = 35;
  var MAX_ACCOUNT = 17;

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

  /** 만 나이 (기준일 생일이 지나지 않았으면 1살 적게) */
  function fullAge(birth, base) {
    if (!birth || !base) return null;
    var age = base.getUTCFullYear() - birth.getUTCFullYear();
    var bm = birth.getUTCMonth();
    var bd = birth.getUTCDate();
    if (base.getUTCMonth() < bm || (base.getUTCMonth() === bm && base.getUTCDate() < bd)) {
      age -= 1;
    }
    return age;
  }

  /** 두 날짜 사이의 만 개월 수와 남은 일수 */
  function diffMonthsDays(from, to) {
    if (!from || !to || to.getTime() < from.getTime()) {
      return { months: 0, days: 0, totalDays: 0 };
    }
    var months =
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth());
    if (to.getUTCDate() < from.getUTCDate()) months -= 1;
    if (months < 0) months = 0;
    var anchor = addMonths(from, months);
    if (anchor.getTime() > to.getTime()) {
      months -= 1;
      anchor = addMonths(from, months);
    }
    var days = daysBetween(anchor, to);
    return { months: months, days: days, totalDays: daysBetween(from, to) };
  }

  /* ---------------- 무주택기간 ---------------- */

  /** 무주택기간 기산일
   *  ① 원칙: 청약신청자가 만 30세가 되는 날
   *  ② 만 30세 이전에 혼인한 경우: 혼인신고일
   *  ③ 주택(분양권 포함)을 소유한 적이 있으면: 무주택자가 된 날과 ①② 중 늦은 날
   */
  function noHouseStart(birth, marriageDate, disposedDate) {
    if (!birth) return null;
    var base = addYears(birth, 30);
    if (marriageDate && marriageDate.getTime() < base.getTime()) {
      base = marriageDate;
    }
    if (disposedDate && disposedDate.getTime() > base.getTime()) {
      base = disposedDate;
    }
    return base;
  }

  /** 무주택기간 점수 — 1년 미만 2점, 1년마다 +2점, 15년 이상 32점 */
  function noHouseScore(months) {
    var m = Math.max(0, Math.floor(months || 0));
    if (m < 12) return 2;
    return Math.min(MAX_NO_HOUSE, 2 * Math.floor(m / 12) + 2);
  }

  /* ---------------- 부양가족 ---------------- */

  /** 부양가족 수 점수 — 0명 5점, 1명마다 +5점, 6명 이상 35점 */
  function dependentScore(count) {
    var n = Math.max(0, Math.floor(count || 0));
    return Math.min(MAX_DEPENDENT, 5 * (n + 1));
  }

  /* ---------------- 입주자저축(청약통장) 가입기간 ---------------- */

  /** 본인 통장 가입기간 점수 — 6개월 미만 1점, 6개월~1년 2점,
   *  1년 이상은 (가입 연수 + 2)점, 15년 이상 17점 */
  function accountScore(months) {
    var m = Math.max(0, Math.floor(months || 0));
    if (m < 6) return 1;
    if (m < 12) return 2;
    return Math.min(MAX_ACCOUNT, Math.floor(m / 12) + 2);
  }

  /** 배우자 통장 — 가입기간의 50%를 표에 적용, 최대 3점 */
  function spouseAccountScore(months) {
    var m = Math.max(0, Math.floor(months || 0));
    var half = m / 2;
    if (half < 6) return 1;
    if (half < 12) return 2;
    return 3;
  }

  /** 미성년 가입기간을 5년(60개월)까지만 인정 */
  function accountableMonths(joinDate, birth, baseDate) {
    if (!joinDate || !baseDate) return 0;
    var total = diffMonthsDays(joinDate, baseDate).months;
    if (total <= 0) return 0;
    if (!birth) return total;
    var adultDate = addYears(birth, 19);
    if (adultDate.getTime() <= joinDate.getTime()) return total;
    var capEnd = adultDate.getTime() < baseDate.getTime() ? adultDate : baseDate;
    var minorMonths = diffMonthsDays(joinDate, capEnd).months;
    if (minorMonths <= 0) return total;
    var excess = minorMonths - Math.min(minorMonths, 60);
    return Math.max(0, total - Math.max(0, excess));
  }

  /* ---------------- 종합 ---------------- */

  /**
   * opts = {
   *   base: "YYYY-MM-DD" (입주자모집공고일),
   *   birth, marriage, disposed,          // 날짜 문자열 또는 ""
   *   owned: false,                        // 유주택(분양권·입주권 포함)
   *   married: false,                      // 배우자 있음(혼인 중)
   *   depSelf: 0, depSpouse: 0, depChild: 0,   // 인정 부양가족(본인 제외)
   *   joinDate,                            // 청약통장 최초 가입일
   *   spouseAccountMonths: 0               // 배우자 통장 가입 개월(없으면 0)
   * }
   */
  function compute(opts) {
    opts = opts || {};
    var base = parseISO(opts.base);
    if (!base) return { ok: false, reason: "base" };
    var birth = parseISO(opts.birth);
    if (!birth) return { ok: false, reason: "birth" };
    if (birth.getTime() > base.getTime()) return { ok: false, reason: "birthFuture" };

    var marriage = parseISO(opts.marriage);
    var disposed = parseISO(opts.disposed);
    var age = fullAge(birth, base);
    var under30Single = age < 30 && !opts.married;

    /* 무주택기간 */
    var start = noHouseStart(birth, marriage, disposed);
    var nh = { months: 0, days: 0, totalDays: 0, start: start, score: 0, zeroReason: "" };
    if (opts.owned) {
      nh.zeroReason = "owned";
    } else if (under30Single) {
      nh.zeroReason = "under30";
    } else {
      var span = diffMonthsDays(start, base);
      nh.months = span.months;
      nh.days = span.days;
      nh.totalDays = span.totalDays;
      nh.score = noHouseScore(nh.months);
    }

    /* 부양가족 */
    var depCount =
      (opts.married ? 1 : 0) +
      Math.max(0, Math.floor(Number(opts.depSelf) || 0)) +
      Math.max(0, Math.floor(Number(opts.depSpouse) || 0)) +
      Math.max(0, Math.floor(Number(opts.depChild) || 0));
    var dep = { count: depCount, score: dependentScore(depCount), capped: depCount >= 6 };

    /* 청약통장 */
    var joinDate = parseISO(opts.joinDate);
    var months = joinDate ? accountableMonths(joinDate, birth, base) : 0;
    var rawMonths = joinDate ? diffMonthsDays(joinDate, base).months : 0;
    var ownScore = joinDate ? accountScore(months) : 0;
    var spouseMonths = Math.max(0, Math.floor(Number(opts.spouseAccountMonths) || 0));
    var spouseScore = opts.married && spouseMonths > 0 ? spouseAccountScore(spouseMonths) : 0;
    var acctScore = Math.min(MAX_ACCOUNT, ownScore + spouseScore);
    var spouseApplied = Math.min(spouseScore, Math.max(0, acctScore - ownScore));

    var acct = {
      months: months,
      rawMonths: rawMonths,
      minorCapped: rawMonths - months > 0,
      score: acctScore,
      ownScore: ownScore,
      spouseScore: spouseApplied,
      spouseMonths: spouseMonths
    };

    var total = nh.score + dep.score + acct.score;

    /* 다음 구간까지 남은 기간 */
    var next = null;
    if (!nh.zeroReason && nh.months >= 12 && nh.score < MAX_NO_HOUSE) {
      var nextYears = Math.floor(nh.months / 12) + 1;
      var nextDate = addYears(start, nextYears);
      next = { kind: "noHouse", years: nextYears, date: toISO(nextDate), months: diffMonthsDays(base, nextDate).months };
    }
    if ((!next || next.months > 0) && joinDate && acct.score < MAX_ACCOUNT && months >= 12) {
      var nextAcctYears = Math.floor(months / 12) + 1;
      var nextAcctDate = addMonths(joinDate, nextAcctYears * 12);
      var gap = diffMonthsDays(base, nextAcctDate).months;
      if (!next || gap < next.months) {
        next = { kind: "account", years: nextAcctYears, date: toISO(nextAcctDate), months: gap };
      }
    }

    return {
      ok: true,
      total: total,
      max: MAX_NO_HOUSE + MAX_DEPENDENT + MAX_ACCOUNT,
      age: age,
      noHouse: nh,
      dependent: dep,
      account: acct,
      next: next,
      owned: !!opts.owned,
      eligibleForScore: !opts.owned
    };
  }

  /* 결과 복사용 요약 문구 */
  function summary(result) {
    if (!result || !result.ok) return "";
    var lines = [];
    lines.push("청약 가점 " + result.total + "점 / 84점");
    lines.push(
      "무주택기간 " +
        result.noHouse.score +
        "점" +
        (result.noHouse.zeroReason === "under30"
          ? " (만 30세 미만 미혼)"
          : result.noHouse.zeroReason === "owned"
            ? " (유주택)"
            : " · " + result.noHouse.months + "개월")
    );
    lines.push("부양가족 " + result.dependent.score + "점 · 본인 제외 " + result.dependent.count + "명");
    lines.push(
      "청약통장 " +
        result.account.score +
        "점 · " +
        Math.floor(result.account.months / 12) +
        "년 " +
        (result.account.months % 12) +
        "개월"
    );
    return lines.join("\n");
  }

  return {
    MAX_NO_HOUSE: MAX_NO_HOUSE,
    MAX_DEPENDENT: MAX_DEPENDENT,
    MAX_ACCOUNT: MAX_ACCOUNT,
    parseISO: parseISO,
    toISO: toISO,
    addMonths: addMonths,
    addYears: addYears,
    daysBetween: daysBetween,
    fullAge: fullAge,
    diffMonthsDays: diffMonthsDays,
    noHouseStart: noHouseStart,
    noHouseScore: noHouseScore,
    dependentScore: dependentScore,
    accountScore: accountScore,
    spouseAccountScore: spouseAccountScore,
    accountableMonths: accountableMonths,
    compute: compute,
    summary: summary
  };
});
