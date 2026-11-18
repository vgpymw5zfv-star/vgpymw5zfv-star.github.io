/* ==========================================================================
   대출 이자 · 상환방식 비교 계산기 (순수 계산 코어, DOM 비의존)
   3대 상환방식 + 체증식
   - 원리금균등: 매달 같은 금액(원금+이자)
   - 원금균등:   매달 같은 원금 + 남은 잔액의 이자 → 초기 부담 높고 총이자 적음
   - 만기일시:   기간 중 이자만 내고 만기에 원금 일시 상환
   - 체증식:     원리금균등액을 낮게 시작해 매년 일정 비율(기본 5%)씩 올리는 방식
   근거: 은행권 주택담보대출 상환방식 안내(주택금융공사·시중은행), 이자 계산은 월 단위
   ========================================================================== */

(function (root, factory) {
  var api = factory(
    typeof module === "object" && module.exports
      ? require("./dotori-core.js")
      : root.DotoriCore
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DotoriLoan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  var MAN = 10000;

  var CONST = {
    METHODS: {
      equal: { label: "원리금균등", short: "원리금균등" },
      principal: { label: "원금균등", short: "원금균등" },
      bullet: { label: "만기일시", short: "만기일시" },
      gradual: { label: "체증식", short: "체증식" }
    },
    DEFAULT_GROWTH: 0.05,
    MAX_MONTHS: 600
  };

  function methodKey(m) {
    return CONST.METHODS[m] ? m : "equal";
  }

  /**
   * 상환 스케줄
   * @param {object} o
   *  principalWon, annualRate(%), years, graceMonths, method, growthRate(0.05)
   */
  function compute(input) {
    var o = input || {};
    var principal = Math.max(0, Core.num(o.principalMan, 30000, 0, 1000000)) * MAN;
    var annualRate = Core.clamp(Core.num(o.interestRate, 4, 0, 30), 0, 30);
    var years = Core.clamp(Core.num(o.years, 30, 1, 50), 1, 50);
    var method = methodKey(o.method);
    var growth = Core.clamp(Core.num(o.growthRate, CONST.DEFAULT_GROWTH, 0, 0.3), 0, 0.3);

    var n = Math.max(1, Math.round(years * 12));
    var r = annualRate / 100 / 12;
    var graceRaw = Math.round(Core.num(o.graceMonths, 0, 0, 600));
    var grace = Math.min(graceRaw, n - 1);
    var repayMonths = n - grace;

    var rows = [];
    var balance = principal;
    var month = 0;

    /* ---- 1) 우선 상환액(pmt) 결정 ---- */
    var pmt = 0;
    var basePrincipal = 0;
    var planned = [];

    if (method === "equal") {
      pmt =
        r === 0
          ? principal / repayMonths
          : (principal * r) / (1 - Math.pow(1 + r, -repayMonths));
    }

    if (method === "principal") {
      basePrincipal = principal / repayMonths;
    }

    if (method === "gradual") {
      /* 원금 상환액이 매년 (1+growth) 배로 늘어나는 체증식 */
      var sumW = 0;
      var weights = [];
      for (var w = 0; w < repayMonths; w += 1) {
        var weight = Math.pow(1 + growth, Math.floor(w / 12));
        weights.push(weight);
        sumW += weight;
      }
      var acc = 0;
      for (var j = 0; j < repayMonths; j += 1) {
        if (j === repayMonths - 1) {
          planned.push(principal - acc);
        } else {
          var part = sumW > 0 ? (principal * weights[j]) / sumW : principal / repayMonths;
          planned.push(part);
          acc += part;
        }
      }
    }

    /* ---- 2) 스케줄 생성 ---- */
    var totalInterest = 0;
    var totalPayment = 0;

    for (month = 1; month <= n; month += 1) {
      var interest = balance * r;
      var principalPart = 0;
      var payment = 0;
      var isGrace = month <= grace;
      var repayIndex = month - grace - 1;

      if (isGrace) {
        principalPart = 0;
        payment = interest;
      } else if (method === "equal") {
        payment = pmt;
        principalPart = payment - interest;
      } else if (method === "principal") {
        principalPart = basePrincipal;
        payment = principalPart + interest;
      } else if (method === "bullet") {
        principalPart = month === n ? balance : 0;
        payment = principalPart + interest;
      } else {
        /* gradual — 연 1회 원금 상환액이 늘어난다 */
        principalPart = planned[repayIndex] || 0;
        payment = principalPart + interest;
      }

      /* 마지막 달: 잔액 정리 */
      if (month === n) {
        principalPart = balance;
        payment = principalPart + interest;
      }
      if (principalPart < 0) {
        /* 이자가 납입액보다 큰 비정상 구간 방지 */
        principalPart = 0;
        payment = interest;
      }
      if (principalPart > balance) {
        principalPart = balance;
        payment = principalPart + interest;
      }

      balance = Math.max(0, balance - principalPart);
      totalInterest += interest;
      totalPayment += payment;

      rows.push({
        month: month,
        payment: Math.round(payment),
        interest: Math.round(interest),
        principal: Math.round(principalPart),
        balance: Math.round(balance),
        grace: isGrace
      });
    }

    /* ---- 3) 연차 요약 ---- */
    var yearly = [];
    for (var y = 0; y < Math.ceil(n / 12); y += 1) {
      var slice = rows.slice(y * 12, y * 12 + 12);
      var yearPayment = 0;
      var yearInterest = 0;
      var yearPrincipal = 0;
      for (var i = 0; i < slice.length; i += 1) {
        yearPayment += slice[i].payment;
        yearInterest += slice[i].interest;
        yearPrincipal += slice[i].principal;
      }
      yearly.push({
        year: y + 1,
        payment: yearPayment,
        interest: yearInterest,
        principal: yearPrincipal,
        balance: slice[slice.length - 1].balance
      });
    }

    var firstPayment = rows.length ? rows[0].payment : 0;
    var lastPayment = rows.length ? rows[rows.length - 1].payment : 0;
    var avgPayment = rows.length ? Math.round(totalPayment / rows.length) : 0;
    var firstRepayPayment = rows.length
      ? rows[Math.min(grace, rows.length - 1)].payment
      : 0;
    var maxPayment = 0;
    for (var mi = 0; mi < rows.length; mi += 1) {
      if (rows[mi].payment > maxPayment) maxPayment = rows[mi].payment;
    }

    var warnings = [];
    if (graceRaw > grace) {
      warnings.push("거치기간이 대출 기간보다 길어 상환 기간을 1개월 남기고 줄였습니다.");
    }
    if (annualRate === 0) {
      warnings.push("연 이자율이 0%입니다. 이자가 붙지 않는 조건으로 계산합니다.");
    }
    if (method === "bullet") {
      warnings.push("만기일시는 기간 중 이자만 내다 만기에 원금을 한 번에 갚습니다. 만기 연장·재대출 위험이 있습니다.");
    }
    if (method === "gradual") {
      warnings.push(
        "체증식은 원금 상환액이 매년 " +
          Math.round(growth * 100) +
          "%씩 늘어나는 구조로 계산했습니다(초기 납입액이 낮고 뒤로 갈수록 늘어남, 총이자는 원리금균등보다 많음). 은행별 체증 폭·적용 방식은 상품마다 다릅니다."
      );
    }
    warnings.push(
      "이 계산은 원금에 이자만 붙이는 단순 상환 모델입니다. 중도상환수수료, 인지세, 근저당 설정비, 변동금리 전환, 코픽스·금리 상한은 반영하지 않았습니다."
    );

    return {
      method: method,
      methodLabel: CONST.METHODS[method].label,
      principal: principal,
      principalMan: principal / MAN,
      annualRate: annualRate,
      monthlyRate: r,
      years: years,
      months: n,
      graceMonths: grace,
      growthRate: growth,
      rows: rows,
      yearly: yearly,
      firstPayment: firstPayment,
      firstRepayPayment: firstRepayPayment,
      lastPayment: lastPayment,
      maxPayment: maxPayment,
      avgPayment: avgPayment,
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
      interestRatio: principal > 0 ? totalInterest / principal : 0,
      warnings: warnings
    };
  }

  /** 4가지 방식 한 번에 비교 */
  function compare(input) {
    var o = input || {};
    var order = ["equal", "principal", "gradual", "bullet"];
    var list = order.map(function (m) {
      return compute({
        principalMan: o.principalMan,
        interestRate: o.interestRate,
        years: o.years,
        graceMonths: o.graceMonths,
        growthRate: o.growthRate,
        method: m
      });
    });
    var minInterest = Infinity;
    list.forEach(function (it) {
      if (it.totalInterest < minInterest) minInterest = it.totalInterest;
    });
    return list.map(function (it) {
      return {
        method: it.method,
        label: it.methodLabel,
        firstPayment: it.firstPayment,
        lastPayment: it.lastPayment,
        avgPayment: it.avgPayment,
        totalInterest: it.totalInterest,
        totalPayment: it.totalPayment,
        interestRatio: it.interestRatio,
        best: it.totalInterest === minInterest
      };
    });
  }

  return {
    CONST: CONST,
    compute: compute,
    compare: compare
  };
});
