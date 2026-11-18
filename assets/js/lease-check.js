/* 도토리 툴즈 — 전세·월세 안전 계약 위험도 계산 (순수 로직)
   근거
   - 국토교통부 안심전세앱 위험도: 전세가율 80% 미만 안전 · 80~90% 주의 · 90% 초과 위험
   - HUG 전세보증금반환보증: 보증한도 = 주택가격 × 90% − 선순위채권,
     선순위채권은 주택가액(주택가격 × 90%)의 60% 이내,
     보증금 상한 수도권 7억원 · 그 외 5억원
   - 시세가 없는 주택은 공시가격의 140%를 주택가격으로 본다 → 공시가격 × 126%가 실질 한도
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DotoriLease = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var OFFICIAL_TO_MARKET = 1.4; // 공시가격 → 주택가격(시세 추정)
  var HUG_LTV = 0.9; // 담보인정비율
  var HUG_SENIOR_CAP = 0.6; // 선순위채권 / 주택가액 한도
  var SAFE = 0.8;
  var CAUTION = 0.9;
  var DEPOSIT_CAP_MAN = { metro: 70000, other: 50000 };

  function num(v, fallback) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return fallback;
    return n;
  }

  function priceFrom(input) {
    var market = num(input.marketMan, 0);
    if (input.priceMode === "official") {
      var official = num(input.officialMan, 0);
      return { priceMan: Math.round(official * OFFICIAL_TO_MARKET), officialUsed: true };
    }
    return { priceMan: market, officialUsed: false };
  }

  function levelOf(ratio) {
    if (!isFinite(ratio) || ratio <= 0) return "unknown";
    if (ratio < SAFE) return "safe";
    if (ratio <= CAUTION) return "caution";
    return "danger";
  }

  var RANK = { unknown: 0, safe: 1, caution: 2, danger: 3 };

  /** 전세가율과 부채비율(보증금+선순위) 중 더 위험한 쪽을 대표 등급으로 삼는다. */
  function worseLevel(a, b) {
    if (a === "unknown") return b;
    if (b === "unknown") return a;
    return RANK[a] >= RANK[b] ? a : b;
  }

  function compute(input) {
    input = input || {};
    var depositMan = num(input.depositMan, 0);
    var seniorMan = num(input.seniorMan, 0);
    var region = input.region === "other" ? "other" : "metro";
    var p = priceFrom(input);
    var priceMan = p.priceMan;

    var ratio = priceMan > 0 ? depositMan / priceMan : 0;
    var debtRatio = priceMan > 0 ? (depositMan + seniorMan) / priceMan : 0;
    var seniorRatio = priceMan > 0 ? seniorMan / priceMan : 0;
    var houseValueMan = priceMan * HUG_LTV;
    var seniorLimitMan = houseValueMan * HUG_SENIOR_CAP; // 선순위 한도
    var depositCapMan = DEPOSIT_CAP_MAN[region];

    var overDepositCap = depositMan > depositCapMan;
    var overDebt = depositMan + seniorMan > houseValueMan + 0.5;
    var overSenior = seniorMan > seniorLimitMan + 0.5;
    var hugOk = priceMan > 0 && !overDepositCap && !overDebt && !overSenior;

    // 공시가격 기준일 때 실제 가입 한계선(공시가 × 126%)
    var officialLimitMan = p.officialUsed
      ? Math.floor(num(input.officialMan, 0) * OFFICIAL_TO_MARKET * HUG_LTV)
      : null;

    var reasons = [];
    if (priceMan <= 0) {
      reasons.push("주택 시세(또는 공시가격)를 입력해야 위험도를 계산할 수 있습니다.");
    } else {
      if (overDepositCap) {
        reasons.push(
          "보증금이 HUG 보증금 상한(" +
            (region === "metro" ? "수도권 7억원" : "그 외 지역 5억원") +
            ")을 넘습니다."
        );
      }
      if (overDebt) {
        reasons.push(
          "보증금과 선순위 채권의 합이 주택가격의 90%(약 " +
            Math.round(houseValueMan).toLocaleString("ko-KR") +
            "만원)을 넘어 HUG 보증 가입이 어렵습니다."
        );
      }
      if (overSenior) {
        reasons.push(
          "선순위 채권이 주택가액의 60%(약 " +
            Math.round(seniorLimitMan).toLocaleString("ko-KR") +
            "만원)을 넘습니다."
        );
      }
      if (debtRatio > CAUTION) {
        reasons.push("보증금+선순위 비율이 90%를 넘습니다 — 깡통전세 위험 구간입니다.");
      } else if (debtRatio >= SAFE) {
        reasons.push("보증금+선순위 비율이 80~90% 구간입니다 — 주의가 필요한 계약입니다.");
      }
      if (officialLimitMan !== null && depositMan > officialLimitMan) {
        reasons.push(
          "공시가격 126% 기준(약 " +
            officialLimitMan.toLocaleString("ko-KR") +
            "만원)을 넘습니다. 시세가 없는 빌라·다가구는 보증 가입이 거절될 수 있습니다."
        );
      }
    }

    return {
      priceMan: priceMan,
      depositMan: depositMan,
      seniorMan: seniorMan,
      ratio: ratio,
      debtRatio: debtRatio,
      seniorRatio: seniorRatio,
      level: worseLevel(levelOf(ratio), levelOf(debtRatio)),
      debtLevel: levelOf(debtRatio),
      hugOk: hugOk,
      hugLimitMan: Math.round(houseValueMan - seniorMan),
      seniorLimitMan: Math.round(seniorLimitMan),
      depositCapMan: depositCapMan,
      officialUsed: p.officialUsed,
      officialLimitMan: officialLimitMan,
      region: region,
      reasons: reasons
    };
  }

  return {
    compute: compute,
    HUG_LTV: HUG_LTV,
    HUG_SENIOR_CAP: HUG_SENIOR_CAP,
    SAFE: SAFE,
    CAUTION: CAUTION,
    DEPOSIT_CAP_MAN: DEPOSIT_CAP_MAN,
    OFFICIAL_TO_MARKET: OFFICIAL_TO_MARKET
  };
});
