/* ==========================================================================
   단위가격 · 1+1 실구매가 비교기 — 순수 계산 로직
   - 입력값은 브라우저 메모리에서만 처리합니다. (서버 전송 0)
   - 단가 기준: 무게 → 100g당, 부피 → 100ml당, 개수 → 1개(1매)당
   - 할인 순서: 쿠폰(정가 기준) → 카드·적립(쿠폰 적용 후 결제액 기준)
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriUnitPrice = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* 단위 정의 — factor: 기본 단위(g·ml·개)로 바꾸는 배수, per: 단가 기준량 */
  var UNITS = {
    g: { id: "g", label: "g", kind: "mass", factor: 1, per: 100, perLabel: "100g" },
    kg: { id: "kg", label: "kg", kind: "mass", factor: 1000, per: 100, perLabel: "100g" },
    ml: { id: "ml", label: "ml", kind: "volume", factor: 1, per: 100, perLabel: "100ml" },
    l: { id: "l", label: "L", kind: "volume", factor: 1000, per: 100, perLabel: "100ml" },
    ea: { id: "ea", label: "개", kind: "count", factor: 1, per: 1, perLabel: "1개" },
    sheet: { id: "sheet", label: "매", kind: "count", factor: 1, per: 1, perLabel: "1매" }
  };

  var UNIT_ORDER = ["g", "kg", "ml", "l", "ea", "sheet"];

  var KIND_LABEL = { mass: "무게", volume: "부피", count: "개수" };

  function num(value, fallback, min, max) {
    var n;
    if (typeof value === "number") {
      n = value;
    } else if (typeof value === "string") {
      var cleaned = value.replace(/[,\s원개매]/g, "");
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

  function comma(n) {
    if (typeof n !== "number" || !isFinite(n)) n = 0;
    return Math.round(n).toLocaleString("ko-KR");
  }

  /** 수량 표기 — 2.3 / 1,000 처럼 소수는 그대로, 큰 수는 쉼표 */
  function qtyText(n) {
    var v = Math.round(n * 1000) / 1000;
    if (v === Math.floor(v)) return comma(v);
    return String(v);
  }

  /** 단가 표기 — 작은 값은 소수 한 자리까지 보여 차이를 살린다 */
  function unitText(v) {
    if (typeof v !== "number" || !isFinite(v) || v <= 0) return "-";
    if (v < 1) return String(Math.round(v * 100) / 100);
    if (v < 1000) {
      var one = Math.round(v * 10) / 10;
      return one === Math.floor(one) ? comma(one) : one.toFixed(1);
    }
    return comma(v);
  }

  function pctText(v) {
    if (typeof v !== "number" || !isFinite(v)) return "-";
    var one = Math.round(v * 10) / 10;
    return (one === Math.floor(one) ? String(one) : one.toFixed(1)) + "%";
  }

  /** 총량 표기 — 무게·부피는 1,000 이상이면 kg·L로 */
  function totalText(base, kind) {
    if (kind === "mass") {
      return base >= 1000 ? qtyText(base / 1000) + "kg" : qtyText(base) + "g";
    }
    if (kind === "volume") {
      return base >= 1000 ? qtyText(base / 1000) + "L" : qtyText(base) + "ml";
    }
    return qtyText(base) + "개";
  }

  /**
   * 상품 1개 계산
   * @param {{name?, price, amount, unit, qty, coupon, couponType, card, cardType, index?}} p
   */
  function normalize(p) {
    var raw = p || {};
    var unit = UNITS[raw.unit] || UNITS.g;
    var price = num(raw.price, 0, 0);
    var amount = num(raw.amount, 0, 0);
    var qty = num(raw.qty, 1, 1, 999);

    var couponValue = num(raw.coupon, 0, 0);
    var couponType = raw.couponType === "pct" ? "pct" : "won";
    var cardValue = num(raw.card, 0, 0);
    var cardType = raw.cardType === "pct" ? "pct" : "won";

    var valid = price > 0 && amount > 0;
    if (!valid) {
      return {
        index: typeof raw.index === "number" ? raw.index : 0,
        name: String(raw.name || "").trim(),
        valid: false,
        reason: price <= 0 ? "가격을 입력하세요" : "용량을 입력하세요",
        unitId: unit.id,
        perLabel: unit.perLabel,
        kind: unit.kind
      };
    }

    /* 쿠폰은 정가 기준, 카드·적립은 쿠폰 적용 후 결제액 기준 */
    var couponWon = couponType === "pct" ? (price * Math.min(couponValue, 100)) / 100 : Math.min(couponValue, price);
    var afterCoupon = Math.max(0, price - couponWon);
    var cardWon = cardType === "pct" ? (afterCoupon * Math.min(cardValue, 100)) / 100 : Math.min(cardValue, afterCoupon);
    var paid = Math.max(0, afterCoupon - cardWon);

    var totalBase = amount * unit.factor * qty;
    var perAmount = totalBase / unit.per;
    var unitPrice = perAmount > 0 ? paid / perAmount : 0;

    return {
      index: typeof raw.index === "number" ? raw.index : 0,
      name: String(raw.name || "").trim(),
      valid: true,
      reason: "",
      price: price,
      paid: paid,
      discount: price - paid,
      couponWon: couponWon,
      cardWon: cardWon,
      amount: amount,
      qty: qty,
      unitId: unit.id,
      unitLabel: unit.label,
      kind: unit.kind,
      kindLabel: KIND_LABEL[unit.kind],
      per: unit.per,
      perLabel: unit.perLabel,
      totalBase: totalBase,
      amountText: qtyText(amount) + unit.label + (qty > 1 ? " × " + qtyText(qty) + "개" : ""),
      totalText: totalText(totalBase, unit.kind),
      unitPrice: unitPrice,
      unitPriceText: unitText(unitPrice)
    };
  }

  /**
   * 최대 4개 상품 비교
   * @returns {{items, ranked, best, second, savingRate, absDiff, validCount, mixed, kinds}}
   */
  function compare(products) {
    var list = (products || []).map(function (p, i) {
      var copy = {};
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) copy[k] = p[k];
      if (typeof copy.index !== "number") copy.index = i;
      return normalize(copy);
    });

    var valid = list.filter(function (it) {
      return it.valid;
    });

    var ranked = valid.slice().sort(function (a, b) {
      if (a.unitPrice === b.unitPrice) return a.index - b.index;
      return a.unitPrice - b.unitPrice;
    });
    ranked.forEach(function (it, i) {
      it.rank = i + 1;
    });

    var best = ranked[0] || null;
    var second = ranked[1] || null;
    var savingRate = null;
    var absDiff = null;
    if (best && second && second.unitPrice > 0) {
      savingRate = ((second.unitPrice - best.unitPrice) / second.unitPrice) * 100;
      absDiff = second.unitPrice - best.unitPrice;
    }

    var kinds = {};
    valid.forEach(function (it) {
      kinds[it.kind] = true;
    });

    return {
      items: list,
      ranked: ranked,
      best: best,
      second: second,
      savingRate: savingRate,
      absDiff: absDiff,
      validCount: valid.length,
      mixed: Object.keys(kinds).length > 1,
      kinds: Object.keys(kinds)
    };
  }

  /** 결과 요약 문구(복사용) — 상품별 단가를 한 줄씩 */
  function summary(result, prefix) {
    if (!result || !result.ranked.length) return "비교할 상품을 입력해 주세요.";
    var lines = [prefix || "단위가격 비교"];
    result.ranked.forEach(function (it) {
      var name = it.name || it.index + 1 + "번 상품";
      lines.push(
        it.rank +
          "위 · " +
          name +
          " · " +
          it.perLabel +
          "당 " +
          it.unitPriceText +
          "원 (실구매 " +
          comma(it.paid) +
          "원 / " +
          it.totalText +
          ")"
      );
    });
    if (result.second) {
      lines.push(
        "1위가 2위보다 " + pctText(result.savingRate) + " 저렴 (" + result.best.perLabel + "당 " + unitText(result.absDiff) + "원 차이)"
      );
    }
    return lines.join("\n");
  }

  return {
    UNITS: UNITS,
    UNIT_ORDER: UNIT_ORDER,
    KIND_LABEL: KIND_LABEL,
    num: num,
    comma: comma,
    qtyText: qtyText,
    unitText: unitText,
    pctText: pctText,
    totalText: totalText,
    normalize: normalize,
    compare: compare,
    summary: summary
  };
});
