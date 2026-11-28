/* ==========================================================================
   도토리 툴즈 — 공통 스크립트
   - ?embed=1 경량(임베드) 모드 + 부모 페이지 높이 자동 전달(postMessage)
   - site-config.js 기반 애드센스 / 블로그 배너 자동 삽입
   - 계산 결과 카드에 '결과 복사 · 링크 공유' 버튼 자동 삽입
   - 헤더 현재 메뉴 표시, 홈 카테고리 필터
   ========================================================================== */

(function () {
  "use strict";

  var config = window.DOTORI_CONFIG || {};
  var EMBED = config.EMBED || {};
  var embedKey = EMBED.queryKey || "embed";
  var supportsIO = typeof window.IntersectionObserver === "function";

  /* ---------------- 유틸 ---------------- */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function reduceMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isEmbedRequested() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.has(embedKey)) {
        var v = (params.get(embedKey) || "").toLowerCase();
        return v === "" || v === "1" || v === "true" || v === "yes";
      }
      /* 해시(#embed)로도 동작 */
      return window.location.hash === "#embed";
    } catch (e) {
      return false;
    }
  }

  var embed = isEmbedRequested();

  if (embed) {
    document.documentElement.classList.add("embed-mode");
    if (document.body) document.body.classList.add("embed-mode");
  }

  /* ---------------- 임베드 높이 전달 ---------------- */

  var lastHeight = 0;

  function currentHeight() {
    var doc = document.documentElement;
    var body = document.body;
    return Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc ? doc.scrollHeight : 0,
      doc ? doc.offsetHeight : 0,
      EMBED.minHeight || 0
    );
  }

  function postHeight(force) {
    if (!embed) return;
    var height = Math.ceil(currentHeight());
    /* 리사이즈 관찰에서는 1px 미만 변화를 무시하고,
       입력·결과 변경(force)에서는 항상 보낸다 (부모 높이 동기화 보장) */
    if (!force && Math.abs(height - lastHeight) < 1) return;
    lastHeight = height;
    try {
      window.parent.postMessage(
        { type: "dotori-calc-height", height: height },
        "*"
      );
    } catch (e) {
      /* 부모가 없거나 차단된 경우 무시 */
    }
  }

  window.DotoriEmbed = {
    active: embed,
    postHeight: function () {
      window.setTimeout(postHeight, 0);
    }
  };

  /* 계산기 스크립트에서 결과 갱신 후 호출 */
  window.DotoriNotifyResize = function () {
    if (!embed) return;
    window.requestAnimationFrame(function () {
      postHeight(true);
    });
  };

  function watchResize() {
    if (typeof ResizeObserver === "function" && document.body) {
      var ro = new ResizeObserver(function () {
        postHeight();
      });
      ro.observe(document.body);
    }
    window.addEventListener("resize", postHeight);
    window.addEventListener("load", postHeight);
    /* 폰트 로딩으로 높이가 바뀌는 경우 */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(postHeight);
    }
    /* 입력값 변경 → 계산 결과 높이 변화 */
    document.addEventListener("input", function () {
      window.setTimeout(function () { postHeight(true); }, 80);
    });
    document.addEventListener("change", function () {
      window.setTimeout(function () { postHeight(true); }, 80);
    });
    document.addEventListener("click", function () {
      window.setTimeout(function () { postHeight(true); }, 120);
    });
    document.addEventListener("toggle", function () {
      window.setTimeout(function () { postHeight(true); }, 80);
    }, true);
    [60, 300, 900].forEach(function (ms) {
      window.setTimeout(postHeight, ms);
    });
  }

  if (embed) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", watchResize);
    } else {
      watchResize();
    }
  }

  /* ---------------- 애드센스 자동 삽입 ---------------- */

  function injectAdsense() {
    var client = (config.ADSENSE_CLIENT_ID || "").trim();
    if (!client) return; /* 설정 전: 아무 코드도 삽입하지 않음 */

    if (!/^ca-pub-\d{10,}$/.test(client)) {
      /* 형식이 잘못된 경우에도 페이지는 정상 동작하도록 조용히 넘어간단 */
      if (window.console && console.warn) {
        console.warn("[도토리] ADSENSE_CLIENT_ID 형식이 올바르지 않습니다:", client);
      }
      return;
    }

    /* 1) 메타 태그 */
    if (!$('meta[name="google-adsense-account"]')) {
      var meta = document.createElement("meta");
      meta.name = "google-adsense-account";
      meta.content = client;
      document.head.appendChild(meta);
    }

    /* 2) 라이브러리 스크립트 */
    if (!$("script[data-dotori-adsense]")) {
      var s = document.createElement("script");
      s.async = true;
      s.setAttribute("data-dotori-adsense", "1");
      s.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
        encodeURIComponent(client);
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }

    /* 3) 슬롯 채우기 (슬롯 ID가 있을 때만 수동 광고 단위 생성) */
    var slots = config.ADSENSE_SLOTS || {};
    $$(".ads-slot").forEach(function (box) {
      var key = box.getAttribute("data-slot") || "top";
      var slotId = (slots[key] || "").trim();
      if (!slotId) return; /* Auto ads 사용 시 비워 둠 */

      var label = document.createElement("span");
      label.className = "ads-label";
      label.textContent = "ADVERTISEMENT";
      box.appendChild(label);

      var ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", client);
      ins.setAttribute("data-ad-slot", slotId);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      box.appendChild(ins);

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        box.hidden = false;
      } catch (e) {
        box.hidden = true;
      }
    });
  }

  /* ---------------- Google 애널리틱스(GA4) ---------------- */

  function injectGA4() {
    var id = (config.GA4_ID || "").trim();
    if (!id) return; /* 설정 전: 측정 스크립트를 삽입하지 않음 */

    if (!/^G-[A-Z0-9]{6,}$/.test(id)) {
      if (window.console && console.warn) {
        console.warn("[도토리] GA4_ID 형식이 올바르지 않습니다:", id);
      }
      return;
    }

    if ($("script[data-dotori-ga4]")) return; /* 중복 삽입 방지 */

    var s = document.createElement("script");
    s.async = true;
    s.setAttribute("data-dotori-ga4", "1");
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    window.gtag("js", new Date());
    window.gtag("config", id, { anonymize_ip: true });
  }

  /* ---------------- 페이지 슬러그 ---------------- */

  function pageSlug() {
    try {
      var path = window.location.pathname.replace(/index\.html?$/i, "");
      var parts = path.split("/").filter(Boolean);
      return parts.length ? decodeURIComponent(parts[parts.length - 1]).toLowerCase() : "";
    } catch (e) {
      return "";
    }
  }

  /* ---------------- 블로그 · 제휴 배너 ---------------- */

  /* 계산기 슬러그별 맞춤 배너가 있으면 그것을, 없으면 기본 배너를 쓴다 */
  function bannerFor(slug) {
    var base = config.BLOG_BANNER || {};
    var bySlug = base.bySlug || base.perSlug || {};
    var hit = slug && Object.prototype.hasOwnProperty.call(bySlug, slug) ? bySlug[slug] : null;
    if (!hit || !hit.href) return base;
    return {
      enabled: base.enabled,
      label: hit.label || base.label,
      title: hit.title || base.title,
      text: hit.text || "",
      href: hit.href,
      cta: hit.cta || base.cta
    };
  }

  function renderBanner() {
    var banner = bannerFor(pageSlug());
    var hosts = $$("[data-blog-banner]");
    if (!hosts.length) return;

    if (!banner.enabled || !banner.href) {
      hosts.forEach(function (h) {
        h.hidden = true;
      });
      return;
    }

    hosts.forEach(function (host) {
      host.hidden = false;
      host.classList.add("banner");
      host.innerHTML = "";

      var text = document.createElement("div");
      text.className = "banner__text";

      var strong = document.createElement("strong");
      strong.textContent = banner.title || "";
      text.appendChild(strong);

      if (banner.text) {
        var span = document.createElement("span");
        span.textContent = banner.text;
        text.appendChild(span);
      }

      var link = document.createElement("a");
      link.className = "banner__cta";
      link.href = banner.href;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = banner.cta || "보러 가기";
      link.setAttribute("aria-label", (banner.label || "블로그") + " 새 창에서 열기");

      host.appendChild(text);
      host.appendChild(link);
    });
  }

  /* ---------------- 결과 복사 · 이미지 저장 ---------------- */

  var ICON_COPY =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 5.5H6.5A1.5 1.5 0 0 0 5 7v8.5"/></svg>';
  /* ---------------- 결과 캡처 (Canvas → PNG · 새 창 공유) ---------------- */

  var ICON_CAPTURE =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6.5" width="18" height="13.5" rx="3.2"/><circle cx="12" cy="13.2" r="3.2"/><path d="M8.4 6.5 9.6 4.2h4.8l1.2 2.3"/></svg>';

  var CAPTURE_FONT =
    '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, "Segoe UI", Roboto, sans-serif';

  var CAPTURE_ORIGIN = "vgpymw5zfv-star.github.io";

  function captureSlug() {
    var seg = window.location.pathname.split("/").filter(Boolean);
    var slug = seg.length ? seg[seg.length - 1].replace(/\.html$/, "") : "";
    return slug || "home";
  }

  function captureFileName() {
    return "dotori-result-" + captureSlug() + ".png";
  }

  function roundBox(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* 한글은 띄어쓰기 단위로 접고, 한 단어가 폭을 넘으면 글자 단위로 자른다 */
  function wrapLines(ctx, text, maxWidth) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var next = line ? line + " " + word : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
        return;
      }
      lines.push(line);
      line = word;
    });
    if (line) lines.push(line);
    var out = [];
    lines.forEach(function (item) {
      if (ctx.measureText(item).width <= maxWidth) {
        out.push(item);
        return;
      }
      var chunk = "";
      for (var i = 0; i < item.length; i += 1) {
        var probe = chunk + item.charAt(i);
        if (ctx.measureText(probe).width > maxWidth && chunk) {
          out.push(chunk);
          chunk = item.charAt(i);
        } else {
          chunk = probe;
        }
      }
      if (chunk) out.push(chunk);
    });
    return out.length ? out : [""];
  }

  function captureData() {
    var card = $(".result-card");
    var h1 = $("h1");
    var title = squeeze(h1 ? h1.textContent : "") || squeeze(document.title);
    var dateEl = $(".page-badge--date");
    var label = card && $(".result-card__label", card) ? $(".result-card__label", card) : null;
    var value = card && $(".result-value", card) ? $(".result-value", card) : null;
    var sub = card && $(".result-sub", card) ? $(".result-sub", card) : null;
    var insight = card ? $(".result-insight", card) : null;
    var badge = "";
    if (insight && !insight.hidden) {
      var badgeEl = $("[data-insight-badge]", insight);
      if (badgeEl) badge = squeeze(badgeEl.textContent);
    }
    var rows = [];
    if (card) {
      $$(".result-row", card).forEach(function (row) {
        var dt = $("dt", row);
        var dd = $("dd", row);
        var k = squeeze(dt ? dt.textContent : "");
        var v = squeeze(dd ? dd.textContent : "");
        if (k && v) rows.push({ k: k, v: v });
      });
    }
    var note = card && $(".result-note", card) ? squeeze($(".result-note", card).textContent) : "";

    /* 배지 안의 '기준일' 캡션과 날짜가 붙어 읽히지 않도록 한 칸 띄운다 */
    var dateText = squeeze(dateEl ? dateEl.textContent : "");
    if (dateEl) {
      var capEl = $(".page-badge__k", dateEl);
      var cap = squeeze(capEl ? capEl.textContent : "");
      if (cap && dateText.indexOf(cap) === 0) {
        dateText = cap + " " + dateText.slice(cap.length).trim();
      }
    }

    return {
      title: title,
      date: dateText,
      label: squeeze(label ? label.textContent : ""),
      value: squeeze(value ? value.textContent : ""),
      sub: squeeze(sub ? sub.textContent : ""),
      badge: badge,
      rows: rows,
      note: note
    };
  }

  function drawCapture(data) {
    var W = 1080;
    var PAD = 76;
    var S = 2;
    var H = 2800;
    var canvas = document.createElement("canvas");
    canvas.width = W * S;
    canvas.height = H * S;
    var ctx = canvas.getContext("2d");
    ctx.scale(S, S);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    function font(weight, size) {
      ctx.font = weight + " " + size + "px " + CAPTURE_FONT;
    }

    function rule(at, color) {
      ctx.strokeStyle = color || "#f1f3f5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD, at);
      ctx.lineTo(W - PAD, at);
      ctx.stroke();
    }

    var y = PAD;

    /* 브랜드 · 기준일 */
    ctx.fillStyle = "#3182f6";
    ctx.beginPath();
    ctx.arc(PAD + 6, y + 13, 6, 0, Math.PI * 2);
    ctx.fill();
    font(700, 27);
    ctx.fillStyle = "#191f28";
    ctx.fillText("도토리랩", PAD + 22, y + 22);
    font(500, 20);
    ctx.fillStyle = "#8b95a1";
    ctx.textAlign = "right";
    ctx.fillText(data.date || "2026년 11월 기준", W - PAD, y + 20);
    ctx.textAlign = "left";
    y += 52;
    rule(y, "#e5e8eb");
    y += 60;

    /* 계산기 제목 */
    font(700, 40);
    var titleLines = wrapLines(ctx, data.title, W - PAD * 2).slice(0, 2);
    ctx.fillStyle = "#191f28";
    titleLines.forEach(function (line) {
      ctx.fillText(line, PAD, y);
      y += 54;
    });
    y += 28;

    /* 결과 라벨 */
    if (data.label) {
      font(500, 22);
      ctx.fillStyle = "#4e5968";
      wrapLines(ctx, data.label, W - PAD * 2).slice(0, 1).forEach(function (line) {
        ctx.fillText(line, PAD, y);
      });
      y += 44;
    }

    /* 히어로 금액 */
    var valueText = data.value || "—";
    var size = 74;
    font(700, size);
    while (size > 34 && ctx.measureText(valueText).width > W - PAD * 2) {
      size -= 2;
      font(700, size);
    }
    ctx.fillStyle = "#3182f6";
    ctx.fillText(valueText, PAD, y + 54);
    y += 82;

    /* 결론 문장 */
    if (data.sub) {
      font(600, 24);
      ctx.fillStyle = "#00a86b";
      wrapLines(ctx, data.sub, W - PAD * 2).slice(0, 2).forEach(function (line) {
        ctx.fillText(line, PAD, y + 22);
        y += 36;
      });
      y += 10;
    }
    y += 16;

    /* 한 줄 결론 배지 */
    if (data.badge) {
      font(700, 23);
      var badgeLines = wrapLines(ctx, data.badge, W - PAD * 2 - 54).slice(0, 3);
      var panelH = 40 + badgeLines.length * 33;
      roundBox(ctx, PAD, y, W - PAD * 2, panelH, 18);
      ctx.fillStyle = "#f5f9ff";
      ctx.fill();
      ctx.strokeStyle = "#e3eefc";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#3182f6";
      ctx.beginPath();
      ctx.arc(PAD + 30, y + 30, 6, 0, Math.PI * 2);
      ctx.fill();
      font(700, 23);
      ctx.fillStyle = "#191f28";
      badgeLines.forEach(function (line, i) {
        ctx.fillText(line, PAD + 48, y + 38 + i * 33);
      });
      y += panelH + 30;
    }

    /* 세부 항목 */
    if (data.rows.length) {
      rule(y, "#e5e8eb");
      y += 24;
      data.rows.forEach(function (row, idx) {
        font(600, 25);
        var valueWidth = ctx.measureText(row.v).width;
        var keyMax = W - PAD * 2 - valueWidth - 48;
        font(500, 23);
        var keyLines = wrapLines(ctx, row.k, keyMax).slice(0, 2);
        ctx.fillStyle = "#8b95a1";
        keyLines.forEach(function (line, i) {
          ctx.fillText(line, PAD, y + 22 + i * 30);
        });
        font(600, 25);
        ctx.fillStyle = "#191f28";
        ctx.textAlign = "right";
        ctx.fillText(row.v, W - PAD, y + 22);
        ctx.textAlign = "left";
        y += (keyLines.length > 1 ? 22 + 30 * (keyLines.length - 1) : 0) + 50;
        if (idx < data.rows.length - 1) {
          rule(y, "#f1f3f5");
        }
      });
      y += 4;
    }

    /* 각주 */
    if (data.note) {
      y += 18;
      font(500, 20);
      ctx.fillStyle = "#8b95a1";
      wrapLines(ctx, data.note, W - PAD * 2).slice(0, 3).forEach(function (line) {
        ctx.fillText(line, PAD, y);
        y += 30;
      });
    }

    /* 하단 워터마크 */
    y += 24;
    rule(y, "#e5e8eb");
    y += 36;
    font(700, 20);
    ctx.fillStyle = "#4e5968";
    ctx.fillText("도토리랩", PAD, y);
    font(500, 18);
    ctx.fillStyle = "#b0b8c1";
    ctx.textAlign = "right";
    ctx.fillText(CAPTURE_ORIGIN, W - PAD, y);
    ctx.textAlign = "left";
    y += Math.round(PAD * 0.8);

    var finalH = Math.max(320, Math.min(H, Math.round(y)));
    var out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = finalH * S;
    var octx = out.getContext("2d");
    octx.drawImage(canvas, 0, 0, canvas.width, finalH * S, 0, 0, canvas.width, finalH * S);
    return out;
  }

  function canvasToBlob(canvas, done) {
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) {
          done(blob);
          return;
        }
        done(null);
      }, "image/png");
      return;
    }
    done(null);
  }

  function captureShareText(data) {
    var lines = [];
    if (data.title) lines.push(data.title);
    if (data.value) lines.push((data.label ? data.label + ": " : "") + data.value);
    if (data.sub) lines.push(data.sub);
    lines.push(CAPTURE_ORIGIN);
    return lines.join("\n");
  }

  var CAPTURE_CSS =
    "html,body{margin:0;padding:0;background:#f2f4f6;}" +
    "body{font-family:" + CAPTURE_FONT.replace(/"/g, "'") + ";color:#191f28;-webkit-text-size-adjust:100%;}" +
    ".wrap{max-width:720px;margin:0 auto;padding:26px 18px 44px;}" +
    ".top{display:flex;align-items:center;justify-content:space-between;margin:0 2px 14px;}" +
    ".brand{font-size:15px;font-weight:700;letter-spacing:-0.02em;}" +
    ".tag{font-size:12px;font-weight:700;color:#3182f6;background:#e8f3ff;border-radius:999px;padding:5px 11px;}" +
    ".shot{display:block;width:100%;height:auto;background:#fff;border:1px solid #e5e8eb;border-radius:18px;box-shadow:0 12px 34px rgba(25,31,40,0.09);}" +
    ".btns{display:flex;gap:10px;margin-top:20px;}" +
    "button{flex:1;height:54px;border:0;border-radius:14px;font-family:inherit;font-size:15px;font-weight:700;letter-spacing:-0.01em;cursor:pointer;}" +
    "button.primary{background:#3182f6;color:#ffffff;}" +
    "button.primary:active{background:#1b64da;}" +
    "button.ghost{background:#ffffff;color:#4e5968;border:1px solid #e5e8eb;}" +
    "button.ghost:active{background:#f2f4f6;}" +
    ".status{min-height:22px;margin:14px 0 0;color:#00a86b;font-size:13.5px;font-weight:600;text-align:center;}" +
    ".status.is-muted{color:#8b95a1;}" +
    ".hint{margin:8px 0 0;color:#b0b8c1;font-size:12.5px;line-height:1.6;text-align:center;}" +
    "@media(max-width:520px){.wrap{padding:16px 14px 30px;}button{height:50px;}.btns{margin-top:16px;}}";

  function captureMarkup(imageUrl) {
    return (
      '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>도토리랩 · 결과 캡처</title><style>" + CAPTURE_CSS + "</style></head><body>" +
      '<div class="wrap"><div class="top"><span class="brand">도토리랩</span><span class="tag">결과 캡처</span></div>' +
      '<img class="shot" src="' + imageUrl + '" alt="도토리랩 계산 결과 캡처">' +
      '<div class="btns"><button type="button" class="primary" data-capture-share>공유하기</button>' +
      '<button type="button" class="ghost" data-capture-save>이미지 저장</button></div>' +
      '<p class="status" data-capture-status role="status"></p>' +
      '<p class="hint">이 창을 닫아도 계산 결과에는 영향이 없습니다. 입력값은 서버로 전송되지 않습니다.</p>' +
      "</div></body></html>"
    );
  }

  /* 새 창(문서) 또는 페이지 안 모달(요소)에 같은 버튼 동작을 붙인다 */
  function wireCaptureUi(root, opts) {
    var doc = opts.doc;
    var nav = opts.nav;
    var blob = opts.blob;
    var data = opts.data;
    var filename = opts.filename;
    var imageUrl = opts.imageUrl;

    function setStatus(text, muted) {
      var el = root.querySelector("[data-capture-status]");
      if (el) {
        el.textContent = text;
        el.className = "status" + (muted ? " is-muted" : "");
      }
      if (opts.toast) toast(text);
    }

    function save() {
      try {
        var a = doc.createElement("a");
        a.href = imageUrl;
        a.download = filename;
        a.rel = "noopener";
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        setStatus("이미지를 저장했습니다 ✓");
      } catch (e) {
        setStatus("저장하지 못했습니다. 이미지를 길게 눌러 저장해 주세요.", true);
      }
    }

    function copyImage() {
      if (nav && nav.clipboard && nav.clipboard.write && opts.ClipboardItemCtor) {
        try {
          var item = new opts.ClipboardItemCtor({ "image/png": blob });
          nav.clipboard.write([item]).then(
            function () {
              setStatus("이미지를 클립보드에 복사했습니다. 붙여넣기 해 보세요 ✓");
            },
            function () {
              save();
              setStatus("이 기기에서는 공유 창을 열 수 없어 이미지로 저장했습니다.", true);
            }
          );
          return;
        } catch (e) {
          /* 아래 다운로드 폴백 */
        }
      }
      save();
      setStatus("이 기기에서는 공유 창을 열 수 없어 이미지로 저장했습니다.", true);
    }

    function share() {
      var file = null;
      if (opts.FileCtor) {
        try {
          file = new opts.FileCtor([blob], filename, { type: "image/png" });
        } catch (e) {
          file = null;
        }
      }
      if (file && nav && nav.share) {
        var payload = { files: [file], title: data.title, text: captureShareText(data) };
        var can = true;
        try {
          if (nav.canShare) can = nav.canShare(payload);
        } catch (e) {
          can = false;
        }
        if (can) {
          var pending = null;
          try {
            pending = nav.share(payload);
          } catch (e) {
            pending = null;
          }
          if (pending && typeof pending.then === "function") {
            pending.then(
              function () {
                /* 공유가 끝나도 이 창은 그대로 둔다 */
                setStatus("공유 완료 ✓");
              },
              function (err) {
                if (err && (err.name === "AbortError" || err.name === "Abort")) {
                  setStatus("공유를 취소했습니다.", true);
                  return;
                }
                copyImage();
              }
            );
            return;
          }
        }
      }
      copyImage();
    }

    var shareBtn = root.querySelector("[data-capture-share]");
    var saveBtn = root.querySelector("[data-capture-save]");
    if (shareBtn) shareBtn.addEventListener("click", share);
    if (saveBtn) saveBtn.addEventListener("click", save);
  }

  function captureModal(blob, data, filename, imageUrl) {
    var wrap = document.createElement("div");
    wrap.className = "capture-modal";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "결과 캡처");
    wrap.innerHTML =
      '<div class="capture-modal__panel">' +
      '<div class="capture-modal__top"><span class="capture-modal__brand">도토리랩</span>' +
      '<span class="capture-modal__tag">결과 캡처</span>' +
      '<button type="button" class="capture-modal__close" data-capture-close aria-label="닫기">×</button></div>' +
      '<img class="capture-modal__shot" src="' + imageUrl + '" alt="도토리랩 계산 결과 캡처">' +
      '<div class="capture-modal__btns">' +
      '<button type="button" class="result-action" data-capture-share><span>공유하기</span></button>' +
      '<button type="button" class="result-action" data-capture-save><span>이미지 저장</span></button>' +
      "</div>" +
      '<p class="status capture-modal__status" data-capture-status role="status"></p>' +
      "</div>";
    document.body.appendChild(wrap);
    document.documentElement.style.overflow = "hidden";

    function close() {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      window.setTimeout(function () {
        try {
          URL.revokeObjectURL(imageUrl);
        } catch (e) {}
      }, 400);
    }

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) close();
    });
    var closeBtn = wrap.querySelector("[data-capture-close]");
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    wireCaptureUi(wrap, {
      doc: document,
      nav: navigator,
      blob: blob,
      data: data,
      filename: filename,
      imageUrl: imageUrl,
      FileCtor: window.File,
      ClipboardItemCtor: window.ClipboardItem,
      toast: toast
    });
    return close;
  }

  function openResultCapture(btn) {
    var data = captureData();
    var win = null;
    /* 클릭과 같은 시점에 창을 먼저 열어야 팝업 차단에 걸리지 않는다 */
    try {
      win = window.open("", "_blank");
    } catch (e) {
      win = null;
    }

    if (win && win.document) {
      try {
        win.document.open();
        win.document.write(
          '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            "<title>도토리랩 · 결과 캡처</title><style>" + CAPTURE_CSS + "</style></head><body>" +
            '<div class="wrap"><p class="status is-muted">결과 이미지를 만드는 중입니다…</p></div>' +
            "</body></html>"
        );
        win.document.close();
        win.focus();
      } catch (e) {
        win = null;
      }
    }

    function finish(blob) {
      if (!blob) {
        if (win && !win.closed) {
          try {
            win.close();
          } catch (e) {}
        }
        toast("결과 이미지를 만들지 못했습니다.");
        if (btn) flashAction(btn, "캡처 실패", null, "결과 이미지를 만들지 못했습니다.");
        return;
      }
      var filename = captureFileName();
      var imageUrl = URL.createObjectURL(blob);

      if (win && !win.closed && win.document) {
        try {
          win.document.open();
          win.document.write(captureMarkup(imageUrl));
          win.document.close();
          wireCaptureUi(win.document, {
            doc: win.document,
            nav: win.navigator,
            blob: blob,
            data: data,
            filename: filename,
            imageUrl: imageUrl,
            FileCtor: win.File,
            ClipboardItemCtor: win.ClipboardItem,
            toast: function () {}
          });
          return;
        } catch (e) {
          /* 아래 모달 폴백 */
        }
      }

      /* 팝업이 차단된 환경 → 페이지 안 모달로 안내 */
      captureModal(blob, data, filename, imageUrl);
      toast("새 창이 차단되어 이 화면에 결과 캡처를 열었습니다.");
    }

    function render() {
      var canvas = null;
      try {
        canvas = drawCapture(data);
      } catch (e) {
        canvas = null;
      }
      if (!canvas) {
        finish(null);
        return;
      }
      canvasToBlob(canvas, function (blob) {
        if (blob) {
          finish(blob);
          return;
        }
        /* toBlob 미지원 → data URL → Blob */
        try {
          var dataUrl = canvas.toDataURL("image/png");
          var parts = dataUrl.split(",");
          var binary = atob(parts[1]);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          finish(new Blob([bytes], { type: "image/png" }));
        } catch (e) {
          finish(null);
        }
      });
    }

    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(render, render);
    } else {
      render();
    }
  }


  /* 임베드 파라미터를 떼어낸 공유용 주소 */
  function shareUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete(embedKey);
      url.hash = "";
      return url.toString();
    } catch (e) {
      return window.location.href;
    }
  }

  function squeeze(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* 결과 카드에서 제목·핵심값·요약을 뽑아 4줄짜리 공유 문구를 만든다 */
  function resultShareData() {
    var card = $(".result-card");
    var h1 = $("h1");
    var title = squeeze(h1 ? h1.textContent : "") || squeeze(document.title);
    var label = squeeze(card && $(".result-card__label", card) ? $(".result-card__label", card).textContent : "");
    var value = squeeze(card && $(".result-value", card) ? $(".result-value", card).textContent : "");
    var sub = squeeze(card && $(".result-sub", card) ? $(".result-sub", card).textContent : "");
    var url = shareUrl();

    var lines = [];
    if (title) lines.push(title);
    if (value) lines.push(label ? label + ": " + value : value);
    if (sub) lines.push(sub);

    return {
      title: title,
      url: url,
      body: lines.join("\n"),
      text: lines.concat([url]).join("\n")
    };
  }

  /* 클립보드 복사: Clipboard API → 실패·미지원 시 execCommand 폴백 */
  function copyText(text) {
    function legacy() {
      var ok = false;
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      try {
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        return navigator.clipboard.writeText(text).then(
          function () {
            return true;
          },
          function () {
            return legacy();
          }
        );
      } catch (e) {
        /* 아래 폴백 */
      }
    }
    if (window.Promise) return window.Promise.resolve(legacy());
    return { then: function (fn) { fn(legacy()); } };
  }

  function actionButton(action, label, icon) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result-action";
    btn.setAttribute("data-action", action);
    btn.innerHTML = icon + '<span class="result-action__label"></span>';
    var span = $(".result-action__label", btn);
    if (span) span.textContent = label;
    btn.setAttribute("data-label", label);
    btn.setAttribute("title", label);
    return btn;
  }

  function flashAction(btn, text, status, message) {
    var span = $(".result-action__label", btn);
    if (span) span.textContent = text;
    btn.classList.add("is-done");
    if (status) status.textContent = message;
    if (message) toast(message);
    window.clearTimeout(btn._dotoriFlash);
    btn._dotoriFlash = window.setTimeout(function () {
      if (span) span.textContent = btn.getAttribute("data-label") || "";
      btn.classList.remove("is-done");
      if (status) status.textContent = "";
    }, 2000);
  }

  function bindResultActions() {
    var cards = $$(".result-card");
    if (!cards.length) return;

    cards.forEach(function (card) {
      if ($("[data-result-actions]", card)) return;

      var row = document.createElement("div");
      row.className = "result-actions";
      row.setAttribute("data-result-actions", "1");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "결과 복사 및 이미지 저장");

      var copyBtn = actionButton("copy", "결과 복사", ICON_COPY);
      var captureBtn = actionButton("capture", "결과 캡처", ICON_CAPTURE);
      var status = document.createElement("span");
      status.className = "result-actions__status";
      status.setAttribute("role", "status");

      copyBtn.addEventListener("click", function () {
        var data = resultShareData();
        copyText(data.text).then(function (ok) {
          if (ok) {
            flashAction(copyBtn, "복사 완료 ✓", status, "결과를 클립보드에 복사했습니다.");
          } else {
            flashAction(copyBtn, "복사 실패", status, "복사하지 못했습니다. 주소창의 링크를 이용해 주세요.");
          }
        });
      });

      captureBtn.addEventListener("click", function () {
        openResultCapture(captureBtn);
        if (status) status.textContent = "결과 캡처 창을 열었습니다.";
      });

      row.appendChild(copyBtn);
      row.appendChild(captureBtn);
      row.appendChild(status);
      card.appendChild(row);
    });
  }

  /* ---------------- 헤더 현재 메뉴 ---------------- */

  function markCurrentNav() {
    var path = window.location.pathname.replace(/index\.html$/, "");
    if (path.charAt(path.length - 1) !== "/") path += "/";
    $$(".site-nav a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^https?:/.test(href)) return;
      var url;
      try {
        url = new URL(href, window.location.href);
      } catch (e) {
        return;
      }
      var target = url.pathname.replace(/index\.html$/, "");
      if (target.charAt(target.length - 1) !== "/") target += "/";
      if (target === path) a.setAttribute("aria-current", "page");
    });

    /* 현재 페이지가 속한 카테고리 드롭다운 버튼에 활성 표시 */
    $$(".site-nav [data-nav-item]").forEach(function (item) {
      var btn = $(".nav-toggle", item);
      var hit = $('.nav-panel a[aria-current="page"]', item);
      if (!btn) return;
      if (hit) {
        item.classList.add("is-active");
        btn.setAttribute("aria-current", "true");
      } else {
        item.classList.remove("is-active");
        btn.removeAttribute("aria-current");
      }
    });
  }

  /* ---------------- 헤더 카테고리 드롭다운 ---------------- */

  function initNavDropdowns() {
    var nav = $(".site-nav");
    if (!nav) return;
    var items = $$("[data-nav-item]", nav);
    if (!items.length) return;

    /* hover 로 열 수 있는 기기(마우스·트랙패드)에서만 마우스 오버를 쓴다 */
    var hoverable =
      !!(window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    var openItem = null;

    function btnOf(item) {
      return $(".nav-toggle", item);
    }

    function panelOf(item) {
      return $(".nav-panel", item);
    }

    /* 패널이 화면 밖으로 나가면 안쪽으로 밀어 넣는다(오른쪽 끝 교통·구독 대응) */
    function place(item) {
      var panel = panelOf(item);
      if (!panel) return;
      panel.style.left = "";
      panel.style.width = "";
      var vw = document.documentElement.clientWidth || window.innerWidth;
      var pad = 12;

      /* 좁은 화면: 패널은 화면 폭에 맞춘 고정 레이어 — 위치는 CSS(left/right 12px)가 맡는다 */
      if (vw <= 900) return;

      var r = panel.getBoundingClientRect();
      var current = parseFloat(window.getComputedStyle(panel).left) || 0;
      var delta = 0;
      if (r.right > vw - pad) delta = vw - pad - r.right;
      if (r.left + delta < pad) delta = pad - r.left;
      if (delta) panel.style.left = Math.round(current + delta) + "px";
    }

    function open(item, focusFirst) {
      if (openItem && openItem !== item) close(openItem);
      openItem = item;
      item._hoverOpen = false;
      /* 닫히는 중이던 패널을 다시 열면 닫힘 애니메이션을 취소한다 */
      window.clearTimeout(item._closingTimer);
      item.classList.remove("is-closing");
      item.classList.add("is-open");
      var btn = btnOf(item);
      if (btn) btn.setAttribute("aria-expanded", "true");
      place(item);
      if (focusFirst) {
        var first = $(".nav-panel a", item);
        if (first) first.focus();
      }
    }

    function close(item) {
      if (!item) return;
      var wasOpen = item.classList.contains("is-open");
      item.classList.remove("is-open");
      var btn = btnOf(item);
      if (btn) btn.setAttribute("aria-expanded", "false");
      var panel = panelOf(item);
      if (panel) {
        panel.style.left = "";
        panel.style.width = "";
        if (wasOpen && !reduceMotion()) {
          /* 닫힘도 짧게 페이드·축소한 뒤 display:none (레이아웃·가로 스크롤 영향 없음) */
          item.classList.add("is-closing");
          window.clearTimeout(item._closingTimer);
          item._closingTimer = window.setTimeout(function () {
            item.classList.remove("is-closing");
          }, 190);
        }
      }
      if (openItem === item) openItem = null;
    }

    function closeAll() {
      items.forEach(close);
    }

    items.forEach(function (item) {
      var btn = btnOf(item);
      if (!btn) return;

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (item.classList.contains("is-open")) {
          /* 마우스 오버로 열린 상태에서 누른 것이면 닫지 않고 고정만 한다 */
          if (item._hoverOpen) {
            item._hoverOpen = false;
            return;
          }
          close(item);
          return;
        }
        open(item);
      });

      if (hoverable) {
        item.addEventListener("mouseenter", function () {
          if (item.classList.contains("is-open")) return;
          open(item);
          item._hoverOpen = true;
        });
        item.addEventListener("mouseleave", function () {
          /* 키보드로 패널 안에 초점이 있거나 클릭으로 고정했으면 닫지 않는다 */
          if (!item._hoverOpen) return;
          if (item.contains(document.activeElement)) return;
          close(item);
        });
      }

      item.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          e.stopPropagation();
          close(item);
          btn.focus();
          return;
        }
        if (e.key === "ArrowDown" && e.target === btn && !item.classList.contains("is-open")) {
          e.preventDefault();
          open(item, true);
        }
      });

      /* 패널 밖으로 탭 이동하면 닫기 */
      item.addEventListener("focusout", function (e) {
        if (!item.contains(e.relatedTarget)) close(item);
      });
    });

    /* 바깥 클릭 / 다른 메뉴 클릭 → 닫기 */
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) closeAll();
    });

    /* Escape → 닫고 버튼으로 초점 복귀 */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !openItem) return;
      var item = openItem;
      closeAll();
      var btn = btnOf(item);
      if (btn) btn.focus();
    });

    /* 화면 폭이 바뀌면 열린 패널 위치를 다시 계산 */
    window.addEventListener("resize", function () {
      items.forEach(function (item) {
        if (item.classList.contains("is-open")) place(item);
      });
    });

    closeAll();
  }

  /* ---------------- 표 가로 스크롤 안내 ---------------- */

  /* 내용이 표 틀보다 넓은 표에만 오른쪽 그늘(.is-scrollable)과 안내 문구를 붙인다 */
  function markScrollableTables() {
    $$(".table-wrap").forEach(function (wrap) {
      var scrollable = wrap.scrollWidth - wrap.clientWidth > 1;
      var wasScrollable = wrap.getAttribute("data-scrollable") === "1";
      wrap.classList.toggle("is-scrollable", scrollable);
      if (scrollable === wasScrollable) return;
      wrap.setAttribute("data-scrollable", scrollable ? "1" : "0");
      var hint = wrap.nextElementSibling;
      var hasHint = hint && hint.classList.contains("table-scroll-hint");
      if (scrollable && !hasHint) {
        hint = document.createElement("p");
        hint.className = "table-scroll-hint";
        hint.textContent = "표를 옆으로 넘기면 전체 열이 보입니다";
        wrap.parentNode.insertBefore(hint, wrap.nextSibling);
      } else if (!scrollable && hasHint) {
        hint.parentNode.removeChild(hint);
      }
    });
  }

  function watchTableScroll() {
    if (!document.querySelector(".table-wrap")) return;
    markScrollableTables();
    window.addEventListener("resize", markScrollableTables);
    if (typeof ResizeObserver !== "function") return;
    var ro = new ResizeObserver(markScrollableTables);
    $$(".table-wrap > table").forEach(function (table) {
      ro.observe(table);
    });
  }

  /* ---------------- 홈 카테고리 필터 · 도구 검색 ---------------- */

  function initFilters() {
    var bar = $("[data-filter-bar]");
    if (!bar) return;
    var chips = $$(".chip", bar);
    var thumb = $(".tabs__thumb", bar);
    var cards = $$("[data-category]");
    var empty = $("[data-filter-empty]");
    var countEl = $("[data-filter-count]");
    var featured = $("[data-featured]");
    var input = $("[data-tool-search]");
    var panel = $("[data-cmd-results]");
    var cmd = $("[data-cmd]");
    var current = "all";
    var query = "";
    var token = 0;
    var enterTimer = null;
    var activeItem = -1;

    var index = cards.map(function (card) {
      var h3 = $("h3", card);
      var tag = $(".calc-card__tag", card);
      var text = [
        h3 ? h3.textContent : "",
        tag ? tag.textContent : "",
        card.getAttribute("data-category") || "",
        card.getAttribute("data-keywords") || "",
        card.getAttribute("href") || ""
      ]
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, " ");
      return {
        card: card,
        text: text,
        title: h3 ? squeeze(h3.textContent) : "",
        cat: card.getAttribute("data-category") || "",
        href: card.getAttribute("href") || ""
      };
    });

    /* 카테고리별 개수 — 탭 라벨 옆 배지 */
    var counts = { all: index.length };
    index.forEach(function (item) {
      counts[item.cat] = (counts[item.cat] || 0) + 1;
    });
    chips.forEach(function (chip) {
      var badge = $(".chip__count", chip);
      var key = chip.getAttribute("data-filter") || "all";
      if (badge) badge.textContent = String(counts[key] || 0);
    });

    function placeThumb() {
      if (!thumb) return;
      var active = null;
      chips.forEach(function (chip) {
        if (chip.getAttribute("aria-pressed") === "true") active = chip;
      });
      if (!active) {
        thumb.style.width = "0px";
        return;
      }
      var s = bar.getBoundingClientRect();
      var r = active.getBoundingClientRect();
      var bl = parseFloat(window.getComputedStyle(bar).borderLeftWidth) || 0;
      /* 탭 바가 가로로 스크롤된 만큼(scrollLeft)을 더해야 밑줄이 활성 탭 밑에 그대로 붙는다 */
      var x = r.left - s.left - bl + (bar.scrollLeft || 0);
      thumb.style.width = r.width + "px";
      thumb.style.transform = "translate(" + x + "px,0)";
    }

    function matchCategory(item) {
      return current === "all" || item.cat === current;
    }

    function matchQuery(item) {
      if (!query) return true;
      var words = query.split(/\s+/).filter(Boolean);
      return words.every(function (w) {
        return item.text.indexOf(w) !== -1;
      });
    }

    function paint(value) {
      var shown = 0;
      var barTop = bar.getBoundingClientRect().top;
      index.forEach(function (item) {
        var ok = matchCategory(item) && matchQuery(item);
        item.card.hidden = !ok;
        if (ok) shown += 1;
      });
      chips.forEach(function (chip) {
        chip.setAttribute(
          "aria-pressed",
          chip.getAttribute("data-filter") === value ? "true" : "false"
        );
      });
      if (countEl) {
        countEl.textContent = query
          ? "‘" + query + "’ 검색 결과 " + shown + "개"
          : shown + "개 도구";
      }
      if (empty) {
        empty.setAttribute("data-visible", shown === 0 ? "true" : "false");
        if (shown === 0) {
          empty.textContent = query
            ? "‘" + query + "’에 맞는 도구를 찾지 못했습니다. 다른 단어로 찾아보세요."
            : "해당 카테고리의 도구가 아직 없습니다.";
        }
      }
      if (featured) featured.hidden = !(value === "all" && !query);

      /* 카테고리를 바꾸면 위쪽 'Top 4' 영역이 접혀 문서가 위로 튄다.
         탭 바가 화면에서 보이던 자리를 그대로 지켜, 탭과 아래 목록이 붙어 있게 한다. */
      var delta = bar.getBoundingClientRect().top - barTop;
      if (Math.abs(delta) > 1) {
        var root = document.documentElement;
        var prev = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollBy(0, delta);
        root.style.scrollBehavior = prev;
      }

      placeThumb();
      if (value !== "all" || query) {
        var active = null;
        chips.forEach(function (chip) {
          if (chip.getAttribute("aria-pressed") === "true") active = chip;
        });
        if (active && active.scrollIntoView) {
          try {
            active.scrollIntoView({ block: "nearest", inline: "center" });
          } catch (e) {
            /* 구형 브라우저는 무시 */
          }
        }
      }
      return shown;
    }

    /* 카드가 툭 사라지지 않고 페이드·스케일로 교체된다 (reduced-motion·embed는 즉시) */
    function animateFilter(value) {
      var my = ++token;
      var instant = !supportsIO || reduceMotion();

      if (instant) {
        paint(value);
        return;
      }

      var visible = cards.filter(function (card) {
        return !card.hidden;
      });

      visible.forEach(function (card) {
        card.classList.remove("is-entering");
        card.classList.add("is-filtering");
      });

      window.setTimeout(function () {
        if (my !== token) return;
        visible.forEach(function (card) {
          card.classList.remove("is-filtering");
        });
        paint(value);

        var shown = cards.filter(function (card) {
          return !card.hidden;
        });
        shown.forEach(function (card, i) {
          card.classList.add("is-entering");
          card.style.transitionDelay = Math.min(i, 7) * 28 + "ms";
        });
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (my !== token) return;
            shown.forEach(function (card) {
              card.classList.remove("is-entering");
            });
          });
        });
        window.clearTimeout(enterTimer);
        enterTimer = window.setTimeout(function () {
          shown.forEach(function (card) {
            card.style.transitionDelay = "";
          });
        }, 620);
      }, visible.length ? 130 : 0);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var value = chip.getAttribute("data-filter") || "all";
        if (value === current) return;
        current = value;
        animateFilter(value);
      });
    });

    /* ---------------- 커맨드 검색 ---------------- */

    function results() {
      if (!query) return [];
      return index.filter(function (item) {
        return matchCategory(item) && matchQuery(item);
      });
    }

    function closePanel() {
      if (!panel) return;
      panel.hidden = true;
      activeItem = -1;
      if (cmd) cmd.classList.remove("is-searching");
      if (input) input.setAttribute("aria-expanded", "false");
    }

    function setActive(i) {
      var items = $$(".cmd__item", panel);
      if (!items.length) return;
      activeItem = (i + items.length) % items.length;
      items.forEach(function (el, k) {
        el.classList.toggle("is-active", k === activeItem);
        if (k === activeItem && el.scrollIntoView) {
          try {
            el.scrollIntoView({ block: "nearest" });
          } catch (e) {}
        }
      });
    }

    function renderPanel() {
      if (!panel) return;
      var list = results();
      if (!query) {
        closePanel();
        return;
      }
      panel.innerHTML = "";
      if (!list.length) {
        var note = document.createElement("p");
        note.className = "cmd__empty";
        note.textContent = "‘" + query + "’에 맞는 도구가 없습니다.";
        panel.appendChild(note);
      } else {
        list.slice(0, 7).forEach(function (item) {
          var a = document.createElement("a");
          a.className = "cmd__item";
          a.href = item.href;
          a.setAttribute("role", "option");
          var name = document.createElement("span");
          name.textContent = item.title;
          var cat = document.createElement("span");
          cat.className = "cmd__cat";
          cat.textContent = item.cat;
          a.appendChild(name);
          a.appendChild(cat);
          panel.appendChild(a);
        });
      }
      panel.hidden = false;
      activeItem = -1;
      if (cmd) cmd.classList.add("is-searching");
      if (input) input.setAttribute("aria-expanded", "true");
    }

    function applyQuery(value, showPanel) {
      query = String(value || "").trim().toLowerCase();
      animateFilter(current);
      if (showPanel) renderPanel();
      else closePanel();
    }

    if (input) {
      /* 좁은 화면에서는 짧은 안내 문구로 (검색창 폭에 맞춰) */
      var fullPlaceholder = input.getAttribute("placeholder") || "";
      var shortPlaceholder = "예: 주휴수당, 예금 이자";
      function syncPlaceholder() {
        var narrow = (window.innerWidth || 0) <= 560;
        input.setAttribute(
          "placeholder",
          narrow ? shortPlaceholder : fullPlaceholder
        );
      }
      syncPlaceholder();
      window.addEventListener("resize", syncPlaceholder);

      var debounce = 0;
      input.addEventListener("input", function () {
        window.clearTimeout(debounce);
        var value = input.value;
        debounce = window.setTimeout(function () {
          applyQuery(value, true);
        }, 90);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive(activeItem + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive(activeItem - 1);
        } else if (e.key === "Enter") {
          var items = $$(".cmd__item", panel);
          var target = items[activeItem >= 0 ? activeItem : 0];
          if (target) {
            e.preventDefault();
            window.location.href = target.getAttribute("href");
          }
        } else if (e.key === "Escape") {
          closePanel();
          if (input.value) {
            input.value = "";
            applyQuery("", false);
          } else {
            input.blur();
          }
        }
      });
      input.addEventListener("focus", function () {
        if (input.value.trim()) renderPanel();
      });

      $$("[data-search-suggest]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var word = btn.getAttribute("data-search-suggest") || "";
          input.value = word;
          input.focus();
          applyQuery(word, true);
        });
      });

      /* "/" 로 검색창 열기 */
      document.addEventListener("keydown", function (e) {
        if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
        var tag = (e.target && e.target.tagName) || "";
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
        e.preventDefault();
        input.focus();
        input.select();
      });
    }

    if (cmd) {
      document.addEventListener("click", function (e) {
        if (!cmd.contains(e.target)) closePanel();
      });
    }

    window.addEventListener("resize", placeThumb);
    if (bar.addEventListener) {
      bar.addEventListener("scroll", placeThumb, { passive: true });
    }
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(placeThumb);
    }

    /* 헤더 '전체 도구'의 카테고리를 누르면 index.html?cat=절세#tools 로 들어온다 */
    var startValue = "all";
    try {
      var wantCat = new URLSearchParams(window.location.search).get("cat");
      if (wantCat) {
        chips.forEach(function (chip) {
          if (chip.getAttribute("data-filter") === wantCat) startValue = wantCat;
        });
      }
    } catch (e) {
      /* URLSearchParams 미지원 브라우저는 전체 탭으로 */
    }
    current = startValue;
    paint(startValue);
    window.requestAnimationFrame(placeThumb);
  }

  /* ---------------- 세그먼트 슬라이딩 인디케이터 ---------------- */

  /*
   * .segment 그룹마다 흰색 썸(thumb) 하나를 깔고, 선택된 버튼의 위치·크기로 옮긴다.
   * 버튼의 aria-pressed 가 바뀌는 모든 경로(클릭·프로그램 갱신)를 MutationObserver 로 잡는다.
   */
  function initSegmentThumbs() {
    var segs = $$(".segment");
    if (!segs.length) return;

    segs.forEach(function (seg) {
      if ($(".segment__thumb", seg)) return;
      var thumb = document.createElement("span");
      thumb.className = "segment__thumb";
      thumb.setAttribute("aria-hidden", "true");
      seg.classList.add("has-thumb");
      seg.appendChild(thumb);

      var frame = 0;

      function place() {
        var active = $('button[aria-pressed="true"]', seg);
        if (!active) {
          thumb.style.width = "0px";
          thumb.style.height = "0px";
          return;
        }
        var s = seg.getBoundingClientRect();
        var r = active.getBoundingClientRect();
        var cs = window.getComputedStyle(seg);
        var bl = parseFloat(cs.borderLeftWidth) || 0;
        var bt = parseFloat(cs.borderTopWidth) || 0;
        thumb.style.width = r.width + "px";
        thumb.style.height = r.height + "px";
        thumb.style.transform =
          "translate(" +
          (r.left - s.left - bl - 4) +
          "px," +
          (r.top - s.top - bt - 4) +
          "px)";
      }

      function schedule() {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(place);
      }

      seg._dotoriThumb = schedule;
      seg.addEventListener("click", schedule);

      if (typeof MutationObserver === "function") {
        var mo = new MutationObserver(schedule);
        $$("button", seg).forEach(function (b) {
          mo.observe(b, { attributes: true, attributeFilter: ["aria-pressed"] });
        });
      }

      schedule();
      window.setTimeout(schedule, 60);
    });

    window.addEventListener("resize", function () {
      segs.forEach(function (seg) {
        if (seg._dotoriThumb) seg._dotoriThumb();
      });
    });

    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        segs.forEach(function (seg) {
          if (seg._dotoriThumb) seg._dotoriThumb();
        });
      });
    }
  }

  /* ---------------- 결과 KPI 비중 미터 ---------------- */

  /*
   * 결과 카드의 항목 중 같은 단위(원·시간·% 등)가 2개 이상이고
   * 최대/최소 비율이 30배 안쪽이면(읽을 수 있는 분포) 각 항목 아래에
   * 상대 크기를 나타내는 얇은 선을 그린다. 표시 문구는 바꾸지 않는다.
   */
  function decorateResultRows() {
    var cards = $$(".result-card");
    if (!cards.length) return;

    cards.forEach(function (card) {
      var rows = $$(".result-row", card);
      if (!rows.length) return;

      var parsed = [];
      rows.forEach(function (row) {
        var dd = row.querySelector("dd");
        if (!dd) return;
        var text = squeeze(dd.textContent);
        var m = text.match(/^([\d,]+(?:\.\d+)?)\s*(원|만원|시간|일|개월|년|점|%)$/);
        if (!m) {
          var old = row.querySelector(".result-row__meter");
          if (old) old.parentNode.removeChild(old);
          return;
        }
        var unit = m[2];
        var value = parseFloat(m[1].replace(/,/g, ""));
        if (!isFinite(value) || value <= 0) return;
        parsed.push({ row: row, unit: unit, value: value });
      });

      var groups = {};
      parsed.forEach(function (p) {
        (groups[p.unit] = groups[p.unit] || []).push(p);
      });

      parsed.forEach(function (p) {
        var row = p.row;
        var meter = row.querySelector(".result-row__meter");
        var group = groups[p.unit] || [];
        var max = 0;
        var min = Infinity;
        group.forEach(function (g) {
          if (g.value > max) max = g.value;
          if (g.value < min) min = g.value;
        });
        var readable =
          group.length >= 2 && min > 0 && max / min <= 30 && max > min;
        if (!readable) {
          if (meter) meter.parentNode.removeChild(meter);
          return;
        }
        if (!meter) {
          meter = document.createElement("span");
          meter.className = "result-row__meter";
          meter.setAttribute("aria-hidden", "true");
          row.appendChild(meter);
        }
        var pct = Math.max(4, Math.round((p.value / max) * 100));
        meter.style.width = pct + "%";
      });
    });
  }

  function watchResultMeters() {
    if (!$(".result-card")) return;
    decorateResultRows();
    var timer = 0;
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(decorateResultRows, 180);
    }
    document.addEventListener("input", schedule);
    document.addEventListener("change", schedule);
    document.addEventListener("click", schedule);
    window.addEventListener("load", schedule);
    window.setTimeout(decorateResultRows, 260);
  }

  /* ---------------- FAQ 아코디언 높이 전환 ---------------- */

  function initFaqMotion() {
    if (reduceMotion() || embed) return;
    var items = $$(".faq details");
    if (!items.length) return;

    items.forEach(function (item) {
      var summary = $("summary", item);
      var body = $("p", item);
      if (!summary || !body) return;

      summary.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        var running = item._dotoriAnim;
        if (running) {
          try {
            running.cancel();
          } catch (err) {}
          item._dotoriAnim = null;
        }
        e.preventDefault();

        var opening = !item.open;
        body.style.overflow = "hidden";

        function finish(open) {
          item.open = open;
          body.style.height = "";
          body.style.overflow = "";
          item._dotoriAnim = null;
        }

        var from = opening ? 0 : body.offsetHeight;
        if (opening) item.open = true;
        var to = opening ? body.scrollHeight : 0;

        var anim;
        try {
          anim = body.animate(
            [
              { height: from + "px", opacity: opening ? 0.2 : 1 },
              { height: to + "px", opacity: opening ? 1 : 0.2 }
            ],
            { duration: opening ? 260 : 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
          );
        } catch (err) {
          finish(opening);
          return;
        }
        body.style.height = to + "px";
        item._dotoriAnim = anim;
        anim.onfinish = function () {
          body.style.height = "";
          finish(opening);
        };
      });
    });
  }

  /* ---------------- 헤더 스크롤 상태 ---------------- */

  function initScrollState() {
    var header = $(".site-header");
    if (!header) return;
    var on = null;

    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var next = y > 8;
      if (next === on) return;
      on = next;
      header.classList.toggle("is-scrolled", next);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---------------- 스크롤 연동 스태거 리빌 ---------------- */

  /*
   * IntersectionObserver 로 섹션이 화면에 들어올 때마다 페이드업한다.
   * - 초기 화면(첫 뷰포트) 요소는 지연 없이 즉시 표시
   * - 미지원 브라우저 · embed · prefers-reduced-motion 에서는 클래스를 붙이지 않아
   *   어떤 요소도 숨은 채로 남지 않는다 (CSS 사전 상태가 html.reveal-ready 하위에만 적용)
   */
  function initReveal() {
    if (embed || !supportsIO || reduceMotion()) return;

    var root = document.documentElement;
    var selector = [
      ".section-head",
      ".calc-card",
      ".guide-card",
      ".steps li",
      ".faq details",
      ".prose",
      ".result-card",
      ".card",
      ".summary",
      ".feature-card",
      ".trust-item"
    ].join(", ");

    var items = $$(selector);
    if (!items.length) return;

    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    var pending = [];

    items.forEach(function (el) {
      var box = el.getBoundingClientRect();
      if (box.top < vh * 0.94) {
        /* 이미 보이는 요소: 지연 없이 즉시 (스크롤 복원으로 위쪽에 있는 요소는 애니메이션 없음) */
        if (box.bottom < 0) el.classList.add("reveal-skip");
        el.classList.add("is-revealed");
      } else {
        pending.push(el);
      }
    });

    root.classList.add("reveal-ready");

    if (!pending.length) return;

    var io = new IntersectionObserver(
      function (entries) {
        var batch = [];
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          batch.push(entry.target);
        });
        if (!batch.length) return;

        batch.sort(function (a, b) {
          return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
        });

        batch.forEach(function (el, i) {
          var delay = Math.min(i, 5) * 45;
          el.style.setProperty("--reveal-delay", delay + "ms");
          el.classList.add("is-revealing", "is-revealed");
          window.setTimeout(function () {
            el.classList.remove("is-revealing");
          }, delay + 660);
        });
      },
      { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );

    pending.forEach(function (el) {
      io.observe(el);
    });

    /* 안전망: 어떤 이유로 관찰이 누락돼도 화면 안 요소는 2초 뒤 반드시 보인다 */
    window.setTimeout(function () {
      var h = window.innerHeight || document.documentElement.clientHeight || 800;
      pending.forEach(function (el) {
        if (el.classList.contains("is-revealed")) return;
        var box = el.getBoundingClientRect();
        if (box.top < h && box.bottom > 0) {
          el.classList.add("reveal-skip", "is-revealed");
          io.unobserve(el);
        }
      });
    }, 2000);
  }

  /* ---------------- 플로팅 토스트 ---------------- */

  var toastEl = null;
  var toastTimer = 0;

  function toast(message) {
    if (!message || !document.body) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "dotori-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    window.clearTimeout(toastTimer);
    window.requestAnimationFrame(function () {
      toastEl.classList.add("is-visible");
    });
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2000);
  }

  window.DotoriToast = toast;

  /* ---------------- 푸터 연도 / 기준일 ---------------- */

  function fillDynamicText() {
    $$("[data-기준일], [data-basis-date]").forEach(function (el) {
      el.textContent = config["기준일"] || config.basisDate || "";
    });
    $$("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------------- 입력칸 안쪽 단위 라벨 ---------------- */

  /*
   * 라벨 끝의 "(원)" "(시간)" "(%) 같은 단위를 입력칸 안쪽 작은 칩으로 옮긴다.
   * 라벨은 짧아지고, 숫자를 넣는 위치 옆에 단위가 붙어 오입력을 줄인다.
   * 단위 표기가 이미 있는 칸(.field-unit)은 건드리지 않는다.
   */
  function initFieldUnits() {
    var UNIT_RE = /^(.*\S)\s*\((원|만원|천원|시간|일|개월|년|개|명|회|주|%|kWh|kwh|㎡|평|B|자|점|세|원\/㎡|만원\/㎡)\)\s*$/;

    function apply() {
      $$(".field-control").forEach(function (control) {
        if ($(".field-unit", control)) return;
        if (!$("input, select", control)) return;
        var field = control.closest("label.field");
        if (!field) return;
        var labelEl = $(".field-label", field);
        if (!labelEl) return;
        var labelText = squeeze(labelEl.textContent || "");
        var m = labelText.match(UNIT_RE);
        if (!m) return;
        var unit = m[2];
        var base = m[1].trim();
        if (!base) return;
        if ((labelEl.textContent || "").trim() !== base) labelEl.textContent = base;
        if (!$(".field-unit-inline", control)) {
          var chip = document.createElement("span");
          chip.className = "field-unit-inline";
          chip.setAttribute("aria-hidden", "true");
          chip.textContent = unit;
          control.appendChild(chip);
          control.classList.add("has-unit");
        }
      });
    }

    apply();

    /* 페이지 스크립트가 라벨을 다시 쓰는 경우(예: 예금↔적금 전환)도 따라간다 */
    var timer = 0;
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 120);
    }
    document.addEventListener("input", schedule);
    document.addEventListener("change", schedule);
    document.addEventListener("click", schedule);
    window.setTimeout(apply, 400);
  }

  /* ---------------- 빠른 설정 프리셋 ---------------- */

  /*
   * <button data-preset='[["mw-day","8"],["mw-days","5"]]'>
   * 입력 id 면 값을 넣고 input·change 를 발생시켜 계산기를 다시 돌린다.
   * 세그먼트 그룹 id 면 해당 data-value 버튼을 눌러 준다.
   */
  function initPresets() {
    var buttons = $$("[data-preset]");
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pairs;
        try {
          pairs = JSON.parse(btn.getAttribute("data-preset") || "[]");
        } catch (e) {
          return;
        }
        pairs.forEach(function (pair) {
          var target = document.getElementById(pair[0]);
          if (!target) return;
          if (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
            target.value = pair[1];
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            var segBtn = $('button[data-value="' + pair[1] + '"]', target);
            if (segBtn) segBtn.click();
          }
        });
        buttons.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        btn.blur();
      });
    });

    /* 직접 값을 고치면 프리셋 강조는 옅어진다 */
    document.addEventListener("input", function (e) {
      if (!e.target || !e.target.id) return;
      buttons.forEach(function (b) {
        var data = b.getAttribute("data-preset") || "";
        if (data.indexOf('"' + e.target.id + '"') !== -1) b.classList.remove("is-active");
      });
    });
  }

  /* ---------------- 헤더 검색 바로가기 ---------------- */

  function initNavSearch() {
    var link = $("[data-nav-search]");
    var input = $("[data-tool-search]");

    if (link && input) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        input.focus();
        try {
          input.select();
        } catch (err) {}
      });
    }

    /* 홈이 아닌 페이지에서 "/" → 홈 검색으로 이동 */
    if (link && !input) {
      document.addEventListener("keydown", function (e) {
        if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
        var tag = (e.target && e.target.tagName) || "";
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
        e.preventDefault();
        window.location.href = link.getAttribute("href");
      });
    }

    if (input && window.location.hash === "#search") {
      window.setTimeout(function () {
        input.focus();
      }, 120);
    }
  }

  /* ---------------- 시작 ---------------- */

  function init() {
    if (embed) document.body.classList.add("embed-mode");
    fillDynamicText();
    markCurrentNav();
    initScrollState();
    initNavDropdowns();
    initNavSearch();
    initFieldUnits();
    initPresets();
    initReveal();
    renderBanner();
    bindResultActions();
    initFilters();
    initSegmentThumbs();
    watchResultMeters();
    initFaqMotion();
    watchTableScroll();
    injectAdsense();
    injectGA4();
    if (embed) {
      watchResize();
      postHeight();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---------------- 계산기 페이지 공용 UI 도우미 ---------------- */

  function toNumber(el, fallback) {
    if (!el) return fallback;
    var raw = String(el.value || "").replace(/[,\s]/g, "");
    if (raw === "" || raw === "-" || raw === ".") return fallback;
    var n = Number(raw);
    return isFinite(n) ? n : fallback;
  }

  function setText(id, text) {
    var el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
  }

  function setHTML(id, markup) {
    var el = typeof id === "string" ? document.getElementById(id) : id;
    if (el) el.innerHTML = markup;
  }

  function show(el, visible) {
    if (!el) return;
    el.hidden = !visible;
  }

  /**
   * 핵심 금액 카운트업 (220~280ms, rAF)
   * - prefers-reduced-motion 이면 즉시 최종값
   * - 애니메이션 도중 다시 호출되면 이전 프레임을 중단하고 새 값으로 이어간다
   * - 종료 시점에는 항상 목표값과 정확히 일치한다
   */
  function countTo(id, value, formatter, duration, finalText) {
    var el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    var format =
      typeof formatter === "function"
        ? formatter
        : function (v) {
            return String(Math.round(v));
          };
    var to = typeof value === "number" && isFinite(value) ? value : 0;
    var prev = Number(el.getAttribute("data-count-value"));
    var from = isFinite(prev) ? prev : 0;

    el.setAttribute("data-count-value", String(to));

    var finalValue = typeof finalText === "string" ? finalText : format(to);

    if (reduceMotion()) {
      el._countToken = (el._countToken || 0) + 1;
      el.textContent = finalValue;
      return;
    }

    var dur = typeof duration === "number" ? duration : 260;
    var token = (el._countToken = (el._countToken || 0) + 1);

    /* 결과 카드에 짧은 강조 효과 */
    var card = el.closest ? el.closest(".result-card") : null;
    if (card) {
      card.classList.add("is-changing");
      window.clearTimeout(card._changingTimer);
      card._changingTimer = window.setTimeout(function () {
        card.classList.remove("is-changing");
      }, dur + 140);
    }

    if (Math.abs(to - from) < 0.5) {
      el.textContent = finalValue;
      return;
    }

    var start = null;
    function frame(now) {
      if (el._countToken !== token) return;
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * eased);
      if (t < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = finalValue;
      }
    }
    window.requestAnimationFrame(frame);

    /* 안전망: 탭이 백그라운드로 가 rAF가 멈춰도 최종값은 보장 */
    window.setTimeout(function () {
      if (el._countToken === token) el.textContent = finalValue;
    }, dur + 120);
  }

  /** 세그먼트 버튼 그룹 바인딩 */
  function bindSegment(group, onChange) {
    if (!group) return;
    var buttons = $$("button", group);
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        if (onChange) onChange(btn.getAttribute("data-value"));
      });
    });
  }

  function segmentValue(group) {
    if (!group) return null;
    var active = $('button[aria-pressed="true"]', group);
    return active ? active.getAttribute("data-value") : null;
  }

  /** 입력 이벤트 디바운스 */
  function onInput(elements, handler, delay) {
    var wait = typeof delay === "number" ? delay : 60;
    var timer = null;
    function fire() {
      timer = null;
      handler();
    }
    function schedule() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(fire, wait);
    }
    elements.forEach(function (el) {
      if (!el) return;
      var evt = el.tagName === "SELECT" || el.type === "checkbox" || el.type === "radio" ? "change" : "input";
      el.addEventListener(evt, schedule);
      if (evt === "input") el.addEventListener("change", schedule);
    });
    return schedule;
  }

  /** 라디오 그룹 값 */
  function radioValue(name, fallback) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : fallback;
  }

  window.DotoriUI = {
    $: $,
    $$: $$,
    toNumber: toNumber,
    countTo: countTo,
    setText: setText,
    setHTML: setHTML,
    show: show,
    bindSegment: bindSegment,
    segmentValue: segmentValue,
    onInput: onInput,
    radioValue: radioValue
  };
})();
