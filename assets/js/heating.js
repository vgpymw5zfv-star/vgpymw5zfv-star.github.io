/* ==========================================================================
   겨울 난방비 계산기 — 도시가스(개별난방) · 지역난방(아파트)
   기준: 2026년 11월 (도시가스 2026.11.1 사용분, 지역난방 2024.7.1부 요금표 = 2026.7 동결)

   1) 도시가스 주택용 (부가세 별도, 청구액 10원 미만 절사)
      · 서울 1,250원 / 22.5268원/MJ        · 경기 1,250원 / 22.6226원/MJ
      · 인천 1,000원 / 22.5084          · 부산 900원 / 23.2186
      · 대구 900원 / 23.7742            · 광주 750원 / 22.0252(취사)·23.2970(난방)
      · 대전 850원 / 23.2332(취사)·24.0740(난방)
      · 취사·난방 겸용 세대는 월 516MJ까지 취사 단가, 초과분은 난방 단가
      · 사용열량(MJ) = 검침량(㎥) × 온압보정계수 × 평균열량(MJ/㎥)

   2) 지역난방 주택용 (한국지역난방공사, 부가세 별도, 10원 미만 절사)
      · 기본요금 계약면적 ㎡당 52.40원
      · 단일요금 Mcal당 112.32원
      · 계절별 차등요금 동절기(12~2월) 115.59 / 춘추(3~5·9~11월) 110.04 / 하계(6~8월) 99.02

   ※ 면적·습관으로 어림하는 값은 평균 추정치입니다. 고지서의 MJ·Mcal·㎥가 가장 정확합니다.
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriHeating = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var C = Core.CONST;

  /* ---------------- 요금 상수 ---------------- */

  var GAS = {
    VAT: C.VAT,
    /* 취사·난방 겸용 세대: 이 열량까지 취사 단가 */
    COOKING_LIMIT_MJ: 516,
    /* ㎥ → MJ 환산 기본값 */
    DEFAULT_COEF: 0.9945,
    DEFAULT_HEAT: 42.5,
    HEAT_MIN: 41.0,
    HEAT_MAX: 44.4
  };

  var DH = {
    VAT: C.VAT,
    BASE_PER_M2: 52.4,
    SINGLE: 112.32,
    WINTER: 115.59,
    SPRING_FALL: 110.04,
    SUMMER: 99.02,
    /* 1kWh = 0.86Mcal (1Mcal = 1.163kWh) */
    MCAL_PER_KWH: 0.86,
    SUPPLIER: "한국지역난방공사"
  };

  /* 지역별 주택용 도시가스 요금 (원/MJ, 부가세 별도) */
  var REGIONS = [
    {
      id: "seoul",
      label: "서울",
      short: "서울",
      supplier: "서울도시가스·예스코 등 서울 5개사",
      base: 1250,
      cooking: 22.5268,
      heating: 22.5268,
      coef: 0.994,
      custom: false
    },
    {
      id: "gyeonggi",
      label: "경기",
      short: "경기",
      supplier: "삼천리·코원에너지서비스·예스코 등",
      base: 1250,
      cooking: 22.6226,
      heating: 22.6226,
      coef: 0.9939,
      custom: false
    },
    {
      id: "incheon",
      label: "인천",
      short: "인천",
      supplier: "인천도시가스·삼천리(인천)",
      base: 1000,
      cooking: 22.5084,
      heating: 22.5084,
      coef: 0.9945,
      custom: false
    },
    {
      id: "busan",
      label: "부산",
      short: "부산",
      supplier: "부산도시가스",
      base: 900,
      cooking: 23.2186,
      heating: 23.2186,
      coef: 0.9845,
      custom: false
    },
    {
      id: "daegu",
      label: "대구",
      short: "대구",
      supplier: "대성에너지",
      base: 900,
      cooking: 23.7742,
      heating: 23.7742,
      coef: 0.9882,
      custom: false
    },
    {
      id: "gwangju",
      label: "광주",
      short: "광주",
      supplier: "해양에너지",
      base: 750,
      cooking: 22.0252,
      heating: 23.297,
      coef: 0.9896,
      custom: false
    },
    {
      id: "daejeon",
      label: "대전",
      short: "대전",
      supplier: "CNCITY에너지",
      base: 850,
      cooking: 23.2332,
      heating: 24.074,
      coef: 0.9908,
      custom: false
    },
    {
      id: "custom",
      label: "직접 입력",
      short: "직접",
      supplier: "고지서의 공급사 요금표 기준",
      base: 1250,
      cooking: 22.5268,
      heating: 22.5268,
      coef: GAS.DEFAULT_COEF,
      custom: true
    }
  ];

  /* 난방 습관별 겨울철 월 사용량 추정 계수 */
  var HABITS = [
    { id: "save", label: "절약 19~20℃", gasMjPerM2: 40, dhMcalPerM2: 8 },
    { id: "normal", label: "보통 21~22℃", gasMjPerM2: 55, dhMcalPerM2: 11 },
    { id: "warm", label: "따뜻함 23℃+", gasMjPerM2: 70, dhMcalPerM2: 14 }
  ];

  var PLAN_LABELS = {
    single: "단일요금",
    winter: "계절별 · 동절기 (12~2월)",
    spring: "계절별 · 춘추절기 (3~5·9~11월)",
    summer: "계절별 · 하계 (6~8월)"
  };

  /* 대표 면적 칩 — ㎡와 '평형'(공급면적 기준 통칭)을 함께 표기 */
  var AREA_PRESETS = [
    { m2: 20, label: "원룸 20㎡", pyeong: "6평" },
    { m2: 40, label: "소형 40㎡", pyeong: "12평" },
    { m2: 59, label: "59㎡ (25평형)", pyeong: "25평형" },
    { m2: 84, label: "84㎡ (34평형)", pyeong: "34평형" },
    { m2: 114, label: "114㎡ (43평형)", pyeong: "43평형" }
  ];

  /* ---------------- 공용 유틸 ---------------- */

  function regionById(id) {
    for (var i = 0; i < REGIONS.length; i += 1) {
      if (REGIONS[i].id === id) return REGIONS[i];
    }
    return REGIONS[0];
  }

  function habitById(id) {
    for (var i = 0; i < HABITS.length; i += 1) {
      if (HABITS[i].id === id) return HABITS[i];
    }
    return HABITS[1];
  }

  function m2ToPyeong(m2) {
    var v = Core.num(m2, 0, 0, 500);
    return v / C.M2_PER_PYEONG;
  }

  function pyeongToM2(pyeong) {
    var v = Core.num(pyeong, 0, 0, 200);
    return v * C.M2_PER_PYEONG;
  }

  /* 월(1~12) → 계절 절기 키 */
  function seasonOf(monthRaw) {
    var m = Math.round(Core.num(monthRaw, 11, 1, 12));
    if (m === 12 || m === 1 || m === 2) return "winter";
    if (m >= 6 && m <= 8) return "summer";
    return "spring";
  }

  function seasonLabel(seasonKey) {
    return PLAN_LABELS[seasonKey] || PLAN_LABELS.winter;
  }

  /* ---------------- 도시가스 ---------------- */

  /**
   * 지역 요금 설정 (직접 입력이면 입력값 사용)
   * @param {object} input { region, customBase, customCooking, customHeating }
   */
  function gasConfig(input) {
    var o = input || {};
    var region = regionById(o.region);
    var custom = region.custom;
    var base = custom
      ? Core.num(o.customBase, region.base, 0, 100000)
      : region.base;
    var cooking = custom
      ? Core.num(o.customCooking, region.cooking, 0, 200)
      : region.cooking;
    var heating = custom
      ? Core.num(o.customHeating, region.heating, 0, 200)
      : region.heating;
    return {
      id: region.id,
      label: region.label,
      short: region.short,
      supplier: region.supplier,
      custom: custom,
      base: base,
      cooking: cooking,
      heating: heating,
      coef: region.coef,
      splitApplies: Math.abs(cooking - heating) > 0.00005
    };
  }

  /** 검침량(㎥) → 사용열량(MJ) */
  function m3ToMj(m3Raw, coefRaw, heatRaw) {
    var m3 = Core.num(m3Raw, 0, 0, 20000);
    var coef = Core.num(coefRaw, GAS.DEFAULT_COEF, 0.5, 1.5);
    var heat = Core.num(heatRaw, GAS.DEFAULT_HEAT, 1, 100);
    return Math.round(m3 * coef * heat * 100) / 100;
  }

  /** 사용열량(MJ) → 도시가스 청구서 구성 */
  function gasBill(mjRaw, cfgInput) {
    var cfg = cfgInput && cfgInput.base !== undefined ? cfgInput : gasConfig(cfgInput);
    var mj = Math.round(Core.num(mjRaw, 0, 0, 200000) * 100) / 100;
    var limit = GAS.COOKING_LIMIT_MJ;
    var parts = [];

    if (cfg.splitApplies) {
      var cookingMj = Math.min(mj, limit);
      var heatingMj = Math.max(0, mj - limit);
      if (cookingMj > 0) {
        parts.push({
          key: "cooking",
          label: "취사용 (" + limit + "MJ까지)",
          mj: Math.round(cookingMj * 100) / 100,
          rate: cfg.cooking,
          amount: cookingMj * cfg.cooking
        });
      }
      if (heatingMj > 0) {
        parts.push({
          key: "heating",
          label: "난방용 (" + limit + "MJ 초과)",
          mj: Math.round(heatingMj * 100) / 100,
          rate: cfg.heating,
          amount: heatingMj * cfg.heating
        });
      }
    } else if (mj > 0) {
      parts.push({
        key: "all",
        label: "사용열량",
        mj: mj,
        rate: cfg.cooking,
        amount: mj * cfg.cooking
      });
    }

    var energy = 0;
    for (var i = 0; i < parts.length; i += 1) energy += parts[i].amount;

    var base = cfg.base;
    var subtotal = base + energy;
    var vat = subtotal * GAS.VAT;
    var total = Core.floor10(subtotal + vat);

    return {
      type: "gas",
      mj: mj,
      base: base,
      parts: parts.map(function (p) {
        return {
          label: p.label,
          mj: p.mj,
          rate: p.rate,
          amount: Math.round(p.amount)
        };
      }),
      energy: Math.round(energy),
      subtotal: Math.round(subtotal),
      vat: Math.round(vat),
      total: total,
      unitPrice: mj > 0 ? total / mj : 0
    };
  }

  /** 겨울철 월 사용열량(MJ) 추정 — 전용면적 × 습관 계수 */
  function estimateGasMj(areaM2Raw, habitRaw) {
    var m2 = Core.num(areaM2Raw, 0, 0, 500);
    if (m2 <= 0) return 0;
    var habit = habitById(habitRaw);
    return Math.round((m2 * habit.gasMjPerM2) / 10) * 10;
  }

  /** 겨울철 월 사용열량(Mcal) 추정 — 계약면적 × 습관 계수 */
  function estimateDhMcal(areaM2Raw, habitRaw) {
    var m2 = Core.num(areaM2Raw, 0, 0, 500);
    if (m2 <= 0) return 0;
    var habit = habitById(habitRaw);
    return Math.round((m2 * habit.dhMcalPerM2) / 10) * 10;
  }

  /* ---------------- 지역난방 ---------------- */

  /**
   * @param {object} input { plan: 'single'|'seasonal', month, areaM2 }
   */
  function dhConfig(input) {
    var o = input || {};
    var plan = o.plan === "seasonal" ? "seasonal" : "single";
    var month = Math.round(Core.num(o.month, 11, 1, 12));
    var seasonKey = plan === "seasonal" ? seasonOf(month) : "single";
    var rate = DH.SINGLE;
    if (seasonKey === "winter") rate = DH.WINTER;
    else if (seasonKey === "spring") rate = DH.SPRING_FALL;
    else if (seasonKey === "summer") rate = DH.SUMMER;
    return {
      plan: plan,
      month: month,
      seasonKey: seasonKey,
      seasonLabel: plan === "seasonal" ? seasonLabel(seasonKey) + " · " + month + "월" : "단일요금 (연중 동일)",
      rate: rate,
      basePerM2: DH.BASE_PER_M2
    };
  }

  /** 계약면적(㎡) → 기본요금 */
  function dhBase(areaM2Raw) {
    var m2 = Core.num(areaM2Raw, 0, 0, 500);
    return m2 * DH.BASE_PER_M2;
  }

  function kwhToMcal(kwhRaw) {
    var kwh = Core.num(kwhRaw, 0, 0, 200000);
    return Math.round(kwh * DH.MCAL_PER_KWH * 100) / 100;
  }

  function mcalToKwh(mcalRaw) {
    var mcal = Core.num(mcalRaw, 0, 0, 200000);
    return Math.round((mcal / DH.MCAL_PER_KWH) * 100) / 100;
  }

  /** 사용열량(Mcal) + 계약면적(㎡) → 지역난방 청구서 구성 */
  function dhBill(mcalRaw, areaM2Raw, cfgInput) {
    var cfg = cfgInput && cfgInput.rate !== undefined ? cfgInput : dhConfig(cfgInput);
    var mcal = Math.round(Core.num(mcalRaw, 0, 0, 200000) * 100) / 100;
    var base = dhBase(areaM2Raw);
    var energy = mcal * cfg.rate;
    var subtotal = base + energy;
    var vat = subtotal * DH.VAT;
    var total = Core.floor10(subtotal + vat);
    return {
      type: "district",
      mcal: mcal,
      kwh: mcalToKwh(mcal),
      areaM2: Core.num(areaM2Raw, 0, 0, 500),
      base: Math.round(base),
      baseRaw: base,
      rate: cfg.rate,
      energy: Math.round(energy),
      subtotal: Math.round(subtotal),
      vat: Math.round(vat),
      total: total,
      unitPrice: mcal > 0 ? total / mcal : 0
    };
  }

  /* ---------------- 통합 계산 ---------------- */

  /** 1℃ 낮출 때 절감률 (난방비의 약 7%) */
  var SAVING_PCT = 7;
  var WINTER_MONTHS = 4;

  /**
   * @param {object} input
   *  type        'gas' | 'district'
   *  region      도시가스 지역 id (gas)
   *  customBase / customCooking / customHeating  직접 입력 (gas)
   *  mode        gas: 'mj' | 'm3' | 'area' / district: 'mcal' | 'kwh' | 'area'
   *  usageMj     사용열량(MJ)
   *  usageM3     검침량(㎥)
   *  coef        온압보정계수
   *  avgHeat     평균열량(MJ/㎥)
   *  usageMcal   사용열량(Mcal)
   *  usageKwh    열량(kWh)
   *  areaM2      전용면적(도시가스) / 계약면적(지역난방)
   *  habit       'save' | 'normal' | 'warm'
   *  plan        'single' | 'seasonal' (district)
   *  month       1~12 (계절별 요금 절기 판정)
   */
  function compute(input) {
    var o = input || {};
    var type = o.type === "district" ? "district" : "gas";
    var mode =
      o.mode === "area"
        ? "area"
        : o.mode === "m3" || o.mode === "kwh"
          ? o.mode
          : type === "district"
            ? "mcal"
            : "mj";
    var habit = habitById(o.habit);
    var areaM2 = Core.num(o.areaM2, 0, 0, 500);
    var estimated = false;

    if (type === "district") {
      var cfgD = dhConfig({ plan: o.plan, month: o.month });
      var mcal = 0;
      var kwh = 0;
      if (mode === "kwh") {
        kwh = Core.num(o.usageKwh, 0, 0, 200000);
        mcal = kwhToMcal(kwh);
      } else if (mode === "area") {
        mcal = estimateDhMcal(areaM2, habit.id);
        kwh = mcalToKwh(mcal);
        estimated = mcal > 0;
      } else {
        mcal = Math.round(Core.num(o.usageMcal, 0, 0, 200000) * 100) / 100;
        kwh = mcalToKwh(mcal);
      }
      var billD = dhBill(mcal, areaM2, cfgD);
      /* 겨울 4개월(11~2월): 계절별 요금제는 11월 춘추 + 12·1·2월 동절기 단가로 합산 */
      var winterTotalD;
      if (cfgD.plan === "seasonal") {
        winterTotalD =
          dhBill(mcal, areaM2, { rate: DH.SPRING_FALL }).total +
          dhBill(mcal, areaM2, { rate: DH.WINTER }).total * 3;
      } else {
        winterTotalD = billD.total * WINTER_MONTHS;
      }
      return {
        type: type,
        typeLabel: "지역난방",
        mode: mode,
        estimated: estimated,
        habit: habit.id,
        habitLabel: habit.label,
        areaM2: areaM2,
        pyeong: Math.round(m2ToPyeong(areaM2) * 10) / 10,
        plan: cfgD.plan,
        seasonKey: cfgD.seasonKey,
        seasonLabel: cfgD.seasonLabel,
        rate: cfgD.rate,
        basePerM2: cfgD.basePerM2,
        supplier: DH.SUPPLIER,
        mcal: billD.mcal,
        kwh: billD.kwh,
        base: billD.base,
        energy: billD.energy,
        subtotal: billD.subtotal,
        vat: billD.vat,
        total: billD.total,
        unitPrice: billD.unitPrice,
        unitName: "Mcal",
        parts: billD.mcal > 0 ? [{ label: "사용열량", mcal: billD.mcal, rate: cfgD.rate, amount: billD.energy }] : [],
        winterTotal: winterTotalD,
        winterMonths: WINTER_MONTHS,
        savingPct: SAVING_PCT,
        savingAmount: Math.round((billD.total * SAVING_PCT) / 100),
        savingWinter: Math.round((winterTotalD * SAVING_PCT) / 100),
        region: null,
        regionLabel: DH.SUPPLIER
      };
    }

    var cfg = gasConfig({
      region: o.region,
      customBase: o.customBase,
      customCooking: o.customCooking,
      customHeating: o.customHeating
    });
    var coef = Core.num(o.coef, cfg.coef || GAS.DEFAULT_COEF, 0.5, 1.5);
    var avgHeat = Core.num(o.avgHeat, GAS.DEFAULT_HEAT, GAS.HEAT_MIN, GAS.HEAT_MAX);
    var mj = 0;
    var m3 = 0;
    if (mode === "m3") {
      m3 = Core.num(o.usageM3, 0, 0, 20000);
      mj = m3ToMj(m3, coef, avgHeat);
    } else if (mode === "area") {
      mj = estimateGasMj(areaM2, habit.id);
      m3 = avgHeat > 0 && coef > 0 ? Math.round((mj / (coef * avgHeat)) * 100) / 100 : 0;
      estimated = mj > 0;
    } else {
      mj = Math.round(Core.num(o.usageMj, 0, 0, 200000) * 100) / 100;
      m3 = avgHeat > 0 && coef > 0 ? Math.round((mj / (coef * avgHeat)) * 100) / 100 : 0;
    }

    var bill = gasBill(mj, cfg);
    return {
      type: "gas",
      typeLabel: "도시가스",
      mode: mode,
      estimated: estimated,
      habit: habit.id,
      habitLabel: habit.label,
      areaM2: areaM2,
      pyeong: Math.round(m2ToPyeong(areaM2) * 10) / 10,
      region: cfg.id,
      regionLabel: cfg.label,
      supplier: cfg.supplier,
      custom: cfg.custom,
      baseRate: cfg.base,
      cookingRate: cfg.cooking,
      heatingRate: cfg.heating,
      splitApplies: cfg.splitApplies,
      coef: coef,
      avgHeat: avgHeat,
      mj: bill.mj,
      m3: m3,
      base: bill.base,
      energy: bill.energy,
      subtotal: bill.subtotal,
      vat: bill.vat,
      total: bill.total,
      unitPrice: bill.unitPrice,
      unitName: "MJ",
      parts: bill.parts,
      winterTotal: bill.total * WINTER_MONTHS,
      winterMonths: WINTER_MONTHS,
      savingPct: SAVING_PCT,
      savingAmount: Math.round((bill.total * SAVING_PCT) / 100),
      savingWinter: Math.round((bill.total * WINTER_MONTHS * SAVING_PCT) / 100)
    };
  }

  return {
    compute: compute,
    gasBill: gasBill,
    gasConfig: gasConfig,
    dhBill: dhBill,
    dhConfig: dhConfig,
    dhBase: dhBase,
    m3ToMj: m3ToMj,
    mcalToKwh: mcalToKwh,
    kwhToMcal: kwhToMcal,
    estimateGasMj: estimateGasMj,
    estimateDhMcal: estimateDhMcal,
    seasonOf: seasonOf,
    seasonLabel: seasonLabel,
    m2ToPyeong: m2ToPyeong,
    pyeongToM2: pyeongToM2,
    REGIONS: REGIONS,
    HABITS: HABITS,
    AREA_PRESETS: AREA_PRESETS,
    GAS: GAS,
    DH: DH,
    SAVING_PCT: SAVING_PCT,
    WINTER_MONTHS: WINTER_MONTHS
  };
});
