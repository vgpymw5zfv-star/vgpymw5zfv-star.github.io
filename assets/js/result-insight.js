/* 결과 요약 — 한 줄 결론 배지 + 구성 비율 바
   - 설정은 insight-data.js(window.DOTORI_INSIGHT)에서 온다 (build.py 가 생성)
   - 결과 DOM 이 바뀔 때마다(입력·세그먼트·카운트업) 값을 다시 읽어 비율을 그린다
   - 값이 없거나 '—' 이면 조용히 숨긴다 (레이아웃·가로 스크롤에 영향 없음)
*/
(function () {
  "use strict";

  var MAP = window.DOTORI_INSIGHT || null;
  if (!MAP) return;

  var box = document.querySelector("[data-insight]");
  if (!box) return;
  var slug = box.getAttribute("data-insight") || "";
  var cfg = MAP[slug];
  if (!cfg) return;

  var badgeEl = box.querySelector("[data-insight-badge]");
  var badgeWrap = box.querySelector(".result-insight__badge");
  var barEl = box.querySelector("[data-insight-bar]");
  var legendEl = box.querySelector("[data-insight-legend]");
  var card = box.closest ? box.closest(".result-card") : null;
  var timer = 0;
  var lastHTML = "";

  function el(id) {
    return document.getElementById(id);
  }

  function text(id) {
    var node = el(id);
    if (!node) return "";
    var t = (node.textContent || "").replace(/\s+/g, " ").trim();
    /* 히어로 숫자는 단위가 옆 <small>에 있어서("2,912,463" + "원") 붙여 준다 */
    var hero = node.closest ? node.closest(".result-value") : null;
    if (hero) {
      var small = hero.querySelector("small");
      var unit = small ? (small.textContent || "").trim() : "";
      if (unit && /\d$/.test(t)) return t + unit;
    }
    return t;
  }

  /* "1,346,400원" · "134만 6,400원" · "1,000만원" · "84.9㎡" · "3.4%" → 숫자 */
  function num(value) {
    var s = String(value || "").replace(/[,\s]/g, "");
    if (!/\d/.test(s)) return NaN;
    if (/^[—\-–]/.test(s)) return NaN;
    var total = 0;
    var m = s.match(/([\d.]+)억/);
    if (m) {
      total += parseFloat(m[1]) * 1e8;
      s = s.replace(m[0], "");
    }
    m = s.match(/([\d.]+)만/);
    if (m) {
      total += parseFloat(m[1]) * 1e4;
      s = s.replace(m[0], "");
    }
    m = s.match(/-?[\d.]+/);
    if (m) total += parseFloat(m[0]);
    return isFinite(total) ? total : NaN;
  }

  function pct(v) {
    var r = Math.round(v * 10) / 10;
    return String(r).replace(/\.0$/, "");
  }

  function fill(template, parts, values, total) {
    if (!template) return "";
    var share = total > 0 ? (values[0] / total) * 100 : NaN;
    var out = template
      .replace(/\{pct\}/g, isFinite(share) ? pct(share) : "")
      .replace(/\{v(\d)\}/g, function (_all, i) {
        var v = values[Number(i)];
        return isFinite(v) ? pct(v) : "";
      })
      .replace(/\{t:([\w-]+)\}/g, function (_all, id) {
        return text(id);
      });
    /* 채워지지 않은 토큰이나 '—' 값이 남으면 배지를 쓰지 않는다 */
    if (/\{[^}]+\}/.test(out)) return "";
    if (!out || out.indexOf("—") !== -1) return "";
    return out;
  }

  function render() {
    var raw = cfg.parts || [];
    var parts = [];
    var values = [];
    var ok = true;

    raw.forEach(function (p) {
      var label = p[0];
      var value = num(text(p[1]));
      if (p[2]) {
        var sub = num(text(p[2]));
        if (isFinite(sub)) value = value - sub;
      }
      if (!isFinite(value) || value <= 0) ok = false;
      parts.push(label);
      values.push(value);
    });

    var total = 0;
    values.forEach(function (v) {
      if (isFinite(v) && v > 0) total += v;
    });

    var badgeText = fill(cfg.badge, parts, values, total);
    var showBadge = !!badgeText;
    if (badgeWrap) badgeWrap.hidden = !showBadge;
    if (badgeEl) badgeEl.textContent = badgeText;

    var showBar = ok && parts.length >= 2 && total > 0;
    if (barEl) {
      barEl.hidden = !showBar;
      if (showBar) {
        var html = "";
        var label = parts
          .map(function (name, i) {
            return name + " " + pct((values[i] / total) * 100) + "%";
          })
          .join(", ");
        barEl.setAttribute("aria-label", "구성 비율 — " + label);
        parts.forEach(function (name, i) {
          var w = Math.max(2, Math.round((values[i] / total) * 100));
          html +=
            '<span class="result-insight__seg is-' +
            i +
            '" style="width:' +
            w +
            '%"></span>';
        });
        if (html !== lastHTML) {
          barEl.innerHTML = html;
          lastHTML = html;
        }
      }
    }

    if (legendEl) {
      legendEl.hidden = !showBar;
      if (showBar) {
        var items = "";
        parts.forEach(function (name, i) {
          items +=
            "<li><i class=\"is-" +
            i +
            '"></i><span>' +
            name +
            "</span><b>" +
            text(raw[i][1]) +
            "</b></li>";
        });
        legendEl.innerHTML = items;
      }
    }

    box.hidden = !(showBadge || showBar);
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      try {
        render();
      } catch (e) {
        /* 값 구조가 예상과 달라도 페이지 동작은 막지 않는다 */
      }
    }, 220);
  }

  if (typeof MutationObserver === "function" && card) {
    var mo = new MutationObserver(schedule);
    mo.observe(card, { childList: true, subtree: true, characterData: true });
  }
  document.addEventListener("input", schedule);
  document.addEventListener("change", schedule);
  document.addEventListener("click", schedule);
  window.addEventListener("load", schedule);
  schedule();
  window.setTimeout(schedule, 500);
  window.setTimeout(schedule, 1200);
})();
