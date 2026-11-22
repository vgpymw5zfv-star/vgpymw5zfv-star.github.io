/* ==========================================================================
   경력기간 계산기 — 순수 계산 코어 (DOM 의존 없음)
   - 입사일·퇴사일로 경력별 기간(년·월·일)을 구하고,
   - 재직 중인 경력은 기준일까지, 수습 제외 개월은 시작일을 미뤄 인정 경력에서 뺀다.
   - 합산 방식: 중복 제거(겹치는 기간은 한 번만) / 단순 합산
   - 기간 합산은 1개월을 30일로 보는 인사 실무 관행을 따른다. (남은 일수가 30일을 넘으면 1개월로 올림)
   Node 테스트에서 require()로 그대로 불러 쓸 수 있다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriCareer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAY = 86400000;

  /* ---------------- 날짜 ---------------- */

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

  function daysBetween(from, to) {
    return Math.round((to.getTime() - from.getTime()) / DAY);
  }

  /** from ~ to 사이의 만 개월 수와 남은 일수 (to < from 이면 0) */
  function diffMonthsDays(from, to) {
    if (!from || !to || to.getTime() <= from.getTime()) {
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
    return {
      months: months,
      days: daysBetween(anchor, to),
      totalDays: daysBetween(from, to)
    };
  }

  /** 30일 이상 남으면 1개월로 올린다 (1개월 = 30일 관행) */
  function normalize(period) {
    var months = Math.max(0, Math.floor(period.months || 0));
    var days = Math.max(0, Math.floor(period.days || 0));
    if (days >= 30) {
      months += Math.floor(days / 30);
      days = days % 30;
    }
    return { months: months, days: days, totalDays: period.totalDays };
  }

  /* ---------------- 표시 ---------------- */

  /** 14 → "1년 2개월" */
  function yearsMonths(months) {
    var m = Math.max(0, Math.floor(months || 0));
    var y = Math.floor(m / 12);
    var rest = m % 12;
    if (y && rest) return y + "년 " + rest + "개월";
    if (y) return y + "년";
    return rest + "개월";
  }

  /** 개월·일을 "N년 M개월 D일" 로 */
  function periodLabel(months, days) {
    var m = Math.max(0, Math.floor(months || 0));
    var d = Math.max(0, Math.floor(days || 0));
    var y = Math.floor(m / 12);
    var rest = m % 12;
    var parts = [];
    if (y) parts.push(y + "년");
    if (rest || y) parts.push(rest + "개월");
    if (d) parts.push(d + "일");
    if (!parts.length) parts.push("0일");
    return parts.join(" ");
  }

  /* ---------------- 경력 한 건 ---------------- */

  /** entry = { name, hire, leave, current, probation }
   *  - current: 재직 중이면 기준일(base)까지 계산
   *  - probation: 수습 제외 개월 수 (인정 경력 시작일을 그만큼 미룬다)
   */
  function entryPeriod(entry, base) {
    var hire = parseISO(entry && entry.hire);
    if (!hire) return { ok: false, reason: "hire" };
    var end = entry && entry.current ? base : parseISO(entry && entry.leave);
    if (!end) return { ok: false, reason: entry && entry.current ? "base" : "leave" };
    if (end.getTime() < hire.getTime()) return { ok: false, reason: "order" };

    var probation = Math.max(0, Math.floor(Number(entry.probation) || 0));
    var recognizedStart = probation ? addMonths(hire, probation) : hire;
    if (recognizedStart.getTime() > end.getTime()) recognizedStart = end;

    var span = normalize(diffMonthsDays(hire, end));
    var recognized = normalize(diffMonthsDays(recognizedStart, end));

    return {
      ok: true,
      name: (entry.name || "").trim(),
      hire: toISO(hire),
      end: toISO(end),
      current: !!(entry && entry.current),
      probation: probation,
      months: span.months,
      days: span.days,
      totalDays: span.totalDays,
      recognizedMonths: recognized.months,
      recognizedDays: recognized.days,
      recognizedTotalDays: recognized.totalDays,
      recognizedStart: toISO(recognizedStart)
    };
  }

  /* ---------------- 합산 ---------------- */

  /** 개월·일 목록을 30일 기준으로 더해 (년, 월, 일) 로 정리 */
  function addPeriods(list) {
    var months = 0;
    var days = 0;
    list.forEach(function (p) {
      months += Math.max(0, Math.floor(p.months || 0));
      days += Math.max(0, Math.floor(p.days || 0));
    });
    months += Math.floor(days / 30);
    days = days % 30;
    return { months: months, days: days, totalDays: 0 };
  }

  /** 겹치는 구간을 합친다. (시작일 기준 정렬, 같은 날에 끝나고 시작하면 하나로 본다) */
  function mergeRanges(ranges) {
    var sorted = ranges
      .filter(function (r) {
        return r && r.start && r.end && r.end.getTime() >= r.start.getTime();
      })
      .sort(function (a, b) {
        return a.start.getTime() - b.start.getTime();
      });
    var merged = [];
    sorted.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r.start.getTime() <= last.end.getTime()) {
        if (r.end.getTime() > last.end.getTime()) last.end = r.end;
      } else {
        merged.push({ start: r.start, end: r.end });
      }
    });
    return merged;
  }

  /**
   * opts = { base: "YYYY-MM-DD", entries: [...], mode: "merge" | "sum" }
   */
  function compute(opts) {
    opts = opts || {};
    var base = parseISO(opts.base);
    if (!base) return { ok: false, reason: "base" };
    var list = (opts.entries || []).filter(function (e) {
      return e && (e.hire || "").trim();
    });
    if (!list.length) return { ok: false, reason: "empty" };

    var rows = [];
    var invalid = [];
    list.forEach(function (e, i) {
      var p = entryPeriod(e, base);
      if (!p.ok) {
        invalid.push({ index: i, reason: p.reason, name: e.name || "" });
        return;
      }
      rows.push(p);
    });
    if (!rows.length) return { ok: false, reason: "invalid", invalid: invalid };

    var mode = opts.mode === "sum" ? "sum" : "merge";

    /* 인정 경력 기준 구간 */
    var ranges = rows.map(function (r) {
      return { start: parseISO(r.recognizedStart), end: parseISO(r.end) };
    });

    var overlapDays = 0;
    var recognizedMonths;
    var recognizedDays;
    var totalMonths;
    var totalDays;

    if (mode === "merge") {
      var merged = mergeRanges(ranges);
      var sumDays = 0;
      merged.forEach(function (r) {
        sumDays += daysBetween(r.start, r.end);
      });
      var naiveDays = rows.reduce(function (a, r) {
        return a + r.recognizedTotalDays;
      }, 0);
      var mergedPeriod = addPeriods(
        merged.map(function (r) {
          return diffMonthsDays(r.start, r.end);
        })
      );
      recognizedMonths = mergedPeriod.months;
      recognizedDays = mergedPeriod.days;
      overlapDays = Math.max(0, naiveDays - sumDays);
      totalMonths = recognizedMonths;
      totalDays = sumDays;
    } else {
      var total = addPeriods(
        rows.map(function (r) {
          return { months: r.recognizedMonths, days: r.recognizedDays };
        })
      );
      recognizedMonths = total.months;
      recognizedDays = total.days;
      totalMonths = recognizedMonths;
      totalDays = rows.reduce(function (a, r) {
        return a + r.recognizedTotalDays;
      }, 0);
    }

    return {
      ok: true,
      mode: mode,
      count: rows.length,
      rows: rows,
      invalid: invalid,
      recognizedMonths: recognizedMonths,
      recognizedDays: recognizedDays,
      overlapDays: overlapDays,
      totalDays: totalDays,
      totalMonths: totalMonths,
      label: periodLabel(recognizedMonths, recognizedDays),
      yearsMonths: yearsMonths(recognizedMonths)
    };
  }

  /** 복사용 요약 */
  function summary(result) {
    if (!result || !result.ok) return "";
    return (
      "총 경력 " +
      result.label +
      " (" +
      result.recognizedMonths +
      "개월)" +
      (result.overlapDays > 0 ? " · 중복 " + result.overlapDays + "일 제외" : "") +
      " · 경력 " +
      result.count +
      "건"
    );
  }

  return {
    parseISO: parseISO,
    toISO: toISO,
    addMonths: addMonths,
    daysBetween: daysBetween,
    diffMonthsDays: diffMonthsDays,
    normalize: normalize,
    yearsMonths: yearsMonths,
    periodLabel: periodLabel,
    entryPeriod: entryPeriod,
    addPeriods: addPeriods,
    mergeRanges: mergeRanges,
    compute: compute,
    summary: summary
  };
});
