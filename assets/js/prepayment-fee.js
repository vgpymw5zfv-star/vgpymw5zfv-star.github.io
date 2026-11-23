/* ==========================================================================
   중도상환수수료 계산기 — 순수 계산 코어 (DOM 의존 없음)
   - 은행연합회·금융감독원 안내 산식
       중도상환수수료 = 중도상환금액 × 수수료율 × 대출잔여일수 ÷ 대출기간
   - 대출기간이 3년을 넘으면 수수료 부과기간(3년)을 대출기간으로 본다.
   - 금융소비자 보호에 관한 법률 §20①4호나목: 계약 성립일부터 3년 이내 상환에만 부과 가능.
   - 원 미만은 버린다.
   Node 테스트에서 require()로 그대로 불러 쓸 수 있다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriPrepay = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAY = 86400000;
  var LIMIT_YEARS = 3;

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

  function daysBetween(from, to) {
    return Math.round((to.getTime() - from.getTime()) / DAY);
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

  /* ---------------- 숫자 ---------------- */

  function num(value, fallback) {
    if (typeof value === "number") {
      return isFinite(value) ? value : fallback;
    }
    if (typeof value !== "string") return fallback;
    var cleaned = String(value).replace(/[,원%\s]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;
    var n = Number(cleaned);
    if (!isFinite(n) || isNaN(n)) return fallback;
    return n;
  }

  /** 수수료 = 상환금액 × 요율 × 잔여일수 ÷ 적용기간일수 (원 미만 버림) */
  function feeOf(amount, ratePercent, remainDays, denomDays) {
    if (!(amount > 0) || !(denomDays > 0)) return 0;
    if (!(remainDays > 0)) return 0;
    var raw = amount * (ratePercent / 100) * (remainDays / denomDays);
    if (!isFinite(raw) || raw <= 0) return 0;
    return Math.floor(raw + 1e-7);
  }

  /* ---------------- 계산 ---------------- */

  /**
   * opts = { start, maturity, repay, amount, rate, loanRate }
   *   start    대출 실행일 (YYYY-MM-DD)
   *   maturity 대출 만기일 (YYYY-MM-DD)
   *   repay    중도상환 예정일 (YYYY-MM-DD)
   *   amount   중도상환금액 (원)
   *   rate     중도상환수수료율 (%)
   *   loanRate 대출금리 (%, 선택 — 지금 갚을지 비교용)
   */
  function compute(opts) {
    opts = opts || {};
    var start = parseISO(opts.start);
    var maturity = parseISO(opts.maturity);
    var repay = parseISO(opts.repay);
    var amount = num(opts.amount, 0);
    var rate = num(opts.rate, 0);
    var loanRate = num(opts.loanRate, 0);

    if (!start) return { ok: false, reason: "start" };
    if (!maturity) return { ok: false, reason: "maturity" };
    if (!repay) return { ok: false, reason: "repay" };
    if (!(amount > 0)) return { ok: false, reason: "amount" };
    if (maturity.getTime() <= start.getTime()) return { ok: false, reason: "term" };
    if (repay.getTime() < start.getTime()) return { ok: false, reason: "order" };

    var termDays = daysBetween(start, maturity);
    var limitDate = addYears(start, LIMIT_YEARS);
    var limitDays = daysBetween(start, limitDate);
    var capped = termDays > limitDays;
    var denomDays = capped ? limitDays : termDays;
    var denomEnd = capped ? limitDate : maturity;

    var elapsedDays = daysBetween(start, repay);
    var remainDays = denomDays - elapsedDays;

    var exemptReason = null;
    if (repay.getTime() > maturity.getTime()) {
      exemptReason = "maturity";
      remainDays = 0;
    } else if (remainDays <= 0) {
      exemptReason = "period";
      remainDays = remainingClamp(remainDays);
    }

    var fee = exemptReason ? 0 : feeOf(amount, rate, remainDays, denomDays);
    var nearMaturity = !exemptReason && remainDays > 0 && remainDays < 30;

    /* 시점별 수수료 — 실행 직후부터 3년까지 */
    var schedule = [
      { label: "실행 직후", months: 0 },
      { label: "6개월 후", months: 6 },
      { label: "1년 후", months: 12 },
      { label: "2년 후", months: 24 },
      { label: "3년 후", months: 36 }
    ].map(function (step) {
      var date = addMonths(start, step.months);
      var afterMaturity = date.getTime() > maturity.getTime();
      var elapsed = daysBetween(start, date);
      var remain = denomDays - elapsed;
      var value = afterMaturity || remain <= 0 ? 0 : feeOf(amount, rate, remain, denomDays);
      return {
        label: step.label,
        date: toISO(afterMaturity ? maturity : date),
        elapsedDays: afterMaturity ? termDays : elapsed,
        remainDays: Math.max(0, afterMaturity ? 0 : remain),
        fee: value,
        exempt: afterMaturity || remain <= 0
      };
    });

    /* 지금 갚을까, 수수료 부과기간이 끝날 때까지 기다릴까 */
    var waitDays = Math.max(0, denomDays - Math.max(0, elapsedDays));
    var waitInterest = loanRate > 0 ? amount * (loanRate / 100) * (waitDays / 365) : 0;
    var benefitNow = loanRate > 0 ? waitInterest - fee : null;

    return {
      ok: true,
      start: toISO(start),
      maturity: toISO(maturity),
      repay: toISO(repay),
      amount: amount,
      rate: rate,
      loanRate: loanRate,
      termDays: termDays,
      termLabel: daysToYears(termDays),
      limitDate: toISO(limitDate),
      limitDays: limitDays,
      capped: capped,
      denomDays: denomDays,
      denomEnd: toISO(denomEnd),
      elapsedDays: elapsedDays,
      remainDays: remainDays,
      fee: fee,
      exemptReason: exemptReason,
      nearMaturity: nearMaturity,
      daysToExempt: Math.max(0, daysBetween(repay, limitDate)),
      schedule: schedule,
      waitDays: waitDays,
      waitInterest: waitInterest,
      benefitNow: benefitNow
    };
  }

  function remainingClamp(n) {
    return n < 0 ? 0 : n;
  }

  /** 1096 → "3년" / 3650 → "10년" / 730 → "2년" / 200 → "6개월 18일" */
  function daysToYears(days) {
    var d = Math.max(0, Math.round(days || 0));
    var years = Math.floor(d / 365);
    var rest = d - years * 365;
    var months = Math.floor(rest / 30);
    var restDays = rest - months * 30;
    var parts = [];
    if (years) parts.push(years + "년");
    if (months) parts.push(months + "개월");
    if (!years && restDays) parts.push(restDays + "일");
    if (!parts.length) parts.push("0일");
    return parts.join(" ");
  }

  /** 복사용 요약 */
  function summary(result) {
    if (!result || !result.ok) return "";
    var won = function (n) {
      return Math.round(n).toLocaleString("ko-KR") + "원";
    };
    if (result.exemptReason === "period") {
      return (
        "중도상환수수료 0원 — 실행일부터 3년이 지나 면제 (" +
        result.repay +
        " 상환 기준)"
      );
    }
    if (result.exemptReason === "maturity") {
      return "중도상환수수료 0원 — 만기 이후 상환 (" + result.repay + " 기준)";
    }
    return (
      "중도상환수수료 " +
      won(result.fee) +
      " · 상환액 " +
      won(result.amount) +
      " × " +
      result.rate +
      "% × " +
      result.remainDays +
      "일 ÷ " +
      result.denomDays +
      "일"
    );
  }

  /** 2026년 은행연합회 공시(가계) 참고 요율 */
  var RATE_PRESETS = [
    {
      group: "주택담보·부동산담보 (가계)",
      items: [
        { label: "KB국민 고정 0.75%", rate: 0.75 },
        { label: "KB국민 변동 0.55%", rate: 0.55 },
        { label: "신한 고정 0.59%", rate: 0.59 },
        { label: "신한 변동 0.69%", rate: 0.69 },
        { label: "우리 고정 0.71%", rate: 0.71 },
        { label: "우리 변동 0.95%", rate: 0.95 },
        { label: "하나 고정 0.65%", rate: 0.65 },
        { label: "하나 변동 0.78%", rate: 0.78 },
        { label: "NH농협 고정 0.63%", rate: 0.63 },
        { label: "NH농협 변동 0.93%", rate: 0.93 },
        { label: "IBK기업 고정 0.74%", rate: 0.74 },
        { label: "IBK기업 변동 0.61%", rate: 0.61 },
        { label: "카카오뱅크 0.00%", rate: 0.0 },
        { label: "케이뱅크 고정 0.00%", rate: 0.0 },
        { label: "케이뱅크 변동 0.58%", rate: 0.58 }
      ]
    },
    {
      group: "신용대출 (가계)",
      items: [
        { label: "KB국민 고정 0.18%", rate: 0.18 },
        { label: "KB국민 변동 0.11%", rate: 0.11 },
        { label: "신한 고정 0.17%", rate: 0.17 },
        { label: "신한 변동 0.13%", rate: 0.13 },
        { label: "우리 0.03%", rate: 0.03 },
        { label: "하나 고정 0.20%", rate: 0.2 },
        { label: "하나 변동 0.05%", rate: 0.05 },
        { label: "NH농협 0.01%", rate: 0.01 },
        { label: "카카오뱅크 0.00%", rate: 0.0 }
      ]
    }
  ];

  return {
    LIMIT_YEARS: LIMIT_YEARS,
    parseISO: parseISO,
    toISO: toISO,
    daysBetween: daysBetween,
    addMonths: addMonths,
    addYears: addYears,
    num: num,
    feeOf: feeOf,
    compute: compute,
    daysToYears: daysToYears,
    summary: summary,
    RATE_PRESETS: RATE_PRESETS
  };
});
