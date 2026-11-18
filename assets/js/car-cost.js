/* ==========================================================================
   내 차 유지비 vs 대중교통(K-패스) 비교 계산기 (순수 계산 코어, DOM 비의존)
   근거
   - 자동차세: 지방세법 §127① (비영업용 승용차 1,000cc 이하 80원 / 1,600cc 이하 140원 /
     1,600cc 초과 200원 per cc), §127①3호·§151 (전기·수소 승용차 정액 10만원 + 지방교육세 30%)
   - 차령 경감: 지방세법 §127② — 3년차부터 매년 5%, 12년 이상 50% 한도
   - 연납 공제: 지방세법 §128③ — 1월 4.58% / 3월 3.76% / 6월 2.51% / 9월 1.25%
   - 유가: 오피넷(opinet.co.kr) 2026년 11월 18일 전국 평균 (휘발유 1,854.61원/L 등)
   - K-패스: 국토교통부 — 일반 20% / 청년 30% / 다자녀 2자녀 30% / 3자녀 50% / 저소득 53%,
     월 60회까지 환급
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriCarCost = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var CONST = {
    /* 2026년 11월 18일 오피넷 전국 평균 */
    FUEL_PRICE: {
      gasoline: 1855,
      diesel: 1842,
      lpg: 1177,
      premium: 2369,
      hybrid: 1855,
      electric: 320
    },
    FUELS: {
      gasoline: { label: "휘발유", unit: "원/L", effUnit: "km/L", eff: 12 },
      diesel: { label: "경유", unit: "원/L", effUnit: "km/L", eff: 14 },
      lpg: { label: "LPG", unit: "원/L", effUnit: "km/L", eff: 9 },
      premium: { label: "고급휘발유", unit: "원/L", effUnit: "km/L", eff: 11 },
      hybrid: { label: "하이브리드(휘발유)", unit: "원/L", effUnit: "km/L", eff: 18 },
      electric: { label: "전기", unit: "원/kWh", effUnit: "km/kWh", eff: 5.5 }
    },
    CC_RATES: [
      { max: 1000, rate: 80 },
      { max: 1600, rate: 140 },
      { max: Infinity, rate: 200 }
    ],
    EV_TAX: 100000,
    EDU_RATE: 0.3,
    AGE_DISCOUNT: 0.05,
    AGE_MAX: 0.5,
    PREPAY: {
      none: { label: "미적용", rate: 0 },
      jan: { label: "1월 연납 (4.58%)", rate: 0.0458 },
      mar: { label: "3월 연납 (3.76%)", rate: 0.0376 },
      jun: { label: "6월 연납 (2.51%)", rate: 0.0251 },
      sep: { label: "9월 연납 (1.25%)", rate: 0.0125 }
    },
    KPASS: {
      general: { label: "일반 20%", rate: 0.2 },
      youth: { label: "청년 30%", rate: 0.3 },
      multi2: { label: "다자녀 2자녀 30%", rate: 0.3 },
      multi3: { label: "다자녀 3자녀 이상 50%", rate: 0.5 },
      low: { label: "저소득 53%", rate: 0.53 }
    },
    KPASS_MAX_TRIPS: 60,
    DEFAULT_FARE: 1550,
    DEFAULT_TAXI_FARE: 12000,
    DEFAULT_TRANSIT: 66650
  };

  /** 차령 경감 계수 — 3년차부터 5%/년, 12년 이상 50% */
  function ageFactor(ageYears) {
    var age = Math.max(0, Core.num(ageYears, 0, 0, 50));
    return Math.max(
      CONST.AGE_MAX,
      1 - Math.max(0, Math.floor(age) - 2) * CONST.AGE_DISCOUNT
    );
  }

  /** cc당 세율 */
  function ccRate(displacement) {
    var cc = Math.max(0, Core.num(displacement, 0, 0, 10000));
    for (var i = 0; i < CONST.CC_RATES.length; i += 1) {
      if (cc <= CONST.CC_RATES[i].max) return CONST.CC_RATES[i].rate;
    }
    return 0;
  }

  /**
   * 연간 자동차세 (자동차세 + 지방교육세, 연납 공제 반영)
   * @param {object} o { fuelType, displacement, ageYears, prepay }
   */
  function vehicleTax(o) {
    var opts = o || {};
    var isEv = opts.fuelType === "electric";
    var cc = isEv ? 0 : Math.max(0, Core.num(opts.displacement, 1598, 0, 10000));
    var rate = isEv ? 0 : ccRate(cc);
    var factor = isEv ? 1 : ageFactor(opts.ageYears);
    var taxBase = isEv ? CONST.EV_TAX : Math.floor(cc * rate);
    var autoTax = Math.floor(taxBase * factor);
    var eduTax = Math.floor(autoTax * CONST.EDU_RATE);
    var total = autoTax + eduTax;

    var key = CONST.PREPAY[opts.prepay] ? opts.prepay : "none";
    var discountRate = CONST.PREPAY[key].rate;
    var discount = Math.floor(total * discountRate);
    var after = total - discount;

    return {
      isEv: isEv,
      cc: cc,
      ccRate: rate,
      ageYears: Math.max(0, Math.floor(Core.num(opts.ageYears, 0, 0, 50))),
      ageFactor: factor,
      ageDiscountRate: 1 - factor,
      taxBase: taxBase,
      autoTax: autoTax,
      eduTax: eduTax,
      total: total,
      prepay: key,
      prepayLabel: CONST.PREPAY[key].label,
      prepayDiscount: discount,
      afterPrepay: after,
      monthly: after / 12
    };
  }

  /** K-패스 환급 (월 교통비 기준, 월 60회 한도 근사) */
  function kpassRefund(transitWon, type, fare) {
    var cost = Math.max(0, Core.num(transitWon, 0, 0, 10000000));
    var key = CONST.KPASS[type] ? type : "general";
    var unitFare = Math.max(1, Core.num(fare, CONST.DEFAULT_FARE, 100, 10000));
    var limit = CONST.KPASS_MAX_TRIPS * unitFare;
    var eligible = Math.min(cost, limit);
    var refund = Math.round(eligible * CONST.KPASS[key].rate);
    return {
      type: key,
      label: CONST.KPASS[key].label,
      rate: CONST.KPASS[key].rate,
      refund: refund,
      amount: cost - refund,
      fullRefund: cost <= limit,
      capped: cost > limit
    };
  }

  /**
   * @param {object} input
   *  fuelType, displacement, ageYears, efficiency, fuelPrice
   *  monthlyKm, parkingTollWon, insuranceYearWon, maintenanceYearWon
   *  includeLoan(bool), loanMonthlyWon
   *  prepay
   *  transitWon, kpassType, fare, taxiFare
   */
  function compute(input) {
    var o = input || {};
    var fuelType = CONST.FUELS[o.fuelType] ? o.fuelType : "gasoline";
    var fuelInfo = CONST.FUELS[fuelType];
    var efficiency = Math.max(0.1, Core.num(o.efficiency, fuelInfo.eff, 0.1, 60));
    var fuelPrice = Math.max(1, Core.num(o.fuelPrice, CONST.FUEL_PRICE[fuelType], 1, 10000));
    var monthlyKm = Math.max(0, Core.num(o.monthlyKm, 1000, 0, 20000));
    var parking = Math.max(0, Core.num(o.parkingTollWon, 0, 0, 5000000));
    var insurance = Math.max(0, Core.num(o.insuranceYearWon, 900000, 0, 20000000));
    var maintenance = Math.max(0, Core.num(o.maintenanceYearWon, 600000, 0, 20000000));
    var includeLoan = !!o.includeLoan;
    var loan = includeLoan ? Math.max(0, Core.num(o.loanMonthlyWon, 0, 0, 10000000)) : 0;

    var taxInfo = vehicleTax({
      fuelType: fuelType,
      displacement: o.displacement,
      ageYears: o.ageYears,
      prepay: o.prepay
    });

    var fuelMonthly = monthlyKm / efficiency * fuelPrice;
    var taxMonthly = taxInfo.monthly;
    var insuranceMonthly = insurance / 12;
    var maintenanceMonthly = maintenance / 12;

    var total = fuelMonthly + taxMonthly + insuranceMonthly + maintenanceMonthly + parking + loan;
    var totalRounded = Math.round(total);
    var perKm = monthlyKm > 0 ? total / monthlyKm : 0;

    var transitWon = Math.max(0, Core.num(o.transitWon, CONST.DEFAULT_TRANSIT, 0, 5000000));
    var kpass = kpassRefund(transitWon, o.kpassType, o.fare);
    var taxiFare = Math.max(1000, Core.num(o.taxiFare, CONST.DEFAULT_TAXI_FARE, 1000, 200000));

    var monthlyDiff = Math.round(total) - kpass.amount;
    var cheaper = "same";
    if (monthlyDiff > 0) cheaper = "transit";
    else if (monthlyDiff < 0) cheaper = "car";

    var warnings = [];
    if (taxInfo.isEv) {
      warnings.push(
        "전기·수소 승용차 자동차세는 배기량이 아니라 정액(자동차세 10만원 + 지방교육세 3만원)이며 차령 경감이 적용되지 않습니다."
      );
    }
    if (monthlyKm > 4000) {
      warnings.push("월 주행거리가 4,000km를 넘습니다. 렌트·리스나 장거리 통근 조건을 다시 확인해 보세요.");
    }
    if (monthlyKm === 0) {
      warnings.push("월 주행거리가 0km면 연료비가 0원으로 계산됩니다. 보험·세금·정비 같은 고정비만 남습니다.");
    }
    warnings.push(
      "감가상각, 구매·취득세, 자동차보험 할인·할증, 세차·범칙금은 포함하지 않았습니다. 실제 차량 비용은 여기에 감가상각(연 차값의 10% 안팎)이 더해집니다."
    );
    if (kpass.capped) {
      warnings.push(
        "K-패스는 월 60회(" +
          Core.won(CONST.KPASS_MAX_TRIPS * Math.max(1, Core.num(o.fare, CONST.DEFAULT_FARE, 100, 10000))) +
          ")까지만 환급됩니다. 그보다 많이 쓰면 초과분은 환급 대상이 아닙니다."
      );
    }

    return {
      fuelType: fuelType,
      fuelLabel: fuelInfo.label,
      fuelUnit: fuelInfo.unit,
      efficiency: efficiency,
      effUnit: fuelInfo.effUnit,
      fuelPrice: fuelPrice,
      monthlyKm: monthlyKm,
      fuelMonthly: Math.round(fuelMonthly),
      tax: taxInfo,
      taxMonthly: Math.round(taxMonthly),
      insuranceMonthly: Math.round(insuranceMonthly),
      maintenanceMonthly: Math.round(maintenanceMonthly),
      parking: Math.round(parking),
      loan: Math.round(loan),
      includeLoan: includeLoan,
      total: totalRounded,
      yearly: totalRounded * 12,
      fiveYear: totalRounded * 60,
      perKm: perKm,
      transit: {
        cost: transitWon,
        refund: kpass.refund,
        amount: kpass.amount,
        type: kpass.type,
        label: kpass.label,
        rate: kpass.rate,
        yearly: kpass.amount * 12,
        fiveYear: kpass.amount * 60
      },
      monthlyDiff: Math.abs(monthlyDiff),
      yearlyDiff: Math.abs(monthlyDiff) * 12,
      fiveYearDiff: Math.abs(monthlyDiff) * 60,
      cheaper: cheaper,
      taxiFare: taxiFare,
      taxiRides: monthlyDiff > 0 ? Math.floor(monthlyDiff / taxiFare) : 0,
      warnings: warnings
    };
  }

  /** 주행거리별 월 유지비 표 */
  function byMonthlyKm(input, list) {
    var o = input || {};
    var kms = list || [500, 1000, 1500, 2000, 3000];
    return kms.map(function (km) {
      var r = compute({
        fuelType: o.fuelType,
        displacement: o.displacement,
        ageYears: o.ageYears,
        efficiency: o.efficiency,
        fuelPrice: o.fuelPrice,
        monthlyKm: km,
        parkingTollWon: o.parkingTollWon,
        insuranceYearWon: o.insuranceYearWon,
        maintenanceYearWon: o.maintenanceYearWon,
        includeLoan: o.includeLoan,
        loanMonthlyWon: o.loanMonthlyWon,
        prepay: o.prepay,
        transitWon: o.transitWon,
        kpassType: o.kpassType,
        fare: o.fare,
        taxiFare: o.taxiFare
      });
      return {
        monthlyKm: km,
        fuelMonthly: r.fuelMonthly,
        total: r.total,
        perKm: r.perKm,
        diff: r.monthlyDiff,
        cheaper: r.cheaper
      };
    });
  }

  return {
    CONST: CONST,
    ageFactor: ageFactor,
    ccRate: ccRate,
    vehicleTax: vehicleTax,
    kpassRefund: kpassRefund,
    compute: compute,
    byMonthlyKm: byMonthlyKm
  };
});
