/* 평수·전용면적 ㎡ 변환 계산기 — 페이지 연결
   - ㎡ ↔ 평 양방향 변환 (한쪽을 고치면 반대쪽이 따라옴)
   - 전용/공급면적 기준과 전용률로 공급면적·주거공용면적 추정
   - 매매가·전세금을 넣으면 평당 가격, 정사각 환산 한 변 길이
*/
(function () {
  "use strict";

  var P = window.DotoriPyeong;
  var UI = window.DotoriUI;
  if (!P || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
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
    var el = {
      sqm: $id("py-sqm"),
      pyeong: $id("py-pyeong"),
      rate: $id("py-rate"),
      price: $id("py-price"),
      value: $id("py-value"),
      sub: $id("py-sub"),
      sqmOut: $id("py-sqm-out"),
      pyeongOut: $id("py-pyeong-out"),
      basis: $id("py-basis-out"),
      rateOut: $id("py-rate-out"),
      supply: $id("py-supply"),
      shared: $id("py-shared"),
      type: $id("py-type"),
      perPyeong: $id("py-per-pyeong"),
      total: $id("py-total"),
      side: $id("py-side"),
      note: $id("py-note"),
      copy: $id("py-copy"),
      status: $id("py-status"),
      basisGroup: $id("py-basis"),
      rateChips: $id("py-rate-chips")
    };

    if (!el.sqm || !el.pyeong) return;

    if (!el.sqm.value) el.sqm.value = "84";
    if (!el.pyeong.value) el.pyeong.value = "25.41";
    if (el.rate && !el.rate.value) el.rate.value = "75";
    if (!el.price.value) el.price.value = "800,000,000";

    var syncing = false;
    var last = null;

    function basisValue() {
      return (UI.segmentValue(el.basisGroup) || "exclusive") === "supply"
        ? "supply"
        : "exclusive";
    }

    function paint() {
      var sqm = P.num(el.sqm.value, 0);
      if (sqm <= 0) {
        setText(el.value, "—");
        setText(el.sub, "면적을 넣으면 평수와 평형을 함께 계산합니다.");
        ["supply", "shared", "type", "perPyeong", "total", "side"].forEach(function (k) {
          if (el[k]) setText(el[k], "—");
        });
        last = null;
        return;
      }

      var pyeong = P.sqmToPyeong(sqm);
      var percent = el.rate ? el.rate.value : 75;
      var basis = basisValue();
      var calc =
        basis === "supply"
          ? P.exclusiveOf(sqm, percent)
          : P.supplyOf(sqm, percent);
      var price = P.num(el.price.value, 0);
      var type = P.pyeongType(calc.supply);
      var side = P.squareSide(sqm);
      var perPyeong = P.pricePerPyeong(price, calc.supply);

      setText(el.value, P.comma(pyeong, 2) + "평");
      setText(
        el.sub,
        (basis === "supply" ? "공급 " : "전용 ") +
          P.comma(sqm, 1) +
          "㎡ · 공급면적 " +
          P.comma(Math.round(calc.supply)) +
          "㎡ (" +
          P.comma(P.sqmToPyeong(calc.supply), 1) +
          "평, " +
          type +
          "평형 추정)"
      );

      setText(el.sqmOut, P.comma(sqm, 1) + "㎡");
      setText(el.pyeongOut, P.comma(pyeong, 2) + "평");
      setText(
        el.basis,
        basis === "supply" ? "공급면적 기준" : "전용면적 기준"
      );
      setText(el.rateOut, P.comma(calc.rate * 100, 1) + "%");
      setText(
        el.supply,
        P.comma(Math.round(calc.supply)) + "㎡ (" + P.comma(P.sqmToPyeong(calc.supply), 1) + "평)"
      );
      setText(
        el.shared,
        P.comma(Math.round(calc.shared)) + "㎡ (" + P.comma(P.sqmToPyeong(calc.shared), 1) + "평)"
      );
      setText(el.type, type + "평형 (공급 평 반올림)");
      var perPyeongExclusive = P.pricePerPyeong(price, calc.exclusive);
      setText(el.perPyeong, perPyeong > 0 ? P.won(perPyeong) : "집값을 넣으면 계산됩니다");
      setText(
        el.total,
        perPyeongExclusive > 0 ? P.won(perPyeongExclusive) : "—"
      );
      setText(el.side, "약 " + P.comma(side, 2) + "m × " + P.comma(side, 2) + "m");

      if (el.note) {
        el.note.textContent =
          basis === "supply"
            ? "입력한 면적을 공급면적으로 보고 전용면적을 역산했습니다. 매매가·전세금은 공급면적 기준 평당 가격으로 나눕니다."
            : "입력한 면적을 전용면적으로 보고 전용률로 공급면적을 추정했습니다. 실제 공급면적은 단지 면적표에 적힌 값을 넣는 편이 정확합니다.";
      }

      last = {
        sqm: sqm,
        pyeong: pyeong,
        supply: calc.supply,
        rate: calc.rate,
        price: price,
        pricePerPyeong: perPyeong,
        basisLabel: basis === "supply" ? "공급면적" : "전용면적"
      };

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    /* 한쪽을 고치면 반대쪽 값을 따라오게 한다 */
    function bindPair(from, to, convert) {
      if (!from || !to) return;
      from.addEventListener("input", function () {
        if (syncing) return;
        syncing = true;
        var v = P.num(from.value, 0);
        to.value = v > 0 ? convert(v) : "";
        syncing = false;
        paint();
      });
    }

    bindPair(el.sqm, el.pyeong, function (v) {
      return P.sqmToPyeong(v).toFixed(2);
    });
    bindPair(el.pyeong, el.sqm, function (v) {
      return (v * P.SQM_PER_PYEONG).toFixed(1);
    });

    UI.onInput([el.rate, el.price], paint, 60);

    if (el.rateChips) {
      var chips = Array.prototype.slice.call(
        el.rateChips.querySelectorAll("button[data-rate]")
      );
      chips.forEach(function (btn) {
        btn.addEventListener("click", function () {
          chips.forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          if (el.rate) el.rate.value = btn.getAttribute("data-rate");
          paint();
        });
      });
    }

    if (el.basisGroup) {
      UI.bindSegment(el.basisGroup, function () {
        paint();
      });
    }

    if (el.copy) {
      el.copy.setAttribute("data-label", el.copy.textContent);
      el.copy.addEventListener("click", function () {
        if (!last) {
          flash(el.copy, "면적 입력");
          return;
        }
        copyText(P.summary(last)).then(
          function () {
            flash(el.copy, "복사 완료 ✓");
            if (el.status) el.status.textContent = "면적 환산 결과를 클립보드에 복사했습니다.";
          },
          function () {
            flash(el.copy, "복사 실패");
            if (el.status) el.status.textContent = "복사하지 못했습니다. 화면의 숫자를 직접 옮겨 주세요.";
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
