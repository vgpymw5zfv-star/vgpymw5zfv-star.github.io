/* AI 구독 조합 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Ai = window.DotoriAi;
  if (!UI || !Core || !Ai) return;

  function init() {
    var el = {
      chatgpt: document.getElementById("ai-chatgpt"),
      gemini: document.getElementById("ai-gemini"),
      claude: document.getElementById("ai-claude"),
      perplexity: document.getElementById("ai-perplexity"),
      rate: document.getElementById("ai-rate"),
      items: document.getElementById("ai-items"),
      example: document.getElementById("ai-example-table")
    };
    if (!el.chatgpt) return;

    el.rate.addEventListener("change", function () {
      var v = Number(el.rate.value);
      if (!isFinite(v) || el.rate.value === "") {
        el.rate.value = "1400";
      } else if (v < 800) {
        el.rate.value = "800";
      } else if (v > 3000) {
        el.rate.value = "3000";
      }
      render();
    });

    function render() {
      var result = Ai.compute({
        chatgpt: el.chatgpt.value,
        gemini: el.gemini.value,
        claude: el.claude.value,
        perplexity: el.perplexity.value,
        rate: UI.toNumber(el.rate, 1400)
      });

      UI.countTo("ai-total", result.total, Core.comma);
      UI.setText(
        "ai-sub",
        (result.paidCount === 0
          ? "전부 무료 플랜"
          : "유료 구독 " + result.paidCount + "개") +
          " · 환율 " + Core.comma(result.rate) + "원 기준"
      );
      UI.setText("ai-yearly", Core.won(result.yearly));
      UI.setText("ai-daily", Core.won(Math.round(result.dailyCost)));
      UI.setText("ai-free-saving", Core.won(result.freeSaving));
      UI.setText("ai-paid-count", result.paidCount + "개");

      if (el.items) {
        el.items.innerHTML = result.items
          .map(function (item) {
            return (
              '<tr><th scope="row">' + item.name + "</th><td class=\"is-text\">" +
              item.planLabel +
              (item.currency === "USD" ? " ($" + item.price + ")" : "") +
              "</td><td>" + (item.krw > 0 ? Core.won(item.krw) : "0원") + "</td></tr>"
            );
          })
          .join("");
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function renderExamples() {
      if (!el.example) return;
      var combos = [
        { name: "무료 조합", desc: "네 서비스 모두 무료", opt: {} },
        { name: "가벼운 유료", desc: "ChatGPT Go", opt: { chatgpt: "go" } },
        { name: "2만원 조합", desc: "ChatGPT Go + Gemini Plus", opt: { chatgpt: "go", gemini: "plus" } },
        { name: "집중형", desc: "ChatGPT Plus 단독", opt: { chatgpt: "plus" } },
        { name: "글쓰기 조합", desc: "ChatGPT Go + Claude Pro", opt: { chatgpt: "go", claude: "pro" } },
        { name: "전부 유료", desc: "Plus · Plus · Pro · Pro", opt: { chatgpt: "plus", gemini: "plus", claude: "pro", perplexity: "pro" } }
      ];
      el.example.innerHTML = combos
        .map(function (c) {
          var r = Ai.compute({
            chatgpt: c.opt.chatgpt || "free",
            gemini: c.opt.gemini || "free",
            claude: c.opt.claude || "free",
            perplexity: c.opt.perplexity || "free",
            rate: 1400
          });
          return (
            "<tr><th scope=\"row\">" + c.name + "</th><td class=\"is-muted is-text\">" +
            c.desc + "</td><td>" + Core.won(r.total) + "</td><td>" + Core.won(r.yearly) + "</td></tr>"
          );
        })
        .join("");
    }

    [el.chatgpt, el.gemini, el.claude, el.perplexity].forEach(function (node) {
      node.addEventListener("change", render);
    });
    UI.onInput([el.rate], render, 120);

    renderExamples();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
