/* 연차 일수 · 미사용 연차수당 계산기 — 페이지 연결
   - 입사일·기준일 → 근속 기간과 이번 연차 연도 연차 일수
   - 월 통상임금·월 소정근로시간·사용 일수 → 잔여 연차와 연차수당
   - 카톡·메모용 요약 복사
*/
(function () {
  "use strict";

  var A = window.DotoriAnnualLeave;
  var UI = window.DotoriUI;
  if (!A || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }

  function won(n) {
    return A.comma(n) + "원";
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

  function isoToday() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
  }

  function init() {
    var els = {
      hire: $id("al-hire"),
      base: $id("al-base"),
      wage: $id("al-wage"),
      hours: $id("al-hours"),
      used: $id("al-used"),
      days: $id("al-days"),
      daysSub: $id("al-days-sub"),
      tenure: $id("al-tenure"),
      expiry: $id("al-expiry"),
      next: $id("al-next"),
      rule: $id("al-rule"),
      hourly: $id("al-hourly"),
      daily: $id("al-daily"),
      usedOut: $id("al-used-out"),
      remain: $id("al-remain"),
      pay: $id("al-pay"),
      hint: $id("al-hint"),
      status: $id("al-status"),
      copy: $id("al-copy"),
      today: $id("al-today")
    };

    if (!els.hire || !els.wage) return;

    if (els.base && !els.base.value) els.base.value = isoToday();
    if (!els.hire.value) els.hire.value = "2021-03-02";

    var last = null;

    function readNumbers() {
      var wage = A.num(els.wage.value, 0);
      var hours = A.num(els.hours ? els.hours.value : 209, 209);
      var used = A.num(els.used.value, 0);
      return {
        wage: Math.max(0, wage),
        hours: hours > 0 ? hours : 209,
        used: Math.max(0, used)
      };
    }

    function paint() {
      var ent = A.entitlement(els.hire.value, els.base.value);

      if (!ent.ok) {
        setText(els.days, "—");
        setText(
          els.daysSub,
          ent.reason === "order"
            ? "기준일이 입사일보다 앞설 수 없습니다. 두 날짜를 확인해 주세요."
            : "입사일과 기준일을 넣으면 연차 일수를 계산합니다."
        );
        ["tenure", "expiry", "next", "rule", "hourly", "daily", "usedOut", "remain", "pay"].forEach(
          function (k) {
            if (els[k]) setText(els[k], "—");
          }
        );
        last = null;
        if (window.DotoriNotifyResize) window.DotoriNotifyResize();
        return;
      }

      var used = readNumbers().used;
      var remain = Math.max(0, ent.days - used);
      var numbers = readNumbers();
      var pay = A.leavePay(numbers.wage, numbers.hours, remain);

      setText(els.days, ent.days + "일");
      setText(
        els.daysSub,
        "근속 " +
          ent.tenureText +
          (ent.addDays > 0 ? " · 가산 " + ent.addDays + "일 포함" : "") +
          (ent.underOneYear ? " · 입사 1년 미만" : "")
      );

      setText(els.tenure, ent.tenureText + " (총 " + A.comma(ent.tenure.totalDays) + "일)");
      setText(els.expiry, ent.expiry ? A.toISO(ent.expiry).replace(/-/g, ".") + " 까지" : "—");
      setText(
        els.next,
        ent.underOneYear
          ? ent.nextAccrual
            ? A.toISO(ent.nextAccrual).replace(/-/g, ".") + " (개근 시 +1일)"
            : "1년 시점에 15일로 전환"
          : ent.nextIncrease
          ? ent.nextIncrease.years +
            "년 근속 " +
            A.toISO(ent.nextIncrease.date).replace(/-/g, ".") +
            " (+" +
            (ent.nextIncrease.days - ent.days) +
            "일)"
          : "25일 한도 (가산 없음)"
      );
      setText(els.rule, ent.rule);

      setText(els.hourly, won(pay.hourly));
      setText(els.daily, won(pay.daily));
      setText(els.usedOut, A.comma(used) + "일");
      setText(els.remain, A.comma(remain) + "일");
      setText(els.pay, won(pay.total));

      if (els.hint) {
        if (pay.wage <= 0) {
          els.hint.textContent =
            "월 통상임금을 넣으면 1일 통상임금과 연차수당이 함께 계산됩니다.";
          els.hint.className = "field-help";
        } else if (pay.belowMinWage) {
          els.hint.textContent =
            "계산한 통상시급이 2026년 최저임금 10,320원보다 낮습니다. 통상임금에 기본급과 매달 고정 수당(직책·기술·식대 등)이 모두 들어갔는지 확인해 주세요.";
          els.hint.className = "field-help";
        } else {
          els.hint.textContent =
            "통상임금은 기본급과 매달 고정으로 지급되는 수당을 합한 금액입니다. 성과급·연장근로수당은 포함하지 않습니다.";
          els.hint.className = "field-help";
        }
      }

      last = {
        ent: ent,
        used: used,
        remain: remain,
        pay: pay,
        baseText: (els.base.value || "").replace(/-/g, "."),
        expiryText: ent.expiry ? A.toISO(ent.expiry).replace(/-/g, ".") : ""
      };

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    var schedule = UI.onInput(
      [els.hire, els.base, els.wage, els.used, els.hours],
      paint,
      50
    );

    if (els.today) {
      els.today.addEventListener("click", function () {
        els.base.value = isoToday();
        paint();
      });
    }

    if (els.copy) {
      els.copy.setAttribute("data-label", els.copy.textContent);
      els.copy.addEventListener("click", function () {
        if (!last) {
          flash(els.copy, "날짜 확인");
          return;
        }
        var text = A.summary({
          baseText: last.baseText,
          tenureText: last.ent.tenureText,
          days: last.ent.days,
          addDays: last.ent.addDays,
          usedDays: last.used,
          remainDays: last.remain,
          pay: last.pay,
          expiryText: last.expiryText
        });
        copyText(text).then(
          function () {
            flash(els.copy, "복사 완료 ✓");
            if (els.status) els.status.textContent = "연차 요약을 클립보드에 복사했습니다.";
          },
          function () {
            flash(els.copy, "복사 실패");
            if (els.status) els.status.textContent = "복사하지 못했습니다. 화면의 숫자를 직접 옮겨 주세요.";
          }
        );
      });
    }

    paint();
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
