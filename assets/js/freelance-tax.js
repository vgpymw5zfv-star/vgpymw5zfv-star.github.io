/* ==========================================================================
   프리랜서 3.3% 원천징수 · 실수령액 계산기 — 순수 계산 코어
   - 사업소득(인적용역) 3.3% = 소득세 3%(소득세법 §129①3)
     + 개인지방소득세 0.3%(지방세법 §103의13①, 소득세의 10%)
   - 기타소득 8.8% = 필요경비 60%(소득세법 시행령 §87) → 소득금액 40%
     → 원천징수세율 20% → 8% + 지방소득세 0.8%
   - 10원 미만 절사(국고금 관리법 §47)를 소득세·지방소득세 각각에 적용
   - 세후 → 세전 역산, 연간 수입으로 5월 종합소득세 간이 추정
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriFreelance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var C = {
    /* 소득세법 §129①3 — 원천징수대상 사업소득 3% */
    BUSINESS_RATE: 0.03,
    /* 지방세법 §103의13① — 원천징수 소득세의 10% */
    LOCAL_RATE: 0.1,
    /* 소득세법 시행령 §87 — 일시적 인적용역 기타소득 필요경비 60% */
    OTHER_EXPENSE_RATE: 0.6,
    /* 소득세법 §129①6 — 기타소득 원천징수세율 20% */
    OTHER_RATE: 0.2,
    /* 소득세법 §84 — 기타소득금액 건별 5만원 이하 비과세 */
    SPLIT_MIN_INCOME: 50000,
    /* 종합소득 기본공제 1인당 150만원 */
    BASIC_DEDUCTION: 1500000,
    /* 인적용역 단순경비율 초과율이 붙는 수입금액 기준(4천만원) */
    SIMPLE_OVER_LIMIT: 40000000
  };

  /* 2026년 귀속 종합소득세 기본세율 (소득세법 §55, 2023년 개정 8구간) */
  var BRACKETS = [
    { upTo: 14000000, rate: 0.06, progressive: 0 },
    { upTo: 50000000, rate: 0.15, progressive: 1260000 },
    { upTo: 88000000, rate: 0.24, progressive: 5760000 },
    { upTo: 150000000, rate: 0.35, progressive: 15440000 },
    { upTo: 300000000, rate: 0.38, progressive: 19940000 },
    { upTo: 500000000, rate: 0.4, progressive: 25940000 },
    { upTo: 1000000000, rate: 0.42, progressive: 35940000 },
    { upTo: Infinity, rate: 0.45, progressive: 65940000 }
  ];

  /* 2025년 귀속 단순경비율 고시(국세청고시 제2026-14호, 2026-03-30 시행)
     인적용역(940***)은 수입금액 4천만원 이하 기본율, 초과분은 초과율 */
  var JOB_PRESETS = [
    { key: "writer", code: "940100", label: "작가·작곡가", base: 58.7, over: 42.2 },
    { key: "creator", code: "940306", label: "1인 미디어 콘텐츠 창작자", base: 64.1, over: 49.7 },
    { key: "lecture", code: "940600", label: "자문·강의·지도·고문", base: 58.4, over: 41.8 },
    { key: "academy", code: "940903", label: "학원강사·재단사", base: 61.7, over: 46.4 },
    { key: "programmer", code: "940909", label: "컴퓨터프로그래머", base: 64.1, over: 49.7 },
    { key: "software", code: "940926", label: "소프트웨어 프리랜서", base: 64.4, over: 50.2 },
    { key: "afterschool", code: "940925", label: "방과후강사", base: 69.3, over: 57.0 },
    { key: "design", code: "940600", label: "디자인·번역·편집 (자문·강의 업종 적용)", base: 58.4, over: 41.8 }
  ];

  function num(value, fallback) {
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "string") {
      var cleaned = value.replace(/[,\s원만천억]/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;
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

  /* 10원 미만 절사 (국고금 관리법 §47) */
  function floor10(n) {
    if (!isFinite(n)) return 0;
    return Math.floor(n / 10) * 10;
  }

  /* 산출세액 — 과세표준(원)에 기본세율 적용 */
  function incomeTax(taxable) {
    var t = Math.max(0, Math.floor(taxable || 0));
    for (var i = 0; i < BRACKETS.length; i += 1) {
      if (t <= BRACKETS[i].upTo) {
        return Math.max(0, floor10(t * BRACKETS[i].rate - BRACKETS[i].progressive));
      }
    }
    return 0;
  }

  function marginalRate(taxable) {
    var t = Math.max(0, taxable || 0);
    for (var i = 0; i < BRACKETS.length; i += 1) {
      if (t <= BRACKETS[i].upTo) return BRACKETS[i].rate;
    }
    return 0.45;
  }

  /* 사업소득(인적용역) 3.3% 원천징수 */
  function business(gross) {
    var g = Math.max(0, Math.round(num(gross, 0)));
    var tax = floor10(g * C.BUSINESS_RATE);
    var local = floor10(tax * C.LOCAL_RATE);
    return {
      type: "business",
      gross: g,
      expense: 0,
      income: g,
      incomeTax: tax,
      localTax: local,
      withheld: tax + local,
      net: g - tax - local,
      rate: g > 0 ? (tax + local) / g : 0
    };
  }

  /* 기타소득(일시적 인적용역) 8.8% 원천징수 */
  function other(gross) {
    var g = Math.max(0, Math.round(num(gross, 0)));
    var expense = Math.floor(g * C.OTHER_EXPENSE_RATE);
    var income = g - expense;
    var tax = 0;
    var local = 0;
    if (income > C.SPLIT_MIN_INCOME) {
      tax = floor10(income * C.OTHER_RATE);
      local = floor10(tax * C.LOCAL_RATE);
    }
    return {
      type: "other",
      gross: g,
      expense: expense,
      income: income,
      incomeTax: tax,
      localTax: local,
      withheld: tax + local,
      net: g - tax - local,
      rate: g > 0 ? (tax + local) / g : 0,
      exempt: income <= C.SPLIT_MIN_INCOME
    };
  }

  function calc(gross, type) {
    return type === "other" ? other(gross) : business(gross);
  }

  /**
   * 세후 실수령액 → 세전 지급액 역산
   * 10원 미만 절사 때문에 단순히 ÷0.967 하면 1~10원 어긋난다.
   * 가장 작은 지급액부터 훑어 목표 실수령액을 처음 넘기는 금액을 찾는다.
   */
  function solveNet(targetNet, type) {
    var target = Math.max(0, Math.round(num(targetNet, 0)));
    if (target <= 0) return 0;
    var ratio = type === "other" ? 1 - 0.088 : 1 - 0.033;
    var start = Math.max(0, Math.floor(target / ratio) - 40);
    for (var g = start; g <= start + 400; g += 1) {
      if (calc(g, type).net >= target) return g;
    }
    return Math.ceil(target / ratio);
  }

  /* 견적서에 쓰기 좋게 1,000원 단위로 올림 */
  function roundUpTo(gross, unit) {
    var u = num(unit, 1000);
    if (!(u > 0)) u = 1;
    return Math.ceil(num(gross, 0) / u) * u;
  }

  /**
   * 5월 종합소득세 간이 추정 (사업소득만 있는 경우)
   * @param {object} p {gross, baseRate(%), overRate(%), dependents}
   */
  function annualSettle(p) {
    p = p || {};
    var gross = Math.max(0, Math.round(num(p.gross, 0)));
    var basePct = num(p.baseRate, 58.4);
    var overPct = num(p.overRate, 41.8);
    var baseRate = basePct / 100;
    var overRate = overPct / 100;
    var dependents = Math.max(1, Math.round(num(p.dependents, 1)));

    if (gross <= 0) {
      return {
        gross: 0,
        base: 0,
        over: 0,
        expense: 0,
        income: 0,
        deduction: 0,
        taxable: 0,
        computedTax: 0,
        localTax: 0,
        prepaid: 0,
        diff: 0,
        marginalRate: 0,
        dependents: dependents
      };
    }

    var base = Math.min(gross, C.SIMPLE_OVER_LIMIT);
    var over = Math.max(0, gross - C.SIMPLE_OVER_LIMIT);
    /* 경비율은 % 값이므로 100으로 나눈 뒤 원 단위로 내림 (부동소수 오차 보정) */
    var expense =
      Math.floor((base * basePct) / 100 + 1e-6) + Math.floor((over * overPct) / 100 + 1e-6);
    var income = Math.max(0, gross - expense);
    var deduction = Math.min(income, C.BASIC_DEDUCTION * dependents);
    var taxable = Math.max(0, income - deduction);
    var computed = incomeTax(taxable);
    var local = floor10(computed * C.LOCAL_RATE);
    var prepaid = business(gross).withheld;
    var diff = computed + local - prepaid;

    return {
      gross: gross,
      base: base,
      over: over,
      baseRate: basePct,
      overRate: overPct,
      expense: expense,
      income: income,
      deduction: deduction,
      taxable: taxable,
      computedTax: computed,
      localTax: local,
      prepaid: prepaid,
      diff: diff,
      marginalRate: marginalRate(taxable),
      dependents: dependents
    };
  }

  /* 복사용 요약 */
  function summary(state) {
    if (!state || !state.result) return "";
    var r = state.result;
    var lines = [];
    if (r.type === "other") {
      lines.push("기타소득 8.8% 원천징수");
      lines.push("· 지급액(세전) " + won(r.gross));
      lines.push("· 필요경비 60% " + won(r.expense) + " → 기타소득금액 " + won(r.income));
      lines.push("· 소득세 20% " + won(r.incomeTax) + " + 지방소득세 " + won(r.localTax));
      lines.push("· 원천징수 합계 " + won(r.withheld));
      lines.push("· 실수령액 " + won(r.net));
      if (r.exempt) lines.push("· 기타소득금액 5만원 이하 — 원천징수 0원");
    } else {
      lines.push("사업소득 3.3% 원천징수");
      lines.push("· 지급액(세전) " + won(r.gross));
      lines.push("· 소득세 3% " + won(r.incomeTax) + " + 지방소득세 0.3% " + won(r.localTax));
      lines.push("· 원천징수 합계 " + won(r.withheld) + " (" + (r.rate * 100).toFixed(1) + "%)");
      lines.push("· 실수령액 " + won(r.net));
    }
    if (state.annual && state.annual.gross > 0) {
      lines.push("");
      lines.push("5월 종합소득세 간이 추정 (연 수입 " + won(state.annual.gross) + ")");
      lines.push("· 필요경비 " + won(state.annual.expense) + " → 소득금액 " + won(state.annual.income));
      lines.push("· 과세표준 " + won(state.annual.taxable));
      lines.push("· 산출세액 " + won(state.annual.computedTax) + " + 지방소득세 " + won(state.annual.localTax));
      lines.push("· 기납부(3.3%) " + won(state.annual.prepaid));
      lines.push(
        state.annual.diff >= 0
          ? "· 추가 납부 약 " + won(state.annual.diff)
          : "· 환급 예상 약 " + won(-state.annual.diff)
      );
    }
    lines.push("도토리 툴즈 · 2026년 11월 기준");
    return lines.join("\n");
  }

  return {
    C: C,
    BRACKETS: BRACKETS,
    JOB_PRESETS: JOB_PRESETS,
    num: num,
    comma: comma,
    won: won,
    floor10: floor10,
    incomeTax: incomeTax,
    marginalRate: marginalRate,
    business: business,
    other: other,
    calc: calc,
    solveNet: solveNet,
    roundUpTo: roundUpTo,
    annualSettle: annualSettle,
    summary: summary
  };
});
