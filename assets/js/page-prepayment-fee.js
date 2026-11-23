/* 중도상환수수료 계산기 — 페이지 연결
   - 실행일·만기일·상환금액·수수료율로 수수료 계산, 3년 면제일 안내
   - 시점별 수수료 표, 지금 갚을지 비교(이자 vs 수수료), 요약 복사
   코어: assets/js/prepayment-fee.js (window.DotoriPrepay)
*/
(function () {
  "use strict";

  var K = window.DotoriPrepay;
  var UI = window.DotoriUI;
  if (!K || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }

  function won(n) {
    return Math.round(n || 0).toLocaleString("ko-KR") + "원";
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

  function init() {
    var els = {
      start: $id("pf-start"),
      maturity: $id("pf-maturity"),
      repay: $id("pf-repay"),
      amount: $id("pf-amount"),
      rate: $id("pf-rate"),
      preset: $id("pf-preset"),
      loanRate: $id("pf-loan-rate"),
      fee: $id("pf-fee"),
      feeSub: $id("pf-fee-sub"),
      rateOut: $id("pf-rate-out"),
      denom: $id("pf-denom"),
      days: $id("pf-days"),
      exempt: $id("pf-exempt"),
      note: $id("pf-note"),
      warn: $id("pf-warn"),
      warnText: $id("pf-warn-text"),
      waitInterest: $id("pf-wait-interest"),
      nowFee: $id("pf-now-fee"),
      benefit: $id("pf-benefit"),
      compareHelp: $id("pf-compare-help"),
      schedule: $id("pf-schedule"),
      text: $id("pf-text"),
      copy: $id("pf-copy"),
      status: $id("pf-status")
    };

    if (!els.start || !els.amount) return;

    /* 기본값: 1년 전 실행·10년 만기·오늘 상환 (예시) */
    var today = new Date();
    if (!els.start.value) {
      var startDefault = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      els.start.value =
        startDefault.getFullYear() +
        "-" +
        (startDefault.getMonth() + 1 < 10 ? "0" : "") +
        (startDefault.getMonth() + 1) +
        "-" +
        (startDefault.getDate() < 10 ? "0" : "") +
        startDefault.getDate();
    }
    if (!els.maturity.value) {
      var maturityDefault = new Date(today.getFullYear() + 9, today.getMonth(), today.getDate());
      els.maturity.value =
        maturityDefault.getFullYear() +
        "-" +
        (maturityDefault.getMonth() + 1 < 10 ? "0" : "") +
        (maturityDefault.getMonth() + 1) +
        "-" +
        (maturityDefault.getDate() < 10 ? "0" : "") +
        maturityDefault.getDate();
    }
    if (!els.repay.value) els.repay.value = isoToday();

    /* 은행·상품 참고 요율 채우기 */
    if (els.preset) {
      var html = '<option value="">직접 입력</option>';
      K.RATE_PRESETS.forEach(function (group) {
        html += '<optgroup label="' + group.group + '">';
        group.items.forEach(function (item) {
          html +=
            '<option value="' +
            item.rate +
            '">' +
            item.label +
            "</option>";
        });
        html += "</optgroup>";
      });
      els.preset.innerHTML = html;
      els.preset.addEventListener("change", function () {
        var v = els.preset.value;
        if (v === "") return;
        if (els.rate) els.rate.value = v;
        paint();
      });
    }

    function paint() {
      var result = K.compute({
        start: els.start.value,
        maturity: els.maturity.value,
        repay: els.repay.value,
        amount: els.amount.value,
        rate: els.rate ? els.rate.value : "",
        loanRate: els.loanRate ? els.loanRate.value : ""
      });

      if (!result.ok) {
        var message = "실행일·만기일·갚을 금액을 넣으면 수수료가 나옵니다.";
        if (result.reason === "start") message = "대출 실행일을 넣어 주세요.";
        if (result.reason === "maturity") message = "대출 만기일을 넣어 주세요.";
        if (result.reason === "repay") message = "상환 예정일을 넣어 주세요.";
        if (result.reason === "amount") message = "중도상환금액을 0원보다 크게 넣어 주세요.";
        if (result.reason === "term") message = "만기일이 실행일보다 뒤여야 합니다.";
        if (result.reason === "order") message = "상환 예정일이 실행일보다 앞입니다. 날짜를 확인해 주세요.";

        setText(els.fee, "—");
        setText(els.feeSub, message);
        ["rateOut", "denom", "days", "exempt", "waitInterest", "nowFee", "benefit"].forEach(function (k) {
          if (els[k]) setText(els[k], "—");
        });
        if (els.warn) els.warn.hidden = true;
        if (els.schedule) {
          var tb = els.schedule.querySelector("tbody");
          if (tb) tb.innerHTML = "";
        }
        if (els.text) els.text.value = "";
        if (window.DotoriNotifyResize) window.DotoriNotifyResize();
        return;
      }

      UI.countTo(els.fee, result.fee, won, 420, won(result.fee));

      var calcLine =
        won(result.amount) +
        " × " +
        result.rate +
        "% × " +
        result.remainDays.toLocaleString("ko-KR") +
        "일 ÷ " +
        result.denomDays.toLocaleString("ko-KR") +
        "일";
      if (result.exemptReason === "period") {
        calcLine = "실행일부터 3년이 지나 수수료가 면제됩니다 (0원)";
      } else if (result.exemptReason === "maturity") {
        calcLine = "만기 이후 상환으로 수수료가 없습니다 (0원)";
      }
      setText(els.feeSub, calcLine);

      setText(els.rateOut, result.rate + "%");
      setText(
        els.denom,
        result.capped
          ? "3년 " + result.denomDays.toLocaleString("ko-KR") + "일 (만기 " + result.termLabel + ")"
          : result.termLabel + " " + result.denomDays.toLocaleString("ko-KR") + "일"
      );
      setText(
        els.days,
        result.elapsedDays.toLocaleString("ko-KR") +
          "일 / " +
          Math.max(0, result.remainDays).toLocaleString("ko-KR") +
          "일"
      );
      setText(
        els.exempt,
        result.limitDate + (result.daysToExempt > 0 ? " (D-" + result.daysToExempt + ")" : " (지남)")
      );

      if (els.note) {
        if (result.exemptReason === "period") {
          setText(
            els.note,
            "실행일 " +
              result.start +
              "부터 3년이 지난 " +
              result.repay +
              "에 상환하므로 수수료를 부과할 수 없습니다(금융소비자 보호에 관한 법률 제20조제1항제4호나목)."
          );
        } else {
          setText(
            els.note,
            "금융소비자 보호에 관한 법률 제20조제1항제4호나목에 따라 3년 이내 상환에만 부과됩니다. 면제일은 실행일 " +
              result.start +
              "부터 3년째 되는 " +
              result.limitDate +
              "입니다."
          );
        }
      }

      if (els.warn) {
        if (result.nearMaturity && result.exemptReason === null) {
          els.warn.hidden = false;
          if (els.warnText) {
            setText(
              els.warnText,
              "대출잔여일수가 " +
                result.remainDays +
                "일로 1개월 미만입니다. 은행 약관에 따라 이 구간은 수수료를 면제하는 경우가 많으니, 실제 청구 전에 은행 앱에서 예상 수수료를 확인하세요."
            );
          }
        } else {
          els.warn.hidden = true;
        }
      }

      if (result.loanRate > 0) {
        setText(els.waitInterest, won(result.waitInterest));
        setText(els.nowFee, won(result.fee));
        if (result.benefitNow > 0) {
          setText(els.benefit, "지금 갚는 게 +" + won(result.benefitNow) + " 유리");
        } else if (result.benefitNow < 0) {
          setText(els.benefit, "기다리는 게 +" + won(-result.benefitNow) + " 유리");
        } else {
          setText(els.benefit, "차이 없음");
        }
      } else {
        setText(els.waitInterest, "대출금리 입력");
        setText(els.nowFee, won(result.fee));
        setText(els.benefit, "대출금리 입력");
      }

      if (els.schedule) {
        var tbody = els.schedule.querySelector("tbody");
        if (tbody) {
          tbody.innerHTML = result.schedule
            .map(function (row) {
              return (
                "<tr>" +
                '<th scope="row">' +
                row.label +
                "</th>" +
                '<td class="is-text" data-label="상환일">' +
                row.date +
                "</td>" +
                '<td data-label="잔여일수">' +
                row.remainDays +
                "일</td>" +
                '<td data-label="수수료">' +
                (row.exempt ? "0원" : won(row.fee)) +
                "</td>" +
                "</tr>"
              );
            })
            .join("");
        }
      }

      if (els.text) {
        var lines = [K.summary(result)];
        lines.push(
          "· 실행일 " +
            result.start +
            " · 만기 " +
            result.maturity +
            " · 상환일 " +
            result.repay
        );
        lines.push(
          "· 경과 " +
            result.elapsedDays +
            "일 / 잔여 " +
            Math.max(0, result.remainDays) +
            "일 · 면제일 " +
            result.limitDate
        );
        if (result.loanRate > 0) {
          lines.push(
            "· 면제일까지 이자 " +
              won(result.waitInterest) +
              (result.benefitNow >= 0
                ? " → 지금 상환이 " + won(result.benefitNow) + " 유리"
                : " → 면제일 이후 상환이 " + won(-result.benefitNow) + " 유리")
          );
        }
        els.text.value = lines.join("\n");
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    [els.start, els.maturity, els.repay, els.amount, els.rate, els.loanRate].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", paint);
      el.addEventListener("change", paint);
    });

    paint();

    if (els.copy) {
      els.copy.addEventListener("click", function () {
        var text = (els.text && els.text.value) || "";
        if (!text) {
          if (els.status) els.status.textContent = "계산할 값이 먼저 필요합니다.";
          return;
        }
        copyText(text).then(
          function () {
            flash(els.copy, "복사 완료 ✓");
            if (els.status) els.status.textContent = "요약을 복사했습니다. 은행 앱·상담에 그대로 붙여 넣으세요.";
          },
          function () {
            flash(els.copy, "복사 실패");
            if (els.status) els.status.textContent = "복사하지 못했습니다. 아래 칸의 문구를 직접 선택해 주세요.";
          }
        );
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
