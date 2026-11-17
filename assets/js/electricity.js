/* ==========================================================================
   자취 원룸 전기세 · 누진제 계산기
   근거: 한국전력공사 주택용(저압) 전기요금표, 2026년 기준
   - 기본요금 910 / 1,600 / 7,300원 (200kWh 이하 / 201~400 / 400 초과)
   - 전력량요금 120.0 / 214.6 / 307.3원/kWh
   - 기후환경요금 9원/kWh, 연료비조정요금 5원/kWh
   - 부가가치세 10%, 전력산업기반기금 3.7%, 10원 미만 절사
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriElec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var C = Core.CONST;
  var TIERS = C.KEPCO_TIERS;

  function tierIndex(kwh) {
    if (kwh <= 200) return 0;
    if (kwh <= 400) return 1;
    return 2;
  }

  function tierLabel(kwh) {
    var idx = tierIndex(kwh);
    if (idx === 0) return "1구간 (200kWh 이하)";
    if (idx === 1) return "2구간 (201~400kWh)";
    return "3구간 (400kWh 초과)";
  }

  /**
   * 사용량(kWh) → 청구서 구성
   * @param {number} kwhRaw
   * @returns {object} 원 단위 요금 내역
   */
  function bill(kwhRaw) {
    var kwh = Math.max(0, Core.num(kwhRaw, 0, 0, 100000));
    var idx = tierIndex(kwh);
    var prevLimit = 0;
    var parts = [];
    var energy = 0;

    for (var i = 0; i < TIERS.length; i += 1) {
      var limit = TIERS[i].limit === Infinity ? kwh : Math.min(kwh, TIERS[i].limit);
      var used = Math.max(0, limit - prevLimit);
      if (used > 0) {
        var amount = used * TIERS[i].rate;
        energy += amount;
        parts.push({
          tier: i + 1,
          kwh: used,
          rate: TIERS[i].rate,
          amount: Math.round(amount)
        });
      }
      prevLimit = TIERS[i].limit;
      if (kwh <= TIERS[i].limit) break;
    }

    var base = TIERS[idx].base;
    var climate = kwh * C.KEPCO_CLIMATE;
    var fuel = kwh * C.KEPCO_FUEL;
    var subtotal = base + energy + climate + fuel;
    var vat = subtotal * C.VAT;
    var fund = subtotal * C.FUND;
    var total = Core.floor10(subtotal + vat + fund);

    return {
      kwh: kwh,
      tier: idx + 1,
      tierLabel: tierLabel(kwh),
      base: base,
      energy: Math.round(energy),
      climate: Math.round(climate),
      fuel: Math.round(fuel),
      subtotal: Math.round(subtotal),
      vat: Math.round(vat),
      fund: Math.round(fund),
      total: total,
      parts: parts,
      /* kWh당 실질 단가 (부가세·기금 포함) */
      unitPrice: kwh > 0 ? total / kwh : 0
    };
  }

  /**
   * 월 청구액(원) → 사용량(kWh) 역추산
   * 청구서 금액과 가장 가까운 정수 kWh를 이분 탐색으로 찾는다.
   */
  function kwhFromBill(billWonRaw) {
    var target = Math.max(0, Core.num(billWonRaw, 0, 0, 100000000));
    if (target <= 0) return { kwh: 0, bill: bill(0), diff: 0, exact: true };

    var lo = 0;
    var hi = 3000; /* 3,000kWh까지 탐색 (가정용 상한) */
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (bill(mid).total < target) lo = mid + 1;
      else hi = mid;
    }
    var candidates = [Math.max(0, lo - 1), lo, lo + 1];
    var best = candidates[0];
    var bestDiff = Math.abs(bill(candidates[0]).total - target);
    for (var i = 1; i < candidates.length; i += 1) {
      var diff = Math.abs(bill(candidates[i]).total - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidates[i];
      }
    }
    return {
      kwh: best,
      bill: bill(best),
      diff: bill(best).total - target,
      exact: bestDiff < 10
    };
  }

  /**
   * @param {object} input
   *  mode        'kwh' | 'bill'
   *  usageKwh    기존 월 사용량
   *  billWon     기존 월 청구액
   *  watts       추가 가전 소비전력 (W)
   *  hours       하루 사용시간
   *  days        월 사용일수
   */
  function compute(input) {
    var opts = input || {};
    var mode = opts.mode === "bill" ? "bill" : "kwh";
    var resolved;

    if (mode === "bill") {
      resolved = kwhFromBill(opts.billWon);
    } else {
      var kwh = Core.num(opts.usageKwh, 0, 0, 100000);
      resolved = { kwh: kwh, bill: bill(kwh), diff: 0, exact: true };
    }

    var baseKwh = resolved.kwh;
    var before = resolved.bill;

    var watts = Core.num(opts.watts, 0, 0, 10000);
    var hours = Core.num(opts.hours, 0, 0, 24);
    var days = Core.num(opts.days, 0, 0, 31);

    var addKwhRaw = (watts * hours * days) / 1000;
    var addKwh = Math.round(addKwhRaw * 10) / 10;
    var afterKwh = Math.round((baseKwh + addKwhRaw) * 10) / 10;
    var after = bill(afterKwh);

    var extraBill = Math.max(0, after.total - before.total);
    var beforeTier = tierIndex(baseKwh);
    var afterTier = tierIndex(afterKwh);
    var jumped = afterTier > beforeTier;

    /* 추가분만의 실질 단가 */
    var extraUnit = addKwhRaw > 0 ? extraBill / addKwhRaw : 0;
    /* 같은 구간 한계 단가 (구간 요금 + 기후·연료 + 부가세·기금) */
    var marginalRate = TIERS[beforeTier].rate + C.KEPCO_CLIMATE + C.KEPCO_FUEL;
    var marginalUnit = marginalRate * (1 + C.VAT + C.FUND);

    return {
      mode: mode,
      baseKwh: baseKwh,
      baseKwhRounded: Math.round(baseKwh * 10) / 10,
      before: before,
      addKwh: addKwh,
      addKwhRaw: addKwhRaw,
      afterKwh: afterKwh,
      after: after,
      extraBill: extraBill,
      extraUnit: extraUnit,
      marginalRate: marginalRate,
      marginalUnit: marginalUnit,
      beforeTier: beforeTier + 1,
      afterTier: afterTier + 1,
      beforeTierLabel: tierLabel(baseKwh),
      afterTierLabel: tierLabel(afterKwh),
      jumped: jumped,
      yearlyExtra: extraBill * 12,
      /* 게이지 표시용 (500kWh를 100%로) */
      gaugePercent: Core.clamp((afterKwh / 500) * 100, 0, 100),
      gaugeBeforePercent: Core.clamp((baseKwh / 500) * 100, 0, 100),
      billDiffNotice: resolved.diff !== 0 ? resolved.diff : 0,
      exactMatch: resolved.exact
    };
  }

  var PRESETS = [
    { id: "bath-heater", label: "욕실온풍기", watts: 1500, hours: 2, days: 30 },
    { id: "mini-dryer", label: "미니건조기", watts: 850, hours: 1.5, days: 20 },
    { id: "humidifier", label: "가열식 가습기", watts: 400, hours: 8, days: 30 },
    { id: "electric-mat", label: "전기장판", watts: 120, hours: 8, days: 30 },
    { id: "air-fryer", label: "에어프라이어", watts: 1400, hours: 0.5, days: 20 },
    { id: "custom", label: "직접 입력", watts: 0, hours: 1, days: 30 }
  ];

  return {
    bill: bill,
    kwhFromBill: kwhFromBill,
    compute: compute,
    tierIndex: tierIndex,
    tierLabel: tierLabel,
    PRESETS: PRESETS
  };
});
