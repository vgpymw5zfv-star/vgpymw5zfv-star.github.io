/* ==========================================================================
   도토리 계산기 — 공통 계산 코어
   모든 계산기는 이 파일의 순수 함수만 사용합니다. (DOM 의존 없음)
   Node 테스트에서 require()로 그대로 불러 쓸 수 있습니다.
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------------- 숫자 · 포맷 ---------------- */

  /** 안전한 숫자 변환: 빈값/문자/NaN → fallback, 범위 제한 */
  function num(value, fallback, min, max) {
    var n;
    if (typeof value === "number") {
      n = value;
    } else if (typeof value === "string") {
      var cleaned = value.replace(/[,\s원만억원대]/g, "");
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

  function clamp(n, min, max) {
    if (typeof n !== "number" || !isFinite(n)) return min;
    return Math.min(Math.max(n, min), max);
  }

  /** 1,234,567 형태 */
  function comma(n) {
    if (typeof n !== "number" || !isFinite(n)) n = 0;
    return Math.round(n).toLocaleString("ko-KR");
  }

  /** 1,234,567원 */
  function won(n) {
    return comma(n) + "원";
  }

  /** 만원 단위 → "220만 원" / "1억 2,300만 원" */
  function manLabel(manwon, digits) {
    var v = typeof manwon === "number" && isFinite(manwon) ? manwon : 0;
    var d = typeof digits === "number" ? digits : 0;
    var rounded = d > 0 ? Math.round(v * Math.pow(10, d)) / Math.pow(10, d) : Math.round(v);
    var sign = rounded < 0 ? "-" : "";
    var abs = Math.abs(rounded);
    var eok = Math.floor(abs / 10000);
    var rest = abs - eok * 10000;
    var out = "";
    if (eok > 0) out += comma(eok) + "억 ";
    if (rest > 0 || eok === 0) {
      out += (d > 0 ? rest.toFixed(d) : comma(rest)) + "만 ";
    }
    return sign + out + "원";
  }

  /** 10원 미만 절사 */
  function floor10(n) {
    return Math.floor(n / 10) * 10;
  }

  /* ---------------- 소득세 기본 계산 ----------------
     2026년 귀속 기준 (소득세법 §47·§55, 조세특례제한법 §30)
     단위: 만원. 부양가족·4대보험·연금계좌 등은 반영하지 않은 '간이 추정'.
     ---------------------------------------------------- */

  /** 근로소득공제 (만원) */
  function earnedIncomeDeduction(grossMan) {
    var g = Math.max(0, grossMan || 0);
    var d;
    if (g <= 500) d = g * 0.7;
    else if (g <= 1500) d = 350 + (g - 500) * 0.4;
    else if (g <= 4500) d = 750 + (g - 1500) * 0.15;
    else if (g <= 10000) d = 1200 + (g - 4500) * 0.05;
    else d = 1475 + (g - 10000) * 0.02;
    return Math.min(d, g);
  }

  /** 기본세율 구간 (만원) */
  var BRACKETS = [
    { upTo: 1400, rate: 0.06, progressive: 0 },
    { upTo: 5000, rate: 0.15, progressive: 126 },
    { upTo: 8800, rate: 0.24, progressive: 576 },
    { upTo: 15000, rate: 0.35, progressive: 1544 },
    { upTo: 30000, rate: 0.38, progressive: 1994 },
    { upTo: 50000, rate: 0.4, progressive: 2594 },
    { upTo: 100000, rate: 0.42, progressive: 3594 },
    { upTo: Infinity, rate: 0.45, progressive: 6594 }
  ];

  /** 산출세액 (만원) */
  function incomeTax(taxableMan) {
    var t = Math.max(0, taxableMan || 0);
    for (var i = 0; i < BRACKETS.length; i += 1) {
      if (t <= BRACKETS[i].upTo) {
        return Math.max(0, t * BRACKETS[i].rate - BRACKETS[i].progressive);
      }
    }
    return 0;
  }

  /** 한계세율 */
  function marginalRate(taxableMan) {
    var t = Math.max(0, taxableMan || 0);
    for (var i = 0; i < BRACKETS.length; i += 1) {
      if (t <= BRACKETS[i].upTo) return BRACKETS[i].rate;
    }
    return 0.45;
  }

  /** 근로소득세액공제 한도 (만원) */
  function earnedTaxCreditLimit(grossMan) {
    var g = Math.max(0, grossMan || 0);
    if (g <= 3300) return 74;
    if (g <= 7000) return Math.max(66, 74 - (g - 3300) * 0.008);
    if (g <= 12000) return Math.max(50, 66 - (g - 7000) * 0.5);
    return Math.max(20, 50 - (g - 12000) * 0.5);
  }

  /** 근로소득세액공제액 (만원) */
  function earnedTaxCredit(taxAmount, grossMan) {
    var tax = Math.max(0, taxAmount || 0);
    var credit = tax <= 130 ? tax * 0.55 : 715000 / 10000 + (tax - 130) * 0.3;
    return Math.min(credit, earnedTaxCreditLimit(grossMan));
  }

  /**
   * 총급여(만원) → 소득세 간이 추정
   * @returns {{gross, deduction, earnedIncome, basic, taxable, computedTax, credit, determined, local, total}}
   */
  function estimateIncomeTax(grossMan) {
    var gross = Math.max(0, grossMan || 0);
    var deduction = earnedIncomeDeduction(gross);
    var earnedIncome = gross - deduction;
    var basic = Math.min(150, earnedIncome);
    var taxable = Math.max(0, Math.floor(earnedIncome - basic + 1e-9));
    var computed = incomeTax(taxable);
    var credit = earnedTaxCredit(computed, gross);
    var determined = Math.max(0, computed - credit);
    var local = determined * 0.1;
    return {
      gross: gross,
      deduction: deduction,
      earnedIncome: earnedIncome,
      basic: basic,
      taxable: taxable,
      marginalRate: marginalRate(taxable),
      computedTax: computed,
      credit: credit,
      determined: determined,
      local: local,
      total: determined + local
    };
  }

  /**
   * 소득공제 1만원이 아끼는 세금(소득세+지방소득세, 만원)
   * 과세표준 구간을 넘나드는 경우까지 정확히 계산한다.
   */
  function deductionSaving(deductionMan, grossMan) {
    var est = estimateIncomeTax(grossMan);
    var before = est.taxable;
    var after = Math.max(0, Math.floor(before - Math.max(0, deductionMan || 0) + 1e-9));
    var taxBefore = incomeTax(before);
    var taxAfter = incomeTax(after);
    var saving = Math.max(0, taxBefore - taxAfter) * 1.1;
    return {
      taxSaving: Math.max(0, taxBefore - taxAfter),
      localSaving: Math.max(0, taxBefore - taxAfter) * 0.1,
      total: saving
    };
  }

  /* ---------------- 공용 상수 ---------------- */

  var CONST = {
    /* 지방소득세율 (소득세의 10%) */
    LOCAL_TAX_RATE: 0.1,
    /* 중소기업 취업자 감면 한도(연, 소득세) 200만원 */
    SME_CAP: 2000000,
    /* 주택용 전기요금 (2026년 11월, 한국전력공사 요금표)
       - 기본요금 단위: 원/호, 전력량요금 단위: 원/kWh
       - 슈퍼유저: 1,000kWh 초과분에만 적용 (하계 7~8월, 동계 12~2월) */
    KEPCO: {
      low: {
        id: "low",
        label: "주택용 저압 (원룸·빌라·단독)",
        short: "저압",
        base: [910, 1600, 7300],
        rate: [120.0, 214.6, 307.3],
        superuser: 736.2
      },
      high: {
        id: "high",
        label: "주택용 고압 (대부분 아파트)",
        short: "고압",
        base: [730, 1260, 6060],
        rate: [105.0, 174.0, 242.3],
        superuser: 593.3
      }
    },
    /* 누진 구간 경계 (kWh) — 일반 계절 200/400, 하계 300/450 */
    KEPCO_LIMITS: {
      general: [200, 400],
      summer: [300, 450]
    },
    /* 슈퍼유저(1,000kWh 초과) 적용 기준 */
    KEPCO_SUPER_LIMIT: 1000,
    /* 기존 코드 호환용 (저압·일반 계절) */
    KEPCO_TIERS: [
      { limit: 200, base: 910, rate: 120.0 },
      { limit: 400, base: 1600, rate: 214.6 },
      { limit: Infinity, base: 7300, rate: 307.3 }
    ],
    KEPCO_CLIMATE: 9.0,
    KEPCO_FUEL: 5.0,
    VAT: 0.1,
    /* 전력산업기반기금 2.7% (2025.7.1 인하 반영, 기존 3.7%) */
    FUND: 0.027,
    /* 1평 = 3.3058㎡ */
    M2_PER_PYEONG: 3.3058,
    /* K-패스 환급률 */
    KPASS_RATES: {
      general: 0.2,
      youth: 0.3,
      multi2: 0.3,
      multi3: 0.5,
      low: 0.53
    },
    KPASS_MIN_TRIPS: 15,
    KPASS_MAX_TRIPS: 60,
    WEEKS_PER_MONTH: 52 / 12,
    /* 기후동행카드 (2026) — withBike: 따릉이 포함 */
    CLIMATE_CARD: {
      adultWithBike: 65000,
      adultOnly: 62000,
      youthWithBike: 58000,
      youthOnly: 55000
    },
    /* 월세 세액공제 */
    RENT_CREDIT_CAP: 1000,
    /* AI 구독 (원/월) */
    AI_PRICES: {
      chatgpt: { free: 0, go: 13000, plus: 29000 },
      gemini: { free: 0, plus: 7500 },
      claude: { free: 0, pro: 22 },
      perplexity: { free: 0, pro: 20 }
    },
    DEFAULT_RATE: 1400
  };

  return {
    num: num,
    clamp: clamp,
    comma: comma,
    won: won,
    manLabel: manLabel,
    floor10: floor10,
    earnedIncomeDeduction: earnedIncomeDeduction,
    incomeTax: incomeTax,
    marginalRate: marginalRate,
    earnedTaxCredit: earnedTaxCredit,
    earnedTaxCreditLimit: earnedTaxCreditLimit,
    estimateIncomeTax: estimateIncomeTax,
    deductionSaving: deductionSaving,
    BRACKETS: BRACKETS,
    CONST: CONST
  };
});
