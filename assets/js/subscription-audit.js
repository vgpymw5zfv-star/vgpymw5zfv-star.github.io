/* ==========================================================================
   고정비·구독료 연간 합산 진단기 — 순수 계산 코어 (DOM 의존 없음)
   - 항목별 결제 주기(매월·3개월·6개월·매년)를 월 환산해 고정비 총액을 구하고
   - 월 실수령액 대비 비율, 50% 기준선 초과분, 카테고리별 비중을 계산한다.
   - '정리 후보'로 체크한 항목을 해지했을 때의 월·연 절약액도 함께 계산한다.
   Node 테스트에서 require()로 그대로 불러 쓸 수 있다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriSubAudit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------------- 주기 · 분류 ---------------- */

  var CYCLES = [
    { id: "monthly", label: "매월", months: 1 },
    { id: "quarterly", label: "3개월", months: 3 },
    { id: "semiannual", label: "6개월", months: 6 },
    { id: "yearly", label: "매년", months: 12 }
  ];

  var CATEGORIES = [
    { id: "housing", label: "주거·공과금" },
    { id: "telecom", label: "통신·인터넷" },
    { id: "subscribe", label: "구독·멤버십" },
    { id: "insurance", label: "보험" },
    { id: "loan", label: "대출·할부" },
    { id: "etc", label: "기타" }
  ];

  function cycleById(id) {
    for (var i = 0; i < CYCLES.length; i += 1) {
      if (CYCLES[i].id === id) return CYCLES[i];
    }
    return CYCLES[0];
  }

  function categoryById(id) {
    for (var i = 0; i < CATEGORIES.length; i += 1) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }

  /* ---------------- 숫자 ---------------- */

  /** "12,900원" · "12900" → 12900 (빈값·문자 → fallback) */
  function num(value, fallback) {
    if (typeof value === "number") {
      return isFinite(value) && value > 0 ? value : fallback;
    }
    if (typeof value !== "string") return fallback;
    var cleaned = String(value).replace(/[,원\s]/g, "");
    if (cleaned === "" || cleaned === "-") return fallback;
    var n = Number(cleaned);
    if (!isFinite(n) || n <= 0) return fallback;
    return n;
  }

  /* ---------------- 환산 ---------------- */

  /** 결제 주기를 월 금액으로 환산 */
  function monthlyOf(amount, cycleId) {
    var a = num(amount, 0);
    var months = cycleById(cycleId).months;
    return a / months;
  }

  /** 1년에 나가는 금액 */
  function annualOf(amount, cycleId) {
    return monthlyOf(amount, cycleId) * 12;
  }

  /* ---------------- 진단 ---------------- */

  /**
   * opts = { income: 월 실수령액, rows: [{ name, amount, cycle, category, cancel }] }
   * @returns {{ok:boolean, reason?:string, monthly:number, annual:number, ...}}
   */
  function analyze(opts) {
    opts = opts || {};
    var income = num(opts.income, 0);
    var rows = (opts.rows || []).filter(function (row) {
      return row && num(row.amount, 0) > 0;
    });

    if (!rows.length) {
      return {
        ok: false,
        reason: "empty",
        income: income,
        count: 0,
        monthly: 0,
        annual: 0,
        rows: [],
        byCategory: [],
        cancel: { count: 0, monthly: 0, annual: 0 },
        share: {},
        ratio: null,
        remaining: null,
        cap: null,
        over: null,
        status: null,
        levels: []
      };
    }

    var monthly = 0;
    var annual = 0;
    var buckets = {};
    var cancelMonthly = 0;
    var cancelAnnual = 0;
    var cancelCount = 0;
    var share = {};
    var detail = [];

    rows.forEach(function (row) {
      var m = monthlyOf(row.amount, row.cycle);
      var a = annualOf(row.amount, row.cycle);
      var cat = categoryById(row.category).id;
      monthly += m;
      annual += a;
      if (!buckets[cat]) buckets[cat] = { id: cat, label: categoryById(cat).label, monthly: 0, annual: 0 };
      buckets[cat].monthly += m;
      buckets[cat].annual += a;
      if (row.cancel) {
        cancelCount += 1;
        cancelMonthly += m;
        cancelAnnual += a;
      }
      detail.push({
        name: (row.name || "").trim(),
        category: cat,
        categoryLabel: categoryById(cat).label,
        cycle: cycleById(row.cycle).id,
        cycleLabel: cycleById(row.cycle).label,
        amount: num(row.amount, 0),
        monthly: m,
        annual: a,
        cancel: !!row.cancel
      });
    });

    detail.forEach(function (row) {
      row.share = monthly > 0 ? (row.monthly / monthly) * 100 : 0;
    });

    var byCategory = [];
    CATEGORIES.forEach(function (cat) {
      var b = buckets[cat.id];
      if (!b || b.monthly <= 0) return;
      b.share = monthly > 0 ? (b.monthly / monthly) * 100 : 0;
      byCategory.push(b);
    });
    byCategory.sort(function (a, b) {
      return b.monthly - a.monthly;
    });

    var top = detail.slice().sort(function (a, b) {
      return b.monthly - a.monthly;
    })[0];

    var ratio = income > 0 ? (monthly / income) * 100 : null;
    var cap = income > 0 ? income * 0.5 : null;
    var over = income > 0 ? Math.max(0, monthly - cap) : null;
    var remaining = income > 0 ? income - monthly : null;
    var subscribeMonthly = buckets.subscribe ? buckets.subscribe.monthly : 0;

    share.subscribe = monthly > 0 ? (subscribeMonthly / monthly) * 100 : 0;
    share.top = top && monthly > 0 ? (top.monthly / monthly) * 100 : 0;

    var status = null;
    var levels = [];
    if (ratio !== null) {
      if (ratio <= 40) status = "good";
      else if (ratio <= 50) status = "warn";
      else status = "bad";
    }

    levels.push({ label: "여유", limit: 40, tone: "good" });
    levels.push({ label: "주의", limit: 50, tone: "warn" });
    levels.push({ label: "높음", limit: Infinity, tone: "bad" });

    return {
      ok: true,
      income: income,
      count: detail.length,
      monthly: monthly,
      annual: annual,
      rows: detail,
      byCategory: byCategory,
      cancel: { count: cancelCount, monthly: cancelMonthly, annual: cancelAnnual },
      share: share,
      subscribeMonthly: subscribeMonthly,
      top: top || null,
      ratio: ratio,
      remaining: remaining,
      cap: cap,
      over: over,
      status: status,
      levels: levels
    };
  }

  /** 카카오톡·메모에 붙여 넣을 1~3줄 요약 */
  function summary(result) {
    if (!result || !result.ok) return "";
    var won = function (n) {
      return Math.round(n).toLocaleString("ko-KR") + "원";
    };
    var parts = ["월 고정비 " + won(result.monthly) + " · 연 " + won(result.annual)];
    if (result.ratio !== null) {
      parts.push("월 실수령 대비 " + result.ratio.toFixed(1) + "%");
    }
    if (result.cancel.count > 0) {
      parts.push(
        "정리 후보 " +
          result.cancel.count +
          "건 해지 시 월 " +
          won(result.cancel.monthly) +
          " · 연 " +
          won(result.cancel.annual) +
          " 절약"
      );
    }
    return parts.join(" · ");
  }

  /** 진단 문구 — 결과 카드 보조 설명 */
  function diagnosis(result) {
    if (!result || !result.ok || result.ratio === null) return "";
    var pct = result.ratio;
    if (pct <= 40) {
      return "소득의 40% 이하로, 50/30/20 기준의 필수 지출(50%) 안에 여유가 있습니다.";
    }
    if (pct <= 50) {
      return "필수 지출 권장선(50%)에 가깝습니다. 구독료처럼 줄일 수 있는 항목부터 확인해 보세요.";
    }
    return "필수 지출 권장선(50%)을 넘었습니다. 고정비를 " +
      Math.round(result.over).toLocaleString("ko-KR") +
      "원 줄이면 기준선 안으로 들어옵니다.";
  }

  return {
    CYCLES: CYCLES,
    CATEGORIES: CATEGORIES,
    cycleById: cycleById,
    categoryById: categoryById,
    num: num,
    monthlyOf: monthlyOf,
    annualOf: annualOf,
    analyze: analyze,
    summary: summary,
    diagnosis: diagnosis
  };
});
