/* ==========================================================================
   D-day · 근무일(공휴일 제외) · 기념일 계산기 — 순수 계산 로직
   - 날짜는 모두 UTC 자정 기준으로 계산해 시간대·서머타임 영향을 받지 않습니다.
   - 공휴일: 「관공서의 공휴일에 관한 규정」(2026. 4. 30. 개정, 시행 2026. 5. 11.)
     + 우주항공청 「2026·2027년 월력요항」 + 공직선거법 제34조(임기만료 선거일).
     2026년부터 노동절(5/1)·제헌절(7/17)이 공휴일이 되었고 대체공휴일 대상입니다.
   - 임시공휴일(정부 수시 지정)은 포함하지 않습니다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriDday = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAY = 86400000;
  var MAX_SPAN = 20000; /* 계산 안전 범위(약 54년) */

  /* ---------------- 공휴일 데이터 ---------------- */

  /* [월-일, 이름, 종류] — 종류: holiday 공휴일 / sub 대체공휴일 / election 선거일 */
  var HOLIDAY_TABLE = {
    2026: [
      ["01-01", "신정", "holiday"],
      ["02-16", "설날 연휴", "holiday"],
      ["02-17", "설날", "holiday"],
      ["02-18", "설날 연휴", "holiday"],
      ["03-01", "삼일절", "holiday"],
      ["03-02", "대체공휴일(삼일절)", "sub"],
      ["05-01", "노동절", "holiday"],
      ["05-05", "어린이날", "holiday"],
      ["05-24", "부처님오신날", "holiday"],
      ["05-25", "대체공휴일(부처님오신날)", "sub"],
      ["06-03", "전국동시지방선거", "election"],
      ["06-06", "현충일", "holiday"],
      ["07-17", "제헌절", "holiday"],
      ["08-15", "광복절", "holiday"],
      ["08-17", "대체공휴일(광복절)", "sub"],
      ["09-24", "추석 연휴", "holiday"],
      ["09-25", "추석", "holiday"],
      ["09-26", "추석 연휴", "holiday"],
      ["10-03", "개천절", "holiday"],
      ["10-05", "대체공휴일(개천절)", "sub"],
      ["10-09", "한글날", "holiday"],
      ["12-25", "기독탄신일(성탄절)", "holiday"]
    ],
    2027: [
      ["01-01", "신정", "holiday"],
      ["02-06", "설날 연휴", "holiday"],
      ["02-07", "설날", "holiday"],
      ["02-08", "설날 연휴", "holiday"],
      ["02-09", "대체공휴일(설날)", "sub"],
      ["03-01", "삼일절", "holiday"],
      ["05-01", "노동절", "holiday"],
      ["05-03", "대체공휴일(노동절)", "sub"],
      ["05-05", "어린이날", "holiday"],
      ["05-13", "부처님오신날", "holiday"],
      ["06-06", "현충일", "holiday"],
      ["07-17", "제헌절", "holiday"],
      ["07-19", "대체공휴일(제헌절)", "sub"],
      ["08-15", "광복절", "holiday"],
      ["08-16", "대체공휴일(광복절)", "sub"],
      ["09-14", "추석 연휴", "holiday"],
      ["09-15", "추석", "holiday"],
      ["09-16", "추석 연휴", "holiday"],
      ["10-03", "개천절", "holiday"],
      ["10-04", "대체공휴일(개천절)", "sub"],
      ["10-09", "한글날", "holiday"],
      ["10-11", "대체공휴일(한글날)", "sub"],
      ["12-25", "기독탄신일(성탄절)", "holiday"],
      ["12-27", "대체공휴일(기독탄신일)", "sub"]
    ]
  };

  var HOLIDAYS = {};
  Object.keys(HOLIDAY_TABLE).forEach(function (year) {
    HOLIDAY_TABLE[year].forEach(function (row) {
      HOLIDAYS[year + "-" + row[0]] = { name: row[1], kind: row[2], date: year + "-" + row[0] };
    });
  });

  var WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  var COVERED_YEARS = [2026, 2027];

  /* ---------------- 날짜 유틸 ---------------- */

  /** "YYYY-MM-DD" → UTC 자정 Date (형식이 아니면 null) */
  function parseDate(value) {
    if (value instanceof Date) return isFinite(value.getTime()) ? value : null;
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value == null ? "" : value).trim());
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return date;
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /** Date → "YYYY-MM-DD" */
  function key(date) {
    if (!date) return "";
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
  }

  /** "2026-11-19" → "2026. 11. 19.(목)" */
  function label(date) {
    if (!date) return "";
    return (
      date.getUTCFullYear() +
      ". " +
      (date.getUTCMonth() + 1) +
      ". " +
      date.getUTCDate() +
      ".(" +
      WEEKDAY_KO[date.getUTCDay()] +
      ")"
    );
  }

  function addDays(date, n) {
    if (!date) return null;
    return new Date(date.getTime() + Math.round(n) * DAY);
  }

  function addMonths(date, n) {
    if (!date) return null;
    var y = date.getUTCFullYear();
    var m = date.getUTCMonth() + n;
    var targetY = y + Math.floor(m / 12);
    var targetM = ((m % 12) + 12) % 12;
    var lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
    var d = Math.min(date.getUTCDate(), lastDay);
    return new Date(Date.UTC(targetY, targetM, d));
  }

  /** 윤년 2/29 → 2/28 등 말일 보정해서 n년 뒤 */
  function addYears(date, n) {
    if (!date) return null;
    return addMonths(date, n * 12);
  }

  function diffDays(from, to) {
    if (!from || !to) return 0;
    return Math.round((to.getTime() - from.getTime()) / DAY);
  }

  function isWeekend(date) {
    var w = date.getUTCDay();
    return w === 0 || w === 6;
  }

  function holidayOf(date) {
    if (!date) return null;
    return HOLIDAYS[key(date)] || null;
  }

  /** 주말·법정공휴일을 모두 뺀 근무일인지 */
  function isBusinessDay(date) {
    return !!date && !isWeekend(date) && !holidayOf(date);
  }

  /** "YYYY-MM-DD"의 공휴일 정보 */
  function holidayByKey(value) {
    return HOLIDAYS[String(value || "")] || null;
  }

  /**
   * 두 날짜 사이의 근무일·주말·공휴일 수
   * - 목표일이 기준일보다 뒤면 (기준일 다음 날 ~ 목표일)을, 앞이면 (목표일 ~ 기준일 전날)을 센다.
   * - 두 날짜가 같으면 0일.
   */
  function span(from, to) {
    var result = {
      total: 0,
      business: 0,
      businessFrom: null,
      businessTo: null,
      weekend: 0,
      holiday: 0,
      weekdayHolidays: [],
      covered: true
    };
    if (!from || !to) return result;
    var delta = diffDays(from, to);
    result.total = Math.abs(delta);
    if (delta === 0) {
      result.businessFrom = from;
      result.businessTo = from;
      return result;
    }
    var forward = delta > 0;
    var start = forward ? addDays(from, 1) : to;
    var end = forward ? to : addDays(from, -1);
    result.businessFrom = start;
    result.businessTo = end;
    if (diffDays(start, end) > MAX_SPAN) {
      result.covered = false;
      return result;
    }
    var cursor = start;
    while (diffDays(cursor, end) >= 0) {
      var h = holidayOf(cursor);
      if (isWeekend(cursor)) {
        result.weekend += 1;
      } else if (h) {
        result.holiday += 1;
        result.weekdayHolidays.push({
          date: key(cursor),
          name: h.name,
          kind: h.kind
        });
      } else {
        result.business += 1;
      }
      cursor = addDays(cursor, 1);
    }
    /* 공휴일 데이터는 2026·2027년만 있으므로, 구간이 그 밖으로 나가면 안내를 띄운다 */
    if (
      COVERED_YEARS.indexOf(start.getUTCFullYear()) === -1 ||
      COVERED_YEARS.indexOf(end.getUTCFullYear()) === -1
    ) {
      result.covered = false;
    }
    return result;
  }

  /** 주 + 남은 일수 */
  function weekParts(days) {
    var abs = Math.abs(days);
    return { weeks: Math.floor(abs / 7), days: abs % 7 };
  }

  /** 달력 기준 개월 + 남은 일수 */
  function monthParts(from, to) {
    if (!from || !to) return { months: 0, days: 0 };
    var forward = diffDays(from, to) >= 0;
    var a = forward ? from : to;
    var b = forward ? to : from;
    var months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    var anchor = addMonths(a, months);
    if (diffDays(anchor, b) < 0) {
      months -= 1;
      anchor = addMonths(a, months);
    }
    return { months: months, days: diffDays(anchor, b) };
  }

  /** "D-16" / "D-Day" / "D+3" */
  function ddayText(diff) {
    if (diff === 0) return "D-Day";
    return diff > 0 ? "D-" + diff : "D+" + Math.abs(diff);
  }

  /** "D-16 · 2026. 12. 5.(토)" 같은 한 줄 요약 */
  function summary(from, to) {
    if (!from || !to) return "";
    var diff = diffDays(from, to);
    return ddayText(diff) + " · " + label(to);
  }

  /* ---------------- 기념일 ---------------- */

  var ANNIVERSARY_DAYS = [100, 200, 300, 500, 1000];
  var ANNIVERSARY_YEARS = [1, 2, 3, 5, 10];

  function label100(days) {
    return days + "일";
  }

  function labelYear(years) {
    return years + "주년";
  }

  /**
   * 시작일 기준 기념일 목록
   * @param {Date} start
   * @param {Date} today 기준일(오늘) — 남은 일수(D-day) 계산용
   */
  function anniversaries(start, today) {
    if (!start) return [];
    var base = today || start;
    var list = [];
    ANNIVERSARY_DAYS.forEach(function (n) {
      var date = addDays(start, n);
      list.push({
        type: "day",
        value: n,
        label: label100(n),
        date: date,
        key: key(date),
        weekday: WEEKDAY_KO[date.getUTCDay()],
        diff: diffDays(base, date),
        holiday: holidayOf(date)
      });
    });
    ANNIVERSARY_YEARS.forEach(function (n) {
      var date = addYears(start, n);
      list.push({
        type: "year",
        value: n,
        label: labelYear(n),
        date: date,
        key: key(date),
        weekday: WEEKDAY_KO[date.getUTCDay()],
        diff: diffDays(base, date),
        holiday: holidayOf(date)
      });
    });
    list.sort(function (a, b) {
      return a.date.getTime() - b.date.getTime();
    });
    return list;
  }

  /* ---------------- 다가오는 공휴일 ---------------- */

  function holidaysOfYear(year) {
    var rows = HOLIDAY_TABLE[year] || [];
    return rows.map(function (row) {
      var date = parseDate(year + "-" + row[0]);
      return {
        key: key(date),
        date: date,
        name: row[1],
        kind: row[2],
        weekday: WEEKDAY_KO[date.getUTCDay()]
      };
    });
  }

  /** 기준일 다음 날부터 n개 (연말이면 다음 해로 이어짐) */
  function upcomingHolidays(from, count) {
    var limit = typeof count === "number" ? count : 4;
    if (!from) return [];
    var out = [];
    var year = from.getUTCFullYear();
    var years = COVERED_YEARS.slice(COVERED_YEARS.indexOf(year)).filter(function (y) {
      return y >= year;
    });
    for (var i = 0; i < years.length && out.length < limit; i++) {
      holidaysOfYear(years[i]).forEach(function (h) {
        if (out.length >= limit) return;
        if (h.date.getTime() > from.getTime()) out.push(h);
      });
    }
    return out;
  }

  return {
    HOLIDAY_TABLE: HOLIDAY_TABLE,
    COVERED_YEARS: COVERED_YEARS,
    WEEKDAY_KO: WEEKDAY_KO,
    parseDate: parseDate,
    key: key,
    label: label,
    addDays: addDays,
    addMonths: addMonths,
    addYears: addYears,
    diffDays: diffDays,
    isWeekend: isWeekend,
    isBusinessDay: isBusinessDay,
    holidayOf: holidayOf,
    holidayByKey: holidayByKey,
    span: span,
    weekParts: weekParts,
    monthParts: monthParts,
    ddayText: ddayText,
    summary: summary,
    anniversaries: anniversaries,
    holidaysOfYear: holidaysOfYear,
    upcomingHolidays: upcomingHolidays,
    ANNIVERSARY_DAYS: ANNIVERSARY_DAYS,
    ANNIVERSARY_YEARS: ANNIVERSARY_YEARS
  };
});
