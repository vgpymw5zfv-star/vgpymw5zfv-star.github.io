/* ==========================================================================
   글자수·바이트 & 줄바꿈 정리기 — 순수 계산 로직
   - 입력값은 브라우저 메모리에서만 처리합니다. (서버 전송 0)
   - 문자 기준: 유니코드 코드 포인트(이모지 1자)
   - 바이트: UTF-8(정확) / EUC-KR(한글·한자·기호 2바이트, 영문·숫자·공백 1바이트 추정)
   - 문자 메시지 기준: SMS 90바이트 / LMS 2,000바이트 (통신사 규격)
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriText = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SMS_LIMIT = 90;
  var LMS_LIMIT = 2000;
  var CHARS_PER_MINUTE = 500; /* 한국어 성인 읽기 속도 약 400~600자/분의 중간값 */
  var MANUSCRIPT_CHARS = 200; /* 원고지 1매 = 200자 */

  function toPoints(text) {
    var s = typeof text === "string" ? text : "";
    if (typeof Array.from === "function") return Array.from(s);
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charAt(i));
    return out;
  }

  function countChars(text) {
    return toPoints(text).length;
  }

  function countNoSpace(text) {
    return toPoints(String(text == null ? "" : text).replace(/\s/g, "")).length;
  }

  /** UTF-8 바이트 수 (BOM 없음) */
  function utf8Bytes(text) {
    var points = toPoints(text);
    var total = 0;
    for (var i = 0; i < points.length; i++) {
      var cp = points[i].codePointAt ? points[i].codePointAt(0) : points[i].charCodeAt(0);
      if (cp <= 0x7f) total += 1;
      else if (cp <= 0x7ff) total += 2;
      else if (cp <= 0xffff) total += 3;
      else total += 4;
    }
    return total;
  }

  /** EUC-KR(CP949) 바이트 수 추정 — 2바이트 문자는 2, 아스키는 1 */
  function eucKrBytes(text) {
    var points = toPoints(text);
    var total = 0;
    for (var i = 0; i < points.length; i++) {
      var cp = points[i].codePointAt ? points[i].codePointAt(0) : points[i].charCodeAt(0);
      total += cp <= 0x7f ? 1 : 2;
    }
    return total;
  }

  /** 단어 수 — 공백·줄바꿈으로 나눈 덩어리 */
  function countWords(text) {
    var s = String(text == null ? "" : text).trim();
    if (!s) return 0;
    return s.split(/\s+/).length;
  }

  /** 문장 수 — 마침표·물음표·느낌표 뒤에 공백이나 줄 끝이 올 때만 센다 */
  function countSentences(text) {
    var s = String(text == null ? "" : text).trim();
    if (!s) return 0;
    var hits = s.match(/[.!?。？！…]+(?=\s|$)/g);
    var n = hits ? hits.length : 0;
    /* 마침표 없이 끝난 마지막 문장도 1문장으로 본다 */
    if (n === 0) return 1;
    if (!/[.!?。？！…]\s*$/.test(s)) n += 1;
    return n;
  }

  function lineStats(text) {
    var s = String(text == null ? "" : text);
    if (s === "") return { lines: 0, nonEmptyLines: 0, blankLines: 0 };
    var rows = s.split(/\r\n|\r|\n/);
    var nonEmpty = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].trim() !== "") nonEmpty += 1;
    }
    return { lines: rows.length, nonEmptyLines: nonEmpty, blankLines: rows.length - nonEmpty };
  }

  /** 예상 읽기 시간(초) — 공백 제외 글자수 ÷ 분당 500자 */
  function readSeconds(text) {
    var n = countNoSpace(text);
    if (n === 0) return 0;
    return Math.max(1, Math.round((n / CHARS_PER_MINUTE) * 60));
  }

  function formatDuration(seconds) {
    var s = Math.max(0, Math.round(seconds));
    if (s < 60) return s + "초";
    var m = Math.floor(s / 60);
    var rest = s % 60;
    if (m < 60) return rest ? m + "분 " + rest + "초" : m + "분";
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return mm ? h + "시간 " + mm + "분" : h + "시간";
  }

  /** 문자 메시지 규격 상태 */
  function smsStatus(bytes) {
    var b = Math.max(0, bytes || 0);
    if (b === 0) return { tier: "empty", label: "입력 없음", remaining: SMS_LIMIT, over: 0 };
    if (b <= SMS_LIMIT) return { tier: "sms", label: "SMS 한 건", remaining: SMS_LIMIT - b, over: 0 };
    if (b <= LMS_LIMIT) {
      return { tier: "lms", label: "LMS 한 건", remaining: LMS_LIMIT - b, over: 0 };
    }
    return { tier: "over", label: "LMS 초과", remaining: 0, over: b - LMS_LIMIT };
  }

  /**
   * 전체 분석
   * @param {string} text
   */
  function analyze(text) {
    var s = String(text == null ? "" : text);
    var charsWithSpace = countChars(s);
    var charsNoSpace = countNoSpace(s);
    var bUtf8 = utf8Bytes(s);
    var bEuc = eucKrBytes(s);
    var lines = lineStats(s);
    var words = countWords(s);
    var sentences = countSentences(s);
    var seconds = readSeconds(s);
    var sheets = charsWithSpace / MANUSCRIPT_CHARS;

    return {
      charsWithSpace: charsWithSpace,
      charsNoSpace: charsNoSpace,
      bytesUtf8: bUtf8,
      bytesEucKr: bEuc,
      words: words,
      sentences: sentences,
      lines: lines.lines,
      nonEmptyLines: lines.nonEmptyLines,
      blankLines: lines.blankLines,
      manuscriptSheets: sheets,
      manuscriptSheetsCeil: charsWithSpace === 0 ? 0 : Math.ceil(sheets),
      readSeconds: seconds,
      readLabel: charsWithSpace === 0 ? "-" : formatDuration(seconds),
      sms: smsStatus(bEuc),
      perSentence: sentences > 0 ? Math.round(charsWithSpace / sentences) : 0,
      perWord: words > 0 ? Math.round((charsWithSpace / words) * 10) / 10 : 0
    };
  }

  /* ---------------- 정리(클린업) ---------------- */

  /** 줄 끝 공백 제거 + 연속 공백 1칸 */
  function squeezeSpaces(text) {
    return String(text == null ? "" : text)
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/[ \t]+(\r\n|\r|\n)/g, "$1");
  }

  /** 빈 줄 3개 이상 → 1개, 각 줄 앞뒤 공백 제거 */
  function collapseBlankLines(text) {
    var rows = String(text == null ? "" : text).split(/\r\n|\r|\n/);
    var out = [];
    var blank = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i].replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/g, "");
      if (row === "") {
        blank += 1;
        if (blank > 1) continue;
      } else {
        blank = 0;
      }
      out.push(row);
    }
    return out.join("\n");
  }

  /** 앞뒤 여백 제거 */
  function trimEdges(text) {
    return String(text == null ? "" : text).replace(/^\s+|\s+$/g, "");
  }

  /** 줄바꿈 제거 — 한 줄로 붙이기(문단 사이는 한 칸 띄움) */
  function toSingleLine(text) {
    return String(text == null ? "" : text)
      .replace(/[ \t]*\r\n|[ \t]*\r|[ \t]*\n/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/^\s+|\s+$/g, "");
  }

  /** 줄바꿈 유지 + 정리(기본) — 앞뒤 여백·연속 공백·빈 줄을 한 번에 */
  function tidy(text) {
    return collapseBlankLines(squeezeSpaces(trimEdges(text)));
  }

  var CLEANERS = {
    tidy: { label: "한 번에 정리", hint: "앞뒤 여백 · 연속 공백 · 빈 줄을 한 번에", run: tidy },
    spaces: { label: "연속 공백 합치기", hint: "두 칸 이상 띄어쓴 곳을 한 칸으로", run: squeezeSpaces },
    blank: { label: "빈 줄 정리", hint: "빈 줄을 한 줄까지만 남기기", run: collapseBlankLines },
    trim: { label: "앞뒤 여백 제거", hint: "문서 맨 앞·맨 뒤 공백만 제거", run: trimEdges },
    single: { label: "줄바꿈 제거", hint: "여러 줄을 한 줄로 붙이기", run: toSingleLine }
  };

  function clean(text, mode) {
    var fn = CLEANERS[mode] ? CLEANERS[mode].run : tidy;
    return fn(text);
  }

  return {
    analyze: analyze,
    countChars: countChars,
    countNoSpace: countNoSpace,
    utf8Bytes: utf8Bytes,
    eucKrBytes: eucKrBytes,
    countWords: countWords,
    countSentences: countSentences,
    lineStats: lineStats,
    readSeconds: readSeconds,
    formatDuration: formatDuration,
    smsStatus: smsStatus,
    squeezeSpaces: squeezeSpaces,
    collapseBlankLines: collapseBlankLines,
    trimEdges: trimEdges,
    toSingleLine: toSingleLine,
    tidy: tidy,
    clean: clean,
    CLEANERS: CLEANERS,
    SMS_LIMIT: SMS_LIMIT,
    LMS_LIMIT: LMS_LIMIT,
    MANUSCRIPT_CHARS: MANUSCRIPT_CHARS
  };
});
