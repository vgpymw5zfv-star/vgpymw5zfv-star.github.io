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

  /* ---------------- 결과 복사 · 링크 공유 ---------------- */

  var ICON_COPY =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 5.5H6.5A1.5 1.5 0 0 0 5 7v8.5"/></svg>';
  var ICON_SHARE =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5.2" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.8" r="2.5"/><path d="M8.2 10.8 15.8 6.4M8.2 13.2l7.6 4.4"/></svg>';

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
      row.setAttribute("aria-label", "결과 복사 및 공유");

      var copyBtn = actionButton("copy", "결과 복사", ICON_COPY);
      var shareBtn = actionButton("share", "링크 공유", ICON_SHARE);
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

      shareBtn.addEventListener("click", function () {
        var data = resultShareData();

        function copyLink() {
          copyText(data.url).then(function (ok) {
            if (ok) {
              flashAction(shareBtn, "링크 복사됨 ✓", status, "링크를 클립보드에 복사했습니다.");
            } else {
              flashAction(shareBtn, "복사 실패", status, "복사하지 못했습니다. 주소창의 링크를 이용해 주세요.");
            }
          });
        }

        if (navigator.share) {
          var pending;
          try {
            pending = navigator.share({ title: data.title, text: data.body, url: data.url });
          } catch (e) {
            copyLink();
            return;
          }
          if (pending && typeof pending.then === "function") {
            pending.then(
              function () {
                status.textContent = "";
              },
              function (err) {
                /* 사용자가 공유 창을 닫은 경우는 조용히 넘어간다 */
                if (err && (err.name === "AbortError" || err.name === "Abort")) return;
                copyLink();
              }
            );
          }
          return;
        }

        /* 공유 미지원 브라우저(데스크톱 등) → 링크 복사 */
        copyLink();
      });

      row.appendChild(copyBtn);
      row.appendChild(shareBtn);
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

      /* 좁은 화면: 버튼 위치와 상관없이 화면 폭에 맞춘 패널을 왼쪽에 고정 */
      if (vw <= 720) {
        var box = item.getBoundingClientRect();
        panel.style.width = Math.min(340, vw - pad * 2) + "px";
        panel.style.left = Math.round(pad - box.left) + "px";
        return;
      }

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
      thumb.style.width = r.width + "px";
      thumb.style.transform =
        "translate(" + (r.left - s.left - bl - 4) + "px,0)";
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
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(placeThumb);
    }

    paint("all");
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

  /* ---------------- 시작 ---------------- */

  function init() {
    if (embed) document.body.classList.add("embed-mode");
    fillDynamicText();
    markCurrentNav();
    initScrollState();
    initNavDropdowns();
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
