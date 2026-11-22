/* 단위가격 · 1+1 실구매가 비교기 — 페이지 연결
   - 상품 4개 입력 → 실구매가·총량·단가 계산
   - 최저 단가 상품 배지, 2등 대비 절약률, 비교 목록
   - 입력값을 주소에 남겨 '링크 공유'로 같은 비교를 다시 열 수 있게 함
*/
(function () {
  "use strict";

  var U = window.DotoriUnitPrice;
  var UI = window.DotoriUI;
  if (!U || !UI) return;

  var COUNT = 4;

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
    var rows = [];
    for (var i = 1; i <= COUNT; i += 1) {
      var row = {
        index: i,
        name: $id("up" + i + "-name"),
        price: $id("up" + i + "-price"),
        amount: $id("up" + i + "-amount"),
        unit: $id("up" + i + "-unit"),
        qty: $id("up" + i + "-qty"),
        coupon: $id("up" + i + "-coupon"),
        couponType: $id("up" + i + "-coupon-type"),
        card: $id("up" + i + "-card"),
        cardType: $id("up" + i + "-card-type"),
        badge: $id("up" + i + "-badge"),
        box: $id("up-item-" + i)
      };
      if (!row.price) return;
      rows.push(row);
    }

    var el = {
      label: $id("up-best-label"),
      value: $id("up-best"),
      sub: $id("up-best-sub"),
      name: $id("up-best-name"),
      paid: $id("up-best-paid"),
      total: $id("up-best-total"),
      saving: $id("up-saving"),
      diff: $id("up-diff"),
      count: $id("up-count"),
      note: $id("up-note"),
      list: $id("up-list"),
      mixed: $id("up-mixed"),
      copyAll: $id("up-copy-all")
    };

    var lastResult = null;

    /* ---------------- 값 읽기 ---------------- */

    function readProducts() {
      return rows.map(function (r) {
        return {
          index: r.index,
          name: r.name ? r.name.value : "",
          price: r.price.value,
          amount: r.amount.value,
          unit: r.unit.value,
          qty: r.qty.value,
          coupon: r.coupon.value,
          couponType: r.couponType.value,
          card: r.card.value,
          cardType: r.cardType.value
        };
      });
    }

    /* ---------------- 비교 목록 ---------------- */

    function paintList(result) {
      if (!el.list) return;
      el.list.innerHTML = "";

      if (!result.ranked.length) {
        var empty = document.createElement("p");
        empty.className = "field-help";
        empty.textContent = "가격과 용량이 모두 입력된 상품이 없습니다. 1번 상품부터 채워 보세요.";
        el.list.appendChild(empty);
        return;
      }

      var maxPrice = result.ranked.reduce(function (m, it) {
        return it.unitPrice > m ? it.unitPrice : m;
      }, 0);

      result.ranked.forEach(function (it) {
        var row = document.createElement("div");
        row.className = "up-row" + (it.rank === 1 ? " is-best" : "");

        var top = document.createElement("div");
        top.className = "up-row__top";

        var rank = document.createElement("span");
        rank.className = "up-row__rank";
        rank.textContent = it.rank + "위";
        top.appendChild(rank);

        var name = document.createElement("span");
        name.className = "up-row__name";
        name.textContent = it.name || it.index + "번 상품";
        top.appendChild(name);

        var price = document.createElement("span");
        price.className = "up-row__unit";
        price.textContent = it.perLabel + "당 " + it.unitPriceText + "원";
        top.appendChild(price);

        row.appendChild(top);

        var bar = document.createElement("div");
        bar.className = "up-row__bar";
        var fill = document.createElement("span");
        fill.style.width =
          (maxPrice > 0 ? Math.max(4, Math.round((it.unitPrice / maxPrice) * 100)) : 0) + "%";
        bar.appendChild(fill);
        row.appendChild(bar);

        var meta = document.createElement("p");
        meta.className = "up-row__meta";
        var saved = it.discount > 0 ? " · 할인 " + U.comma(it.discount) + "원 반영" : "";
        meta.textContent =
          "실구매 " +
          U.comma(it.paid) +
          "원 / " +
          it.amountText +
          " (총 " +
          it.totalText +
          ")" +
          saved;
        row.appendChild(meta);

        el.list.appendChild(row);
      });
    }

    /* ---------------- 결과 카드 ---------------- */

    function paint(result) {
      var best = result.best;

      rows.forEach(function (r) {
        var isBest = !!(best && best.index === r.index);
        if (r.box) r.box.classList.toggle("is-best", isBest);
        if (r.badge) r.badge.hidden = !isBest;
      });

      if (!best) {
        setText(el.label, "최저 단가 상품");
        setText(el.value, "—");
        setText(el.sub, "가격과 용량을 넣으면 100g·100ml·1개당 단가를 비교해 드립니다.");
        setText(el.name, "—");
        setText(el.paid, "—");
        setText(el.total, "—");
        setText(el.saving, "—");
        setText(el.diff, "—");
        setText(el.count, "0개");
        setText(el.note, "쿠폰과 카드·적립 할인은 입력한 금액만큼 반영합니다. 배송비는 가격에 포함해 넣으세요.");
        paintList(result);
        return;
      }

      setText(el.label, best.perLabel + "당 최저 단가");
      UI.countTo(el.value, best.unitPrice, U.unitText, 380);
      setText(
        el.sub,
        (best.name || best.index + "번 상품") +
          (result.second
            ? " · 2등보다 " + U.pctText(result.savingRate) + " 저렴"
            : " · 상품을 하나 더 넣으면 절약률까지 비교합니다")
      );
      setText(el.name, best.name || best.index + "번 상품");
      setText(el.paid, U.comma(best.paid) + "원");
      setText(el.total, best.totalText + " (" + best.amountText + ")");
      setText(el.saving, result.second ? U.pctText(result.savingRate) : "—");
      setText(
        el.diff,
        result.second ? U.unitText(result.absDiff) + "원 / " + best.perLabel : "—"
      );
      setText(el.count, result.validCount + "개");

      if (result.mixed) {
        setText(
          el.note,
          "무게(g)·부피(ml) 상품이 섞여 있습니다. 단가 숫자는 낮은 순으로 정렬했지만, g과 ml은 밀도가 달라 같은 기준으로 비교할 수 없습니다. 같은 종류끼리 비교하세요."
        );
      } else {
        setText(
          el.note,
          "단가는 쿠폰을 먼저 빼고, 남은 결제액에 카드·적립 할인을 적용해 계산했습니다. 배송비·개별 포장비는 가격에 포함해 넣으세요."
        );
      }

      if (el.mixed) el.mixed.hidden = !result.mixed;

      paintList(result);
    }

    /* ---------------- 주소에 비교 조건 남기기 ---------------- */

    var syncTimer = null;

    function syncUrl() {
      try {
        var url = new URL(window.location.href);
        ["p1", "p2", "p3", "p4"].forEach(function (k) {
          url.searchParams.delete(k);
        });
        rows.forEach(function (r, idx) {
          var price = String(r.price.value || "").replace(/[,\s]/g, "");
          var amount = String(r.amount.value || "").replace(/[,\s]/g, "");
          if (!price || !amount) return;
          url.searchParams.set(
            "p" + (idx + 1),
            [
              price,
              amount,
              r.unit.value,
              String(r.qty.value || 1).replace(/[,\s]/g, ""),
              String(r.coupon.value || 0).replace(/[,\s]/g, ""),
              r.couponType.value,
              String(r.card.value || 0).replace(/[,\s]/g, ""),
              r.cardType.value
            ].join("~")
          );
        });
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (e) {
        /* 주소 갱신이 막혀도 계산은 계속 */
      }
    }

    function restoreFromUrl() {
      var params;
      try {
        params = new URLSearchParams(window.location.search);
      } catch (e) {
        return;
      }
      var restored = 0;
      rows.forEach(function (r, idx) {
        var raw = params.get("p" + (idx + 1));
        if (!raw) return;
        var parts = raw.split("~");
        if (parts.length < 8) return;
        r.price.value = parts[0] ? U.comma(Number(parts[0])) : "";
        r.amount.value = parts[1];
        if (U.UNITS[parts[2]]) r.unit.value = parts[2];
        r.qty.value = parts[3] || "1";
        r.coupon.value = parts[4] || "0";
        r.couponType.value = parts[5] === "pct" ? "pct" : "won";
        r.card.value = parts[6] || "0";
        r.cardType.value = parts[7] === "pct" ? "pct" : "won";
        restored += 1;
      });
      return restored;
    }

    /* ---------------- 이벤트 ---------------- */

    function update() {
      var result = U.compare(readProducts());
      lastResult = result;
      paint(result);
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    var schedule = UI.onInput(
      rows.reduce(function (acc, r) {
        return acc.concat([r.price, r.amount, r.qty, r.coupon, r.card, r.name]);
      }, []),
      function () {
        update();
        if (syncTimer) window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(syncUrl, 500);
      },
      70
    );

    rows.forEach(function (r) {
      [r.unit, r.couponType, r.cardType].forEach(function (sel) {
        if (!sel) return;
        sel.addEventListener("change", function () {
          update();
          syncUrl();
        });
      });
    });

    if (el.copyAll) {
      el.copyAll.setAttribute("data-label", el.copyAll.textContent);
      el.copyAll.addEventListener("click", function () {
        if (!lastResult || !lastResult.ranked.length) {
          flash(el.copyAll, "입력 없음");
          return;
        }
        var bestLabel = lastResult.best.perLabel + "당 최저 단가";
        copyText(U.summary(lastResult, "단위가격 비교 — " + bestLabel)).then(
          function () {
            flash(el.copyAll, "복사 완료 ✓");
          },
          function () {
            flash(el.copyAll, "복사 실패");
          }
        );
      });
    }

    restoreFromUrl();
    update();
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
