/* ==========================================================================
   K-패스 vs 기후동행카드 교통비 손익분기 계산기
   근거: K-패스(국토교통부·한국교통안전공단), 기후동행카드(서울시), 2026년 기준
   - K-패스: 월 15회 이상 이용 시 환급, 월 최대 60회까지
     일반 20% / 청년(만 19~34세) 30% / 다자녀 2자녀 30% / 3자녀 이상 50% / 저소득 53%
   - 기후동행카드: 65,000원(따릉이 포함) / 62,000원(미포함),
     청년권 58,000원 / 55,000원
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriTransit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var C = Core.CONST;

  var TYPES = {
    general: { label: "일반 (20%)", rate: 0.2, youth: false, multi: 0 },
    youth: { label: "청년 만 19~34세 (30%)", rate: 0.3, youth: true, multi: 0 },
    multi2: { label: "다자녀 2자녀 (30%)", rate: 0.3, youth: false, multi: 2 },
    multi3: { label: "다자녀 3자녀 이상 (50%)", rate: 0.5, youth: false, multi: 3 },
    low: { label: "저소득층 (53%)", rate: 0.53, youth: false, multi: 0 }
  };

  function climateFee(type, bike) {
    var isYouth = type === "youth";
    if (isYouth) return bike ? C.CLIMATE_CARD.youthWithBike : C.CLIMATE_CARD.youthOnly;
    return bike ? C.CLIMATE_CARD.adultWithBike : C.CLIMATE_CARD.adultOnly;
  }

  /**
   * 월 이용 횟수 기준 단순 비교 (예시 표에서도 사용)
   * @param {number} trips 월 편도 이용 횟수
   * @param {number} fare 1회 요금
   * @param {number} rate 환급률 (0.2 등)
   * @param {number} fee 기후동행카드 월정액
   */
  function byTrips(trips, fare, rate, fee) {
    var n = Math.max(0, Core.num(trips, 0, 0, 1000));
    var f = Math.max(0, Core.num(fare, 0, 0, 10000));
    var r = Core.clamp(Core.num(rate, 0, 0, 1), 0, 1);
    var monthlyFee = Math.max(0, Core.num(fee, 0, 0, 1000000));

    var cost = Math.round(n * f);
    var eligible = n >= C.KPASS_MIN_TRIPS;
    var refund = eligible
      ? Math.round(Math.min(n, C.KPASS_MAX_TRIPS) * f * r)
      : 0;
    var kpassPay = cost - refund;
    var climatePay = Math.min(cost, monthlyFee);
    var cheaper = "same";
    if (kpassPay < climatePay) cheaper = "kpass";
    else if (climatePay < kpassPay) cheaper = "climate";

    return {
      trips: Math.round(n),
      cost: cost,
      eligible: eligible,
      refund: refund,
      kpassPay: kpassPay,
      climatePay: climatePay,
      cheaper: cheaper,
      diff: Math.abs(kpassPay - climatePay)
    };
  }

  /**
   * @param {object} input
   *  workDays    주간 출퇴근 일수 (주 5일 기준)
   *  roundTrips  평일 하루 왕복 횟수
   *  fare        1회 기본요금(원)
   *  weekendTrips 주말 이용 횟수(주당, 편도 기준)
   *  type        'general' | 'youth' | 'multi2' | 'multi3' | 'low'
   *  bike        따릉이 포함 여부
   *  seoulArea   서울 생활권 여부
   */
  function compute(input) {
    var opts = input || {};
    var workDays = Core.num(opts.workDays, 5, 0, 7);
    var roundTrips = Core.num(opts.roundTrips, 1, 0, 6);
    var fare = Core.num(opts.fare, 1550, 0, 10000);
    var weekendTrips = Core.num(opts.weekendTrips, 0, 0, 40);
    var type = TYPES[opts.type] ? opts.type : "general";
    var typeInfo = TYPES[type];
    var bike = !!opts.bike;
    var seoulArea = opts.seoulArea === undefined ? true : !!opts.seoulArea;

    /* 주간 편도 이용 횟수 → 월 환산 (52주 ÷ 12개월) */
    var weeklyTrips = workDays * roundTrips * 2 + weekendTrips;
    var monthlyTripsRaw = weeklyTrips * C.WEEKS_PER_MONTH;
    var monthlyTrips = Math.round(monthlyTripsRaw);

    var fee = climateFee(type, bike);
    var base = byTrips(monthlyTrips, fare, typeInfo.rate, fee);

    var totalCost = base.cost;
    var kpassEligible = base.eligible;
    var refundableTrips = Math.min(monthlyTrips, C.KPASS_MAX_TRIPS);
    var kpassRefund = base.refund;
    var kpassPay = base.kpassPay;
    var kpassEffectiveRate = totalCost > 0 ? kpassRefund / totalCost : 0;

    var climatePay = base.climatePay;
    var climateSaving = totalCost - climatePay;

    /* ---- 비교 ---- */
    var cheaper = "same";
    var bestSaving = 0;
    var diff = Math.abs(kpassPay - climatePay);

    if (kpassPay < climatePay) {
      cheaper = "kpass";
      bestSaving = diff;
    } else if (climatePay < kpassPay) {
      cheaper = "climate";
      bestSaving = diff;
    } else {
      cheaper = "same";
    }

    var warnings = [];
    if (!kpassEligible) {
      warnings.push(
        "월 이용 횟수가 " + monthlyTrips + "회로 K-패스 기준(월 15회)에 미달해 환급이 없습니다."
      );
    }
    if (monthlyTrips > C.KPASS_MAX_TRIPS) {
      warnings.push(
        "K-패스는 월 60회까지만 환급됩니다. 60회를 넘는 " +
          (monthlyTrips - 60) +
          "회는 환급 대상에서 제외했습니다."
      );
    }
    if (!seoulArea) {
      warnings.push(
        "기후동행카드는 서울 지하철·버스 기준입니다. 경기·인천 구간을 함께 이용하면 별도 요금이 붙어 실제 절약액이 줄어듭니다."
      );
    }
    if (bike) {
      warnings.push(
        "따릉이 포함 요금제는 1시간 이용 기준 무제한입니다. 이용이 적으면 미포함 요금제가 유리합니다."
      );
    }
    if (totalCost < fee && seoulArea) {
      warnings.push(
        "월 교통비 원금(" +
          Core.won(totalCost) +
          ")이 기후동행카드 월정액(" +
          Core.won(fee) +
          ")보다 적어 카드 구매가 오히려 손해입니다."
      );
    }

    return {
      weeklyTrips: weeklyTrips,
      monthlyTrips: monthlyTrips,
      totalCost: totalCost,
      fare: fare,
      type: type,
      typeLabel: typeInfo.label,
      rate: typeInfo.rate,
      kpassEligible: kpassEligible,
      refundableTrips: refundableTrips,
      kpassRefund: kpassRefund,
      kpassPay: kpassPay,
      kpassEffectiveRate: kpassEffectiveRate,
      climateFee: fee,
      climatePay: climatePay,
      climateSaving: climateSaving,
      cheaper: cheaper,
      bestSaving: bestSaving,
      monthlyBestSaving: bestSaving,
      yearlyBestSaving: bestSaving * 12,
      seoulArea: seoulArea,
      bike: bike,
      warnings: warnings,
      /* 기후동행카드 손익분기: 월정액 ÷ 요금 = 필요한 월 이용 횟수 */
      breakEvenTrips: fare > 0 ? Math.ceil(fee / fare) : 0
    };
  }

  return {
    compute: compute,
    byTrips: byTrips,
    TYPES: TYPES,
    climateFee: climateFee
  };
});
