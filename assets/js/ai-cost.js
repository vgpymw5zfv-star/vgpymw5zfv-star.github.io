/* ==========================================================================
   직장인 AI 구독 조합 가성비 계산기
   - ChatGPT: 무료 / Go 13,000원 / Plus 29,000원 (월, 부가세 포함 표시가)
   - Gemini(Google AI Plus): 무료 / 7,500원
   - Claude: 무료 / Pro $22
   - Perplexity: 무료 / Pro $20
   - 환율은 직접 조절 (기본 1,400원)
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriAi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var P = Core.CONST.AI_PRICES;

  var PLANS = {
    chatgpt: [
      { id: "free", label: "무료", price: P.chatgpt.free, currency: "KRW" },
      { id: "go", label: "Go", price: P.chatgpt.go, currency: "KRW" },
      { id: "plus", label: "Plus", price: P.chatgpt.plus, currency: "KRW" }
    ],
    gemini: [
      { id: "free", label: "무료", price: P.gemini.free, currency: "KRW" },
      { id: "plus", label: "Plus", price: P.gemini.plus, currency: "KRW" }
    ],
    claude: [
      { id: "free", label: "무료", price: P.claude.free, currency: "KRW" },
      { id: "pro", label: "Pro", price: P.claude.pro, currency: "USD" }
    ],
    perplexity: [
      { id: "free", label: "무료", price: P.perplexity.free, currency: "KRW" },
      { id: "pro", label: "Pro", price: P.perplexity.pro, currency: "USD" }
    ]
  };

  var LABELS = {
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    claude: "Claude",
    perplexity: "Perplexity"
  };

  function findPlan(service, id) {
    var list = PLANS[service] || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  /**
   * @param {object} input
   *  chatgpt / gemini / claude / perplexity : 플랜 id
   *  rate : 환율 (원/달러)
   */
  function compute(input) {
    var opts = input || {};
    var rate = Core.num(opts.rate, Core.CONST.DEFAULT_RATE, 800, 3000);

    var items = [];
    var total = 0;
    var paidCount = 0;
    var services = ["chatgpt", "gemini", "claude", "perplexity"];

    services.forEach(function (service) {
      var plan = findPlan(service, opts[service]);
      var krw = plan.currency === "USD" ? Math.round(plan.price * rate) : plan.price;
      total += krw;
      if (krw > 0) paidCount += 1;
      items.push({
        service: service,
        name: LABELS[service],
        planId: plan.id,
        planLabel: plan.label,
        price: plan.price,
        currency: plan.currency,
        krw: krw,
        paid: krw > 0
      });
    });

    /* 가장 저렴한 비무료 조합(각 서비스 최저 유료 플랜)과 비교 */
    var cheapestPaid = 0;
    services.forEach(function (service) {
      var list = PLANS[service];
      var min = Infinity;
      list.forEach(function (plan) {
        if (plan.price <= 0) return;
        var krw = plan.currency === "USD" ? Math.round(plan.price * rate) : plan.price;
        if (krw < min) min = krw;
      });
      if (isFinite(min)) cheapestPaid += min;
    });

    var yearly = total * 12;
    var freeSaving = total; /* 무료 조합(0원) 대비 이번 달 절약 가능액 */

    /* 개별 서비스만 구독했을 때의 단가 비교용 */
    var perServiceCheapest = items.map(function (item) {
      var list = PLANS[item.service];
      var min = Infinity;
      var minPlan = null;
      list.forEach(function (plan) {
        if (plan.price <= 0) return;
        var krw = plan.currency === "USD" ? Math.round(plan.price * rate) : plan.price;
        if (krw < min) {
          min = krw;
          minPlan = plan;
        }
      });
      return {
        name: item.name,
        krw: isFinite(min) ? min : 0,
        planLabel: minPlan ? minPlan.label : "-"
      };
    });

    return {
      rate: rate,
      items: items,
      total: total,
      monthly: total,
      yearly: yearly,
      paidCount: paidCount,
      allFree: total === 0,
      freeSaving: freeSaving,
      cheapestPaid: cheapestPaid,
      savedVsCheapestPaid: Math.max(0, cheapestPaid - total),
      perServiceCheapest: perServiceCheapest,
      dailyCost: total / 30
    };
  }

  return { compute: compute, PLANS: PLANS, LABELS: LABELS };
});
