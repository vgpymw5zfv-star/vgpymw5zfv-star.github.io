/* 고정비·구독료 진단기 — 페이지 연결
   - 항목 행 추가/삭제, 결제 주기·분류 선택, 정리 후보 체크
   - 월·연 고정비 합계, 소득 대비 비율 게이지, 카테고리 비중, 요약 복사
   코어: assets/js/subscription-audit.js (window.DotoriSubAudit)
*/
(function () {
  "use strict";

  var K = window.DotoriSubAudit;
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
    var v = Math.round(n || 0).toLocaleString("ko-KR");
    return v + "원";
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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function init() {
    var els = {
      income: $id("sa-income"),
      list: $id("sa-list"),
      add: $id("sa-add"),
      presets: $id("sa-presets"),
      monthly: $id("sa-monthly"),
      monthlySub: $id("sa-monthly-sub"),
      annual: $id("sa-annual"),
      ratio: $id("sa-ratio"),
      over: $id("sa-over"),
      remaining: $id("sa-remaining"),
      cancel: $id("sa-cancel"),
      gaugeWrap: $id("sa-gauge-wrap"),
      gauge: $id("sa-gauge"),
      note: $id("sa-note"),
      table: $id("sa-table"),
      text: $id("sa-text"),
      copy: $id("sa-copy"),
      status: $id("sa-status")
    };

    if (!els.list) return;

    var cycleOptions = K.CYCLES.map(function (c) {
      return '<option value="' + c.id + '">' + c.label + "</option>";
    }).join("");

    var catOptions = K.CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '">' + c.label + "</option>";
    }).join("");

    function rowTemplate(data) {
      var wrap = document.createElement("div");
      wrap.className = "sa-row";
      wrap.setAttribute("data-row", "1");
      wrap.innerHTML =
        '<div class="sa-row__head">' +
        '<span class="sa-row__no">항목</span>' +
        '<button type="button" class="btn-ghost sa-remove">삭제</button>' +
        "</div>" +
        '<div class="field-row">' +
        '<label class="field">' +
        '<span class="field-label">이름 <small>선택</small></span>' +
        '<span class="field-control"><input type="text" data-k="name" autocomplete="off" placeholder="예: 넷플릭스"></span>' +
        "</label>" +
        '<label class="field">' +
        '<span class="field-label">금액 <small>원</small></span>' +
        '<span class="field-control"><input type="number" inputmode="numeric" min="0" step="100" data-k="amount" placeholder="0"></span>' +
        "</label>" +
        "</div>" +
        '<div class="field-row" style="margin-top:10px">' +
        '<label class="field">' +
        '<span class="field-label">주기</span>' +
        '<span class="field-control"><select data-k="cycle">' +
        cycleOptions +
        "</select></span>" +
        "</label>" +
        '<label class="field">' +
        '<span class="field-label">분류</span>' +
        '<span class="field-control"><select data-k="category">' +
        catOptions +
        "</select></span>" +
        "</label>" +
        "</div>" +
        '<label class="check" style="margin-top:10px">' +
        '<input type="checkbox" data-k="cancel">' +
        '<span class="check__label">정리 후보<span class="check__desc">해지하면 얼마가 남는지 계산합니다</span></span>' +
        "</label>";

      var name = wrap.querySelector('[data-k="name"]');
      var amount = wrap.querySelector('[data-k="amount"]');
      var cycle = wrap.querySelector('[data-k="cycle"]');
      var category = wrap.querySelector('[data-k="category"]');
      var cancel = wrap.querySelector('[data-k="cancel"]');
      var remove = wrap.querySelector(".sa-remove");

      if (data) {
        if (data.name) name.value = data.name;
        if (data.amount) amount.value = String(data.amount);
        if (data.cycle) cycle.value = data.cycle;
        if (data.category) category.value = data.category;
        if (data.cancel) cancel.checked = true;
      }

      remove.addEventListener("click", function () {
        wrap.parentNode.removeChild(wrap);
        renumber();
        paint();
      });

      [name, amount, cycle, category, cancel].forEach(function (el) {
        el.addEventListener("input", paint);
        el.addEventListener("change", paint);
      });

      return wrap;
    }

    function renumber() {
      var rows = els.list.querySelectorAll('[data-row="1"]');
      rows.forEach(function (row, i) {
        var no = row.querySelector(".sa-row__no");
        if (no) no.textContent = "항목 " + (i + 1);
        var remove = row.querySelector(".sa-remove");
        if (remove) remove.hidden = rows.length < 2;
      });
    }

    function readRows() {
      return Array.prototype.map.call(
        els.list.querySelectorAll('[data-row="1"]'),
        function (row) {
          return {
            name: row.querySelector('[data-k="name"]').value,
            amount: row.querySelector('[data-k="amount"]').value,
            cycle: row.querySelector('[data-k="cycle"]').value,
            category: row.querySelector('[data-k="category"]').value,
            cancel: row.querySelector('[data-k="cancel"]').checked
          };
        }
      );
    }

    function setGauge(ratio, status) {
      if (!els.gaugeWrap || !els.gauge) return;
      if (ratio === null) {
        els.gaugeWrap.hidden = true;
        return;
      }
      els.gaugeWrap.hidden = false;
      els.gauge.style.width = Math.min(100, Math.max(0, ratio)) + "%";
      els.gauge.classList.remove("is-warn", "is-bad", "is-jump");
      if (status === "warn") els.gauge.classList.add("is-warn");
      else if (status === "bad") els.gauge.classList.add("is-bad");
    }

    function paint() {
      var result = K.analyze({ income: els.income ? els.income.value : "", rows: readRows() });

      if (!result.ok) {
        setText(els.monthly, "—");
        setText(els.monthlySub, "금액을 넣은 항목이 아직 없습니다. 아래 예시 항목의 금액을 바꿔 보세요.");
        ["annual", "ratio", "over", "remaining", "cancel"].forEach(function (k) {
          if (els[k]) setText(els[k], "—");
        });
        setGauge(null);
        if (els.note) {
          setText(
            els.note,
            "고정비는 매달 거의 같은 금액으로 나가는 지출입니다. 항목을 넣으면 소득 대비 비율까지 함께 계산합니다."
          );
        }
        if (els.table) {
          var emptyBody = els.table.querySelector("tbody");
          if (emptyBody) emptyBody.innerHTML = "";
        }
        if (els.text) els.text.value = "";
        if (window.DotoriNotifyResize) window.DotoriNotifyResize();
        return;
      }

      UI.countTo(els.monthly, result.monthly, won, 420, won(result.monthly));
      setText(
        els.monthlySub,
        "항목 " + result.count + "건 · 연 " + won(result.annual)
      );
      setText(els.annual, won(result.annual));

      if (result.ratio === null) {
        setText(els.ratio, "월 실수령액 입력");
        setText(els.over, "월 실수령액 입력");
        setText(els.remaining, "월 실수령액 입력");
      } else {
        setText(els.ratio, result.ratio.toFixed(1) + "%");
        setText(els.over, result.over > 0 ? won(result.over) + " 초과" : "없음");
        setText(els.remaining, won(result.remaining));
      }

      setText(
        els.cancel,
        result.cancel.count > 0
          ? "월 " + won(result.cancel.monthly) + " · 연 " + won(result.cancel.annual)
          : "체크한 항목 없음"
      );

      setGauge(result.ratio, result.status);

      if (els.note) {
        var text = K.diagnosis(result);
        if (!text) {
          text =
            "항목 " +
            result.count +
            "건 · 월 " +
            won(result.monthly) +
            ". 월 실수령액을 넣으면 소득 대비 비율과 50% 권장선 초과분을 계산합니다.";
        }
        if (result.top) {
          text +=
            " 가장 큰 항목은 " +
            (result.top.name || result.top.categoryLabel) +
            "(" +
            won(result.top.monthly) +
            ", " +
            result.top.share.toFixed(0) +
            "%)입니다.";
        }
        setText(els.note, text);
      }

      if (els.table) {
        var tbody = els.table.querySelector("tbody");
        if (tbody) {
          tbody.innerHTML = result.rows
            .map(function (row) {
              return (
                "<tr>" +
                "<th scope=\"row\">" +
                (row.name ? escapeHtml(row.name) : "이름 없음") +
                (row.cancel ? ' <span class="pill pill--blue">정리</span>' : "") +
                "</th>" +
                "<td class=\"is-text\" data-label=\"분류\">" +
                escapeHtml(row.categoryLabel) +
                "</td>" +
                "<td class=\"is-text\" data-label=\"주기\">" +
                row.cycleLabel +
                "</td>" +
                "<td data-label=\"결제액\">" +
                won(row.amount) +
                "</td>" +
                "<td data-label=\"월 환산\">" +
                won(row.monthly) +
                "</td>" +
                "<td data-label=\"연간\">" +
                won(row.annual) +
                "</td>" +
                "<td data-label=\"비중\">" +
                row.share.toFixed(1) +
                "%</td>" +
                "</tr>"
              );
            })
            .join("");
        }
      }

      if (els.text) {
        var lines = [K.summary(result)];
        result.byCategory.slice(0, 3).forEach(function (cat) {
          lines.push(
            "· " +
              cat.label +
              " 월 " +
              won(cat.monthly) +
              " (" +
              cat.share.toFixed(0) +
              "%)"
          );
        });
        els.text.value = lines.join("\n");
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    if (els.add) {
      els.add.addEventListener("click", function () {
        var row = rowTemplate({});
        els.list.appendChild(row);
        renumber();
        var first = row.querySelector('[data-k="name"]');
        if (first) first.focus();
        paint();
      });
    }

    if (els.presets) {
      els.presets.addEventListener("click", function (event) {
        var btn = event.target.closest("button[data-name]");
        if (!btn) return;
        var row = rowTemplate({
          name: btn.getAttribute("data-name"),
          amount: btn.getAttribute("data-amount"),
          cycle: "monthly",
          category: btn.getAttribute("data-category")
        });
        els.list.appendChild(row);
        renumber();
        paint();
        if (window.DotoriToast) window.DotoriToast(btn.getAttribute("data-name") + " 항목을 추가했습니다");
        if (window.DotoriNotifyResize) window.DotoriNotifyResize();
      });
    }

    if (els.income) {
      els.income.addEventListener("input", paint);
      els.income.addEventListener("change", paint);
    }

    /* 기본 예시 — 공개 요금 기준, 청구서와 다르면 고치도록 안내 */
    els.list.appendChild(
      rowTemplate({ name: "유튜브 프리미엄", amount: 14900, cycle: "monthly", category: "subscribe" })
    );
    els.list.appendChild(
      rowTemplate({ name: "쿠팡 와우", amount: 7890, cycle: "monthly", category: "subscribe" })
    );
    els.list.appendChild(
      rowTemplate({ name: "ChatGPT Plus", amount: 29000, cycle: "monthly", category: "subscribe" })
    );
    els.list.appendChild(
      rowTemplate({ name: "통신비", amount: 55000, cycle: "monthly", category: "telecom" })
    );
    els.list.appendChild(
      rowTemplate({ name: "아파트 관리비", amount: 180000, cycle: "monthly", category: "housing" })
    );
    renumber();
    paint();

    if (els.copy) {
      els.copy.addEventListener("click", function () {
        var text = (els.text && els.text.value) || "";
        if (!text) {
          if (els.status) els.status.textContent = "금액을 넣은 항목이 먼저 필요합니다.";
          return;
        }
        copyText(text).then(
          function () {
            flash(els.copy, "복사 완료 ✓");
            if (els.status) els.status.textContent = "요약을 복사했습니다. 메모·카톡에 붙여 넣으세요.";
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
