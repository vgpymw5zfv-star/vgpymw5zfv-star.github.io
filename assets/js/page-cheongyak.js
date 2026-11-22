/* 청약 가점 계산기 — 페이지 연결
   - 기준일·생년월일·혼인·주택 이력·부양가족·통장 → 84점 가점
   - 다음 구간 안내, 약한 항목 정리, 요약 복사
   코어: assets/js/cheongyak.js (window.DotoriCheongyak)
*/
(function () {
  "use strict";

  var C = window.DotoriCheongyak;
  var UI = window.DotoriUI;
  if (!C || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }

  function isoToday() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  function flash(btn, text) {
    if (!btn) return;
    var label = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", label);
    btn.textContent = text;
    btn.classList.add("is-copied");
    window.clearTimeout(btn._timer);
    btn._timer = window.setTimeout(function () {
      btn.textContent = label;
      btn.classList.remove("is-copied");
    }, 1600);
  }

  function yearsMonths(months) {
    var m = Math.max(0, Math.floor(months || 0));
    var y = Math.floor(m / 12);
    var rest = m % 12;
    if (y && rest) return y + "년 " + rest + "개월";
    if (y) return y + "년";
    return rest + "개월";
  }

  function init() {
    var els = {
      base: $id("ck-base"),
      birth: $id("ck-birth"),
      married: $id("ck-married"),
      marriage: $id("ck-marriage"),
      marriageWrap: $id("ck-marriage-wrap"),
      owned: $id("ck-owned"),
      disposed: $id("ck-disposed"),
      disposedWrap: $id("ck-disposed-wrap"),
      ownedWarn: $id("ck-owned-warn"),
      depSelf: $id("ck-dep-self"),
      depSpouse: $id("ck-dep-spouse"),
      depChild: $id("ck-dep-child"),
      depTotal: $id("ck-dep-total"),
      join: $id("ck-join"),
      spouseAccount: $id("ck-spouse-account"),
      total: $id("ck-total"),
      totalSub: $id("ck-total-sub"),
      gauge: $id("ck-gauge"),
      nhScore: $id("ck-nh-score"),
      nhValue: $id("ck-nh-value"),
      depScore: $id("ck-dep-score"),
      depValue: $id("ck-dep-value"),
      acctScore: $id("ck-acct-score"),
      acctValue: $id("ck-acct-value"),
      next: $id("ck-next"),
      note: $id("ck-note"),
      weak: $id("ck-weak"),
      copy: $id("ck-copy"),
      status: $id("ck-status")
    };

    if (!els.base || !els.birth) return;

    if (!els.base.value) els.base.value = isoToday();

    var marriedOn = false;
    var ownedMode = "none";

    if (UI.bindSegment) {
      UI.bindSegment(els.married, function (v) {
        marriedOn = v === "yes";
        if (els.marriageWrap) els.marriageWrap.hidden = !marriedOn;
        if (els.depSpouse) els.depSpouse.disabled = !marriedOn;
        if (els.spouseAccount) els.spouseAccount.disabled = !marriedOn;
        if (!marriedOn && els.spouseAccount) {
          els.spouseAccount.value = "0";
        }
        paint();
      });
      UI.bindSegment(els.owned, function (v) {
        ownedMode = v || "none";
        if (els.disposedWrap) els.disposedWrap.hidden = ownedMode !== "sold";
        if (els.ownedWarn) els.ownedWarn.hidden = ownedMode !== "own";
        paint();
      });
    }

    if (els.depSpouse) els.depSpouse.disabled = true;
    if (els.spouseAccount) els.spouseAccount.disabled = true;

    var last = null;

    function readInputs() {
      return {
        base: els.base.value,
        birth: els.birth.value,
        married: marriedOn,
        marriage: marriedOn && els.marriage ? els.marriage.value : "",
        owned: ownedMode === "own",
        disposed: ownedMode === "sold" && els.disposed ? els.disposed.value : "",
        depSelf: els.depSelf.value,
        depSpouse: marriedOn ? els.depSpouse.value : 0,
        depChild: els.depChild.value,
        joinDate: els.join.value,
        spouseAccountMonths: marriedOn && els.spouseAccount ? els.spouseAccount.value : 0
      };
    }

    function depCountLabel(n) {
      return n + "명";
    }

    function weakItems(r) {
      var items = [];
      if (r.owned) {
        items.push({
          gap: 32,
          text: "지금 유주택이면 1순위 가점제 대상이 아닙니다. 가점을 올리는 대신 추첨제·특별공급 요건을 확인하세요."
        });
      } else if (r.noHouse.zeroReason === "under30") {
        items.push({
          gap: 32,
          text: "만 30세 미만 미혼이라 무주택기간 점수는 0점입니다. 만 30세가 되는 날부터 자동으로 쌓이니, 그 전에는 통장 가입기간을 늘리는 쪽이 현실적입니다."
        });
      } else if (r.noHouse.score < 32) {
        items.push({
          gap: 32 - r.noHouse.score,
          text:
            "무주택기간이 " +
            yearsMonths(r.noHouse.months) +
            "으로 " +
            r.noHouse.score +
            "점입니다. 1년마다 2점씩 올라 15년 이상이면 32점 만점이 됩니다."
        });
      }
      if (r.dependent.score < 35) {
        items.push({
          gap: 35 - r.dependent.score,
          text:
            "부양가족 " +
            r.dependent.count +
            "명으로 " +
            r.dependent.score +
            "점입니다. 등본에 3년 이상 함께 등재된 직계존속이나 미혼 자녀가 더 있는지 확인해 보세요. 1명마다 5점입니다."
        });
      }
      if (r.account.score < 17) {
        items.push({
          gap: 17 - r.account.score,
          text:
            "청약통장 가입기간이 " +
            yearsMonths(r.account.months) +
            "으로 " +
            r.account.score +
            "점입니다. 해지하면 6개월 미만(1점)부터 다시 시작하니 유지하는 것이 유리합니다."
        });
      }
      items.sort(function (a, b) {
        return b.gap - a.gap;
      });
      return items;
    }

    function paint() {
      var r = C.compute(readInputs());

      if (!r.ok) {
        setText(els.total, "—");
        setText(
          els.totalSub,
          r.reason === "birthFuture"
            ? "생년월일이 기준일보다 늦을 수 없습니다. 날짜를 확인해 주세요."
            : "생년월일을 넣으면 점수를 계산합니다."
        );
        ["nhScore", "depScore", "acctScore", "next"].forEach(function (k) {
          if (els[k]) setText(els[k], "—");
        });
        ["nhValue", "depValue", "acctValue"].forEach(function (k) {
          if (els[k]) setText(els[k], "");
        });
        if (els.gauge) els.gauge.style.width = "0%";
        if (els.weak) els.weak.innerHTML = "";
        if (els.depTotal) setText(els.depTotal, depCountLabel(0));
        last = null;
        if (window.DotoriNotifyResize) window.DotoriNotifyResize();
        return;
      }

      UI.countTo(
        els.total,
        r.total,
        function (v) {
          return Math.round(v) + "점";
        },
        360,
        r.total + "점"
      );
      setText(
        els.totalSub,
        r.owned
          ? "유주택은 1순위 가점제 대상이 아닙니다. 가점은 참고용으로만 보세요."
          : "84점 만점 중 " + r.total + "점 · 기준일 " + readInputs().base
      );
      if (els.gauge) {
        els.gauge.style.width = Math.max(0, Math.min(100, (r.total / 84) * 100)) + "%";
      }

      setText(els.nhScore, r.noHouse.score + "점");
      setText(
        els.nhValue,
        r.noHouse.zeroReason === "owned"
          ? "유주택"
          : r.noHouse.zeroReason === "under30"
            ? "만 30세 미만 미혼"
            : yearsMonths(r.noHouse.months)
      );
      setText(els.depScore, r.dependent.score + "점");
      setText(els.depValue, "본인 제외 " + r.dependent.count + "명");
      setText(els.acctScore, r.account.score + "점");
      setText(
        els.acctValue,
        yearsMonths(r.account.months) + (r.account.minorCapped ? " (미성년 5년 인정)" : "")
      );

      if (r.owned) {
        setText(els.next, "가점제 대상 아님");
      } else if (r.next) {
        setText(
          els.next,
          r.next.kind === "noHouse"
            ? r.next.years + "년(" + r.next.date + ") · " + r.next.months + "개월 남음"
            : "통장 " + r.next.years + "년(" + r.next.date + ") · " + r.next.months + "개월 남음"
        );
      } else if (r.noHouse.score >= 32 && r.account.score >= 17) {
        setText(els.next, "두 항목 만점");
      } else {
        setText(els.next, "—");
      }

      if (els.note) {
        if (r.account.minorCapped) {
          setText(
            els.note,
            "만 19세 이전에 가입한 기간은 최대 5년까지만 인정됩니다(2024년 7월 1일 시행). 실제 가점은 청약홈 순위확인서로 확정하세요."
          );
        } else {
          setText(
            els.note,
            "가점은 배점표만으로 계산한 참고값입니다. 실제 가점은 입주자모집공고일 기준으로 청약홈에서 확정됩니다."
          );
        }
      }

      if (els.depTotal) setText(els.depTotal, depCountLabel(r.dependent.count));

      if (els.weak) {
        var items = weakItems(r);
        if (!items.length) {
          els.weak.innerHTML =
            '<p class="muted-sm" style="margin:0">세 항목 모두 만점입니다. 남은 것은 공고문의 가점제 비율과 경쟁률 확인입니다.</p>';
        } else {
          els.weak.innerHTML =
            '<ul class="mini-list">' +
            items
              .slice(0, 3)
              .map(function (it, i) {
                return (
                  '<li><span class="num">' +
                  (i + 1) +
                  "</span><span>" +
                  it.text +
                  "</span></li>"
                );
              })
              .join("") +
            "</ul>";
        }
      }

      last = r;
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    if (UI.onInput) {
      UI.onInput(
        [
          els.base,
          els.birth,
          els.marriage,
          els.disposed,
          els.depSelf,
          els.depSpouse,
          els.depChild,
          els.join,
          els.spouseAccount
        ],
        paint,
        40
      );
    }

    if (els.copy) {
      els.copy.addEventListener("click", function () {
        if (!last) {
          if (els.status) els.status.textContent = "생년월일을 먼저 넣어 주세요.";
          return;
        }
        var text = C.summary(last) + "\n기준일 " + readInputs().base;
        copyText(text).then(
          function () {
            flash(els.copy, "복사 완료 ✓");
            if (els.status) els.status.textContent = "요약을 클립보드에 복사했습니다.";
          },
          function () {
            flash(els.copy, "복사 실패");
            if (els.status) els.status.textContent = "복사하지 못했습니다. 값을 직접 확인해 주세요.";
          }
        );
      });
    }

    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
