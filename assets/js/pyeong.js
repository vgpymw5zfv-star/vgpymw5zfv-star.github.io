/* ==========================================================================
   평수 · 전용면적 ㎡ 변환 계산기 — 순수 계산 코어
   - 1평 = 400/121 ㎡ (3.305785…㎡), 1㎡ = 0.3025평
   - 전용률(전용면적 ÷ 공급면적)로 공급면적·주거공용면적 추정
   - 평당 가격, 정사각 환산 한 변 길이
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriPyeong = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* 1평 = 400/121 ㎡ — 계량 단위 환산의 정의값 */
  var SQM_PER_PYEONG = 400 / 121;

  var RATE_PRESETS = [
    { key: "stairs", label: "계단식 아파트", rate: 0.78 },
    { key: "corridor", label: "복도식·구축", rate: 0.72 },
    { key: "mixed", label: "주상복합", rate: 0.68 }
  ];

  function num(value, fallback) {
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "string") {
      var cleaned = value.replace(/[,\s㎡평원]/g, "");
      if (cleaned === "") return fallback;
      var n = Number(cleaned);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function comma(n, digits) {
    if (typeof n !== "number" || !isFinite(n)) n = 0;
    var d = typeof digits === "number" ? digits : 0;
    return n.toLocaleString("ko-KR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }

  function won(n) {
    return comma(n) + "원";
  }

  /* ㎡ → 평 (소수 둘째 자리) */
  function sqmToPyeong(sqm) {
    return sqm / SQM_PER_PYEONG;
  }

  /* 평 → ㎡ */
  function pyeongToSqm(pyeong) {
    return pyeong * SQM_PER_PYEONG;
  }

  /* 전용률(%)을 0~1 비율로 */
  function rateRatio(percent) {
    var p = num(percent, 75);
    if (p > 1) p = p / 100;
    if (!isFinite(p) || p <= 0) p = 0.75;
    if (p > 1) p = 1;
    return p;
  }

  /* 전용면적 → 공급면적·주거공용면적 */
  function supplyOf(exclusiveSqm, percent) {
    var rate = rateRatio(percent);
    var supply = exclusiveSqm / rate;
    return {
      rate: rate,
      exclusive: exclusiveSqm,
      supply: supply,
      shared: Math.max(0, supply - exclusiveSqm)
    };
  }

  /* 공급면적 → 전용면적 */
  function exclusiveOf(supplySqm, percent) {
    var rate = rateRatio(percent);
    return {
      rate: rate,
      supply: supplySqm,
      exclusive: supplySqm * rate,
      shared: Math.max(0, supplySqm - supplySqm * rate)
    };
  }

  /* 평당 가격 — 기준 면적(㎡)과 총액(원) */
  function pricePerPyeong(totalPrice, areaSqm) {
    if (!(totalPrice > 0) || !(areaSqm > 0)) return 0;
    return totalPrice / sqmToPyeong(areaSqm);
  }

  /* 같은 넓이의 정사각 한 변 길이(m) */
  function squareSide(sqm) {
    if (!(sqm > 0)) return 0;
    return Math.sqrt(sqm);
  }

  /* 공급면적(㎡)의 평형 표기 — 평을 반올림한 정수 */
  function pyeongType(supplySqm) {
    if (!(supplySqm > 0)) return 0;
    return Math.round(sqmToPyeong(supplySqm));
  }

  function summary(state) {
    var lines = ["면적 환산 (" + state.basisLabel + " 기준)"];
    lines.push("· " + comma(state.sqm, 1) + "㎡ = " + comma(state.pyeong, 2) + "평");
    if (state.supply > 0) {
      lines.push(
        "· 공급면적 " +
          comma(Math.round(state.supply)) +
          "㎡ (" +
          comma(sqmToPyeong(state.supply), 1) +
          "평, " +
          pyeongType(state.supply) +
          "평형 추정)"
      );
    }
    lines.push("· 전용률 " + comma(state.rate * 100, 1) + "%");
    if (state.price > 0 && state.pricePerPyeong > 0) {
      lines.push("· 평당 " + won(state.pricePerPyeong));
    }
    return lines.join("\n");
  }

  return {
    SQM_PER_PYEONG: SQM_PER_PYEONG,
    RATE_PRESETS: RATE_PRESETS,
    num: num,
    comma: comma,
    won: won,
    sqmToPyeong: sqmToPyeong,
    pyeongToSqm: pyeongToSqm,
    rateRatio: rateRatio,
    supplyOf: supplyOf,
    exclusiveOf: exclusiveOf,
    pricePerPyeong: pricePerPyeong,
    squareSide: squareSide,
    pyeongType: pyeongType,
    summary: summary
  };
});
