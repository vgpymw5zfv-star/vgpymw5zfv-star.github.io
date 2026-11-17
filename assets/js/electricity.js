/* ==========================================================================
   우리집 전기세 · 누진제 계산기
   근거: 한국전력공사 주택용 전기요금표, 2026년 11월 기준
   - 계약 종별
     · 주택용 저압(원룸·빌라·단독): 기본 910 / 1,600 / 7,300원,
       전력량 120.0 / 214.6 / 307.3원/kWh, 슈퍼유저 736.2원
     · 주택용 고압(대부분 아파트): 기본 730 / 1,260 / 6,060원,
       전력량 105.0 / 174.0 / 242.3원/kWh, 슈퍼유저 593.3원
   - 누진 구간: 일반 계절(3~6·9~12월) 200 / 400kWh, 하계(7~8월) 300 / 450kWh
   - 슈퍼유저: 1,000kWh 초과분에만 적용 (하계·동계)
   - 공통: 기후환경요금 9.0원, 연료비조정요금 5.0원,
     부가가치세 10%, 전력산업기반기금 2.7%(2025.7.1 인하), 10원 미만 절사
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

  /* ---------------- 계약 종별 · 계절 설정 ---------------- */

  /**
   * 입력 옵션을 실제 요율표로 바꾼다.
   * @param {object} opts { contract: 'low'|'high', season: 'general'|'summer', superuser: bool }
   */
  function configFor(opts) {
    var o = opts || {};
    var contract = o.contract === "high" ? "high" : "low";
    var season = o.season === "summer" ? "summer" : "general";
    var table = C.KEPCO[contract];
    var limits = C.KEPCO_LIMITS[season];
    return {
      contract: contract,
      contractLabel: table.label,
      contractShort: table.short,
      season: season,
      seasonLabel: season === "summer" ? "하계 (7~8월)" : "일반 (3~6·9~12월)",
      limits: limits,
      base: table.base,
      rate: table.rate,
      superuserRate: table.superuser,
      /* 하계는 1,000kWh 초과 슈퍼유저가 기본 적용, 그 외는 동계청구서용 선택 */
      superuser: season === "summer" ? true : !!o.superuser
    };
  }

  function tierIndex(kwh, opts) {
    var cfg = configFor(opts);
    if (kwh <= cfg.limits[0]) return 0;
    if (kwh <= cfg.limits[1]) return 1;
    return 2;
  }

  function tierLabel(kwh, opts) {
    var cfg = configFor(opts);
    var idx = tierIndex(kwh, cfg);
    if (idx === 0) return "1구간 (" + cfg.limits[0] + "kWh 이하)";
    if (idx === 1) {
      return "2구간 (" + (cfg.limits[0] + 1) + "~" + cfg.limits[1] + "kWh)";
    }
    return "3구간 (" + cfg.limits[1] + "kWh 초과)";
  }

  /**
   * 사용량(kWh) → 청구서 구성
   * @param {number} kwhRaw
   * @param {object} opts 계약 종별·계절·슈퍼유저
   * @returns {object} 원 단위 요금 내역
   */
  function bill(kwhRaw, opts) {
    var cfg = configFor(opts);
    var kwh = Math.max(0, Core.num(kwhRaw, 0, 0, 100000));
    var idx = tierIndex(kwh, cfg);
    var superLimit = C.KEPCO_SUPER_LIMIT;

    /* 구간 상한: 1·2구간 경계, (슈퍼유저 적용 시) 3구간은 1,000kWh까지, 이후 슈퍼유저 */
    var bounds = [
      cfg.limits[0],
      cfg.limits[1],
      cfg.superuser ? superLimit : Infinity
    ];
    var rates = [cfg.rate[0], cfg.rate[1], cfg.rate[2], cfg.superuserRate];

    var parts = [];
    var energy = 0;
    var prev = 0;

    for (var i = 0; i < 4; i += 1) {
      var upper = i < 3 ? Math.min(kwh, bounds[i]) : kwh;
      var used = Math.max(0, upper - prev);
      if (used > 0) {
        var amount = used * rates[i];
        energy += amount;
        parts.push({
          tier: i < 3 ? i + 1 : 4,
          isSuperuser: i === 3,
          kwh: used,
          rate: rates[i],
          amount: Math.round(amount)
        });
      }
      prev = upper;
      if (i < 3 && kwh <= bounds[i]) break;
    }

    var superPart = null;
    for (var p = 0; p < parts.length; p += 1) {
      if (parts[p].isSuperuser) superPart = parts[p];
    }

    var base = cfg.base[idx];
    var climate = kwh * C.KEPCO_CLIMATE;
    var fuel = kwh * C.KEPCO_FUEL;
    var subtotal = base + energy + climate + fuel;
    var vat = subtotal * C.VAT;
    var fund = subtotal * C.FUND;
    var total = Core.floor10(subtotal + vat + fund);

    return {
      kwh: kwh,
      tier: idx + 1,
      tierLabel: tierLabel(kwh, cfg),
      base: base,
      energy: Math.round(energy),
      climate: Math.round(climate),
      fuel: Math.round(fuel),
      subtotal: Math.round(subtotal),
      vat: Math.round(vat),
      fund: Math.round(fund),
      total: total,
      parts: parts,
      contract: cfg.contract,
      contractLabel: cfg.contractLabel,
      season: cfg.season,
      superuser: cfg.superuser,
      superuserKwh: superPart ? superPart.kwh : 0,
      superuserRate: cfg.superuserRate,
      superuserAmount: superPart ? superPart.amount : 0,
      /* kWh당 실질 단가 (부가세·기금 포함) */
      unitPrice: kwh > 0 ? total / kwh : 0
    };
  }

  /**
   * 월 청구액(원) → 사용량(kWh) 역추산
   * 청구서 금액과 가장 가까운 정수 kWh를 이분 탐색으로 찾는다.
   */
  function kwhFromBill(billWonRaw, opts) {
    var target = Math.max(0, Core.num(billWonRaw, 0, 0, 100000000));
    if (target <= 0) return { kwh: 0, bill: bill(0, opts), diff: 0, exact: true };

    var lo = 0;
    var hi = 3000; /* 3,000kWh까지 탐색 (가정용 상한) */
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (bill(mid, opts).total < target) lo = mid + 1;
      else hi = mid;
    }
    var candidates = [Math.max(0, lo - 1), lo, lo + 1];
    var best = candidates[0];
    var bestDiff = Math.abs(bill(candidates[0], opts).total - target);
    for (var i = 1; i < candidates.length; i += 1) {
      var diff = Math.abs(bill(candidates[i], opts).total - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidates[i];
      }
    }
    return {
      kwh: best,
      bill: bill(best, opts),
      diff: bill(best, opts).total - target,
      exact: bestDiff < 10
    };
  }

  /* ---------------- 면적 · 가구원 수 추정 ---------------- */

  /**
   * 전용면적(㎡)과 가구원 수 → 참고 월 사용량(kWh)
   * 주택용 월 평균 사용량 분포를 단순화한 추정식: 90 + 2.2×㎡ + 50×(가구원-1)
   * (예: 20㎡ 1인 ≈ 130kWh, 59㎡ 3인 ≈ 320kWh, 84㎡ 4인 ≈ 430kWh)
   */
  function estimateKwh(areaM2Raw, personsRaw) {
    var m2 = Core.num(areaM2Raw, 0, 0, 500);
    var persons = Core.num(personsRaw, 1, 1, 8);
    if (m2 <= 0) return 0;
    var raw = 90 + 2.2 * m2 + 50 * (persons - 1);
    return Math.round(raw / 10) * 10;
  }

  function m2ToPyeong(m2) {
    var v = Core.num(m2, 0, 0, 500);
    return v / C.M2_PER_PYEONG;
  }

  function pyeongToM2(pyeong) {
    var v = Core.num(pyeong, 0, 0, 200);
    return v * C.M2_PER_PYEONG;
  }

  /**
   * @param {object} input
   *  mode        'area' | 'kwh' | 'bill'
   *  areaM2      전용면적(㎡)
   *  persons     가구원 수
   *  usageKwh    기존 월 사용량
   *  billWon     기존 월 청구액
   *  contract    'low' | 'high'
   *  season      'general' | 'summer'
   *  superuser   1,000kWh 초과 슈퍼유저 적용
   *  watts       추가 가전 소비전력 (W)
   *  hours       하루 사용시간
   *  days        월 사용일수
   */
  function compute(input) {
    var opts = input || {};
    var mode = opts.mode === "bill" ? "bill" : opts.mode === "area" ? "area" : "kwh";
    var priceOpts = {
      contract: opts.contract,
      season: opts.season,
      superuser: opts.superuser
    };
    var cfg = configFor(priceOpts);
    var resolved;
    var estimated = false;
    var estimatedKwh = 0;
    var areaM2 = Core.num(opts.areaM2, 0, 0, 500);
    var persons = Core.num(opts.persons, 1, 1, 8);

    if (mode === "bill") {
      resolved = kwhFromBill(opts.billWon, cfg);
    } else if (mode === "area") {
      estimatedKwh = estimateKwh(areaM2, persons);
      estimated = estimatedKwh > 0;
      resolved = {
        kwh: estimatedKwh,
        bill: bill(estimatedKwh, cfg),
        diff: 0,
        exact: true
      };
    } else {
      var kwh = Core.num(opts.usageKwh, 0, 0, 100000);
      resolved = { kwh: kwh, bill: bill(kwh, cfg), diff: 0, exact: true };
    }

    var baseKwh = resolved.kwh;
    var before = resolved.bill;

    var watts = Core.num(opts.watts, 0, 0, 10000);
    var hours = Core.num(opts.hours, 0, 0, 24);
    var days = Core.num(opts.days, 0, 0, 31);

    var addKwhRaw = (watts * hours * days) / 1000;
    var addKwh = Math.round(addKwhRaw * 10) / 10;
    var afterKwh = Math.round((baseKwh + addKwhRaw) * 10) / 10;
    var after = bill(afterKwh, cfg);

    var extraBill = Math.max(0, after.total - before.total);
    var beforeTier = tierIndex(baseKwh, cfg);
    var afterTier = tierIndex(afterKwh, cfg);
    var jumped = afterTier > beforeTier;

    /* 추가분만의 실질 단가 */
    var extraUnit = addKwhRaw > 0 ? extraBill / addKwhRaw : 0;
    /* 같은 구간 한계 단가 (구간 요금 + 기후·연료 + 부가세·기금) */
    var marginalRate = cfg.rate[beforeTier] + C.KEPCO_CLIMATE + C.KEPCO_FUEL;
    var marginalUnit = marginalRate * (1 + C.VAT + C.FUND);

    var gaugeMax = cfg.limits[1] + 100;
    var afterTierNo = tierIndex(afterKwh, cfg);
    /* 다음 누진 구간까지 남은 사용량 (3구간이면 0) */
    var remainingToNextTier =
      afterTierNo < 2 ? Math.max(0, Math.round((cfg.limits[afterTierNo] - afterKwh) * 10) / 10) : 0;

    return {
      mode: mode,
      contract: cfg.contract,
      contractLabel: cfg.contractLabel,
      contractShort: cfg.contractShort,
      season: cfg.season,
      seasonLabel: cfg.seasonLabel,
      seasonShort: cfg.season === "summer" ? "하계" : "일반",
      limits: cfg.limits,
      superuser: cfg.superuser,
      superuserRate: cfg.superuserRate,
      estimated: estimated,
      estimatedKwh: estimatedKwh,
      areaM2: areaM2,
      pyeong: Math.round(m2ToPyeong(areaM2) * 10) / 10,
      persons: persons,
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
      beforeTierLabel: tierLabel(baseKwh, cfg),
      afterTierLabel: tierLabel(afterKwh, cfg),
      jumped: jumped,
      yearlyExtra: extraBill * 12,
      yearlyTotal: after.total * 12,
      remainingToNextTier: remainingToNextTier,
      /* 게이지 표시용 (하계는 550kWh를 100%로) */
      gaugeMax: gaugeMax,
      gaugePercent: Core.clamp((afterKwh / gaugeMax) * 100, 0, 100),
      gaugeBeforePercent: Core.clamp((baseKwh / gaugeMax) * 100, 0, 100),
      billDiffNotice: resolved.diff !== 0 ? resolved.diff : 0,
      exactMatch: resolved.exact
    };
  }

  /* ---------------- 프리셋 ---------------- */

  var PRESETS = [
    { id: "ac-stand", label: "스탠드 에어컨", watts: 1800, hours: 4, days: 30 },
    { id: "ac-wall", label: "벽걸이 에어컨", watts: 700, hours: 6, days: 30 },
    { id: "dryer", label: "의류건조기", watts: 1000, hours: 2, days: 20 },
    { id: "dishwasher", label: "식기세척기", watts: 1200, hours: 2, days: 30 },
    { id: "bath-heater", label: "욕실온풍기", watts: 1500, hours: 2, days: 30 },
    { id: "humidifier", label: "가열식 가습기", watts: 400, hours: 8, days: 30 },
    { id: "electric-mat", label: "전기장판", watts: 120, hours: 8, days: 30 },
    { id: "custom", label: "직접 입력", watts: 0, hours: 1, days: 30 }
  ];

  /* 아파트 대표 면적 칩 (㎡ 기준, 라벨의 '평형'은 공급면적 기준 통칭) */
  var AREA_PRESETS = [
    { m2: 20, pyeong: "6평", label: "원룸 20㎡", persons: 1 },
    { m2: 40, pyeong: "12평", label: "소형 40㎡", persons: 2 },
    { m2: 59, pyeong: "25평형", label: "59㎡", persons: 3 },
    { m2: 84, pyeong: "34평형", label: "84㎡", persons: 3 },
    { m2: 114, pyeong: "43평형", label: "114㎡", persons: 4 }
  ];

  var PERSONS = [
    { value: 1, label: "1인" },
    { value: 2, label: "2인" },
    { value: 3, label: "3인" },
    { value: 4, label: "4인+" }
  ];

  return {
    bill: bill,
    kwhFromBill: kwhFromBill,
    compute: compute,
    configFor: configFor,
    estimateKwh: estimateKwh,
    m2ToPyeong: m2ToPyeong,
    pyeongToM2: pyeongToM2,
    tierIndex: tierIndex,
    tierLabel: tierLabel,
    PRESETS: PRESETS,
    AREA_PRESETS: AREA_PRESETS,
    PERSONS: PERSONS
  };
});
