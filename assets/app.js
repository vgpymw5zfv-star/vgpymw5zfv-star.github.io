/* ==========================================================================
   도토리 계산기 — 공통 스크립트
   - ?embed=1 경량(임베드) 모드 + 부모 페이지 높이 자동 전달(postMessage)
   - site-config.js 기반 애드센스 / 블로그 배너 자동 삽입
   - 헤더 현재 메뉴 표시, 홈 카테고리 필터
   ========================================================================== */

(function () {
  "use strict";

  var config = window.DOTORI_CONFIG || {};
  var EMBED = config.EMBED || {};
  var embedKey = EMBED.queryKey || "embed";

  /* ---------------- 유틸 ---------------- */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
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

  /* ---------------- 블로그 · 제휴 배너 ---------------- */

  function renderBanner() {
    var banner = config.BLOG_BANNER || {};
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
  }

  /* ---------------- 홈 카테고리 필터 ---------------- */

  function initFilters() {
    var bar = $("[data-filter-bar]");
    if (!bar) return;
    var chips = $$(".chip", bar);
    var cards = $$("[data-category]");
    var empty = $("[data-filter-empty]");

    function apply(value) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = value === "all" || card.getAttribute("data-category") === value;
        card.hidden = !match;
        if (match) shown += 1;
      });
      chips.forEach(function (chip) {
        chip.setAttribute(
          "aria-pressed",
          chip.getAttribute("data-filter") === value ? "true" : "false"
        );
      });
      if (empty) empty.setAttribute("data-visible", shown === 0 ? "true" : "false");
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        apply(chip.getAttribute("data-filter") || "all");
      });
    });

    apply("all");
  }

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
    renderBanner();
    initFilters();
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

  var reduceMotion = function () {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  };

  /**
   * 핵심 금액 카운트업 (220~280ms, rAF)
   * - prefers-reduced-motion 이면 즉시 최종값
   * - 애니메이션 도중 다시 호출되면 이전 프레임을 중단하고 새 값으로 이어간다
   * - 종료 시점에는 항상 목표값과 정확히 일치한다
   */
  function countTo(id, value, formatter, duration) {
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

    if (reduceMotion()) {
      el._countToken = (el._countToken || 0) + 1;
      el.textContent = format(to);
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
      el.textContent = format(to);
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
        el.textContent = format(to);
      }
    }
    window.requestAnimationFrame(frame);

    /* 안전망: 탭이 백그라운드로 가 rAF가 멈춰도 최종값은 보장 */
    window.setTimeout(function () {
      if (el._countToken === token) el.textContent = format(to);
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
