/* ==========================================================================
   모임 회비 · 더치페이 정산 계산기 — 순수 계산 코어
   - 참석자별로 차수(1차·2차·3차)를 나눠 부담액을 계산
   - 차수마다 결제자가 다를 수 있다 (1차 A, 2차 B)
   - 정산 단위(1·10·100·1,000원)로 올리고, 남는 끝전은 결제자가 부담
     → 각자 부담액의 합이 그 차수 결제액과 정확히 일치
   - 최소 송금(서로 상계) / 결제자에게 각자 송금 두 가지 방식
   ========================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.DotoriDutch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var UNITS = [1, 10, 100, 1000];

  function num(value, fallback) {
    if (typeof value === "number" && isFinite(value)) return value;
    if (typeof value === "string") {
      var cleaned = value.replace(/[,\s원]/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;
      var n = Number(cleaned);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function comma(n) {
    if (typeof n !== "number" || !isFinite(n)) n = 0;
    return Math.round(n).toLocaleString("ko-KR");
  }

  function won(n) {
    return comma(n) + "원";
  }

  function ceilTo(n, unit) {
    var u = UNITS.indexOf(unit) >= 0 ? unit : 1;
    if (u === 1) return Math.ceil(n - 1e-9);
    return Math.ceil(n / u - 1e-9) * u;
  }

  function cleanName(name, index) {
    var s = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
    if (s === "") return "참석자 " + (index + 1);
    return s.length > 12 ? s.slice(0, 12) : s;
  }

  /**
   * @param {string[]} names 참석자 이름
   * @param {Array} rounds [{amount, payer, participants:[bool]}]
   * @param {number} unit 정산 단위
   */
  function compute(names, rounds, unit) {
    var people = (names || []).map(cleanName);
    var n = people.length;
    var u = UNITS.indexOf(unit) >= 0 ? unit : 1;
    var paid = [];
    var owed = [];
    var i;
    for (i = 0; i < n; i += 1) {
      paid.push(0);
      owed.push(0);
    }

    var perRound = [];
    var totalAmount = 0;
    var activeRounds = 0;
    var warnings = [];

    (rounds || []).forEach(function (raw, idx) {
      var amount = Math.max(0, Math.round(num(raw && raw.amount, 0)));
      var flags = (raw && (raw.participants || raw.parts)) || [];
      var parts = [];
      for (var k = 0; k < n; k += 1) {
        if (flags[k]) parts.push(k);
      }
      var label = (raw && raw.label) || idx + 1 + "차";
      var payer = raw && typeof raw.payer === "number" ? raw.payer : -1;
      if (payer < 0 || payer >= n || parts.indexOf(payer) < 0) {
        payer = parts.length ? parts[0] : -1;
      }

      if (amount <= 0 || parts.length === 0) {
        perRound.push({
          index: idx,
          label: label,
          amount: amount,
          count: parts.length,
          payer: payer,
          payerShare: 0,
          share: 0,
          rows: [],
          empty: true
        });
        if (amount > 0 && parts.length === 0) {
          warnings.push(label + " 결제액이 있지만 참석자가 없어 계산에서 빠졌습니다.");
        }
        return;
      }

      totalAmount += amount;
      activeRounds += 1;

      var share;
      var payerShare;
      if (parts.length === 1) {
        share = 0;
        payerShare = amount;
      } else {
        share = ceilTo(amount / parts.length, u);
        payerShare = amount - share * (parts.length - 1);
        /* 단위가 너무 커서 결제자 부담이 음수가 되면 원 단위로 다시 나눈다 */
        if (payerShare < 0) {
          share = ceilTo(amount / parts.length, 1);
          payerShare = amount - share * (parts.length - 1);
        }
      }

      var rows = parts.map(function (personIndex) {
        var pay = personIndex === payer ? payerShare : share;
        owed[personIndex] += pay;
        return {
          index: personIndex,
          name: people[personIndex],
          pay: pay,
          isPayer: personIndex === payer
        };
      });

      if (payer >= 0) paid[payer] += amount;

      perRound.push({
        index: idx,
        label: label,
        amount: amount,
        count: parts.length,
        payer: payer,
        payerName: payer >= 0 ? people[payer] : "",
        payerShare: payerShare,
        share: share,
        rows: rows,
        empty: false
      });
    });

    var balances = people.map(function (name, idx) {
      return {
        index: idx,
        name: name,
        paid: paid[idx],
        owed: owed[idx],
        net: paid[idx] - owed[idx]
      };
    });

    /* 결제자에게 각자 송금 */
    var direct = [];
    perRound.forEach(function (r) {
      if (r.empty || r.payer < 0) return;
      r.rows.forEach(function (row) {
        if (row.isPayer) return;
        if (row.pay <= 0) return;
        direct.push({
          from: row.name,
          to: r.payerName,
          amount: row.pay,
          label: r.label
        });
      });
    });

    var netted = settle(balances);
    var totalOwed = owed.reduce(function (a, b) {
      return a + b;
    }, 0);
    var maxSpender = null;
    balances.forEach(function (b) {
      if (!maxSpender || b.paid > maxSpender.paid) maxSpender = b;
    });

    return {
      people: people,
      rounds: perRound,
      balances: balances,
      direct: direct,
      netted: netted,
      totalAmount: totalAmount,
      totalOwed: totalOwed,
      averageShare: n > 0 ? totalAmount / n : 0,
      perHead: totalAmount > 0 && n > 0 ? totalAmount / n : 0,
      activeRounds: activeRounds,
      maxSpender: maxSpender,
      unit: u,
      warnings: warnings
    };
  }

  /* 잔액(낸 돈 − 부담액)을 최소 송금 횟수로 상계 */
  function settle(balances) {
    var creditors = [];
    var debtors = [];
    balances.forEach(function (b) {
      if (b.net > 0) creditors.push({ name: b.name, amount: b.net });
      else if (b.net < 0) debtors.push({ name: b.name, amount: -b.net });
    });
    creditors.sort(function (a, b) {
      return b.amount - a.amount;
    });
    debtors.sort(function (a, b) {
      return b.amount - a.amount;
    });

    var out = [];
    var ci = 0;
    var di = 0;
    var guard = 0;
    while (ci < creditors.length && di < debtors.length && guard < 200) {
      guard += 1;
      var c = creditors[ci];
      var d = debtors[di];
      var pay = Math.min(c.amount, d.amount);
      if (pay > 0) {
        out.push({ from: d.name, to: c.name, amount: pay });
        c.amount -= pay;
        d.amount -= pay;
      }
      if (c.amount <= 0) ci += 1;
      if (d.amount <= 0) di += 1;
    }
    return out;
  }

  /* 카톡에 붙여 넣을 정산 문구 */
  function kakaoText(result, opts) {
    if (!result) return "";
    var o = opts || {};
    var title = o.title || "모임 정산";
    var date = o.date || "";
    var head = date ? "[ " + date + " " + title + " ]" : "[ " + title + " ]";
    var lines = [head];

    if (result.totalAmount <= 0) {
      lines.push("금액을 넣으면 정산 문구가 만들어집니다.");
      return lines.join("\n");
    }

    lines.push(
      "총 " +
        won(result.totalAmount) +
        " · " +
        result.people.length +
        "명 · " +
        result.activeRounds +
        "차수"
    );
    result.rounds.forEach(function (r) {
      if (r.empty) return;
      var detail =
        r.count === 1
          ? r.payerName + " 결제 · 1명"
          : r.payerName + " 결제 · " + r.count + "명 → 각 " + won(r.share);
      lines.push("· " + r.label + " " + won(r.amount) + " — " + detail);
    });

    lines.push("");
    if (o.mode === "direct") {
      lines.push("보낼 돈");
      result.direct.forEach(function (t) {
        lines.push("· " + t.from + " → " + t.to + " " + won(t.amount));
      });
      if (!result.direct.length) lines.push("· 보낼 돈 없음");
    } else {
      lines.push("보낼 돈 (서로 상계)");
      result.netted.forEach(function (t) {
        lines.push("· " + t.from + " → " + t.to + " " + won(t.amount));
      });
      if (!result.netted.length) lines.push("· 보낼 돈 없음");
    }

    var totalSend = (o.mode === "direct" ? result.direct : result.netted).reduce(
      function (a, t) {
        return a + t.amount;
      },
      0
    );
    lines.push("합계 " + won(totalSend));
    lines.push("도토리랩 더치페이 계산기");
    return lines.join("\n");
  }

  return {
    UNITS: UNITS,
    num: num,
    comma: comma,
    won: won,
    ceilTo: ceilTo,
    compute: compute,
    settle: settle,
    kakaoText: kakaoText
  };
});
