/* 경력기간 계산기 — 페이지 연결
   - 경력 행 추가/삭제, 재직 중이면 기준일까지
   - 수습 제외 반영, 겹친 기간 중복 제거 / 단순 합산
   - 경력별 기간 표, 이력서용 요약 복사
   코어: assets/js/career.js (window.DotoriCareer)
*/
(function () {
  "use strict";

  var K = window.DotoriCareer;
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

  function yearsMonths(months) {
    return K.yearsMonths(months);
  }

  function init() {
    var els = {
      base: $id("cr-base"),
      mode: $id("cr-mode"),
      list: $id("cr-list"),
      add: $id("cr-add"),
      total: $id("cr-total"),
      totalSub: $id("cr-total-sub"),
      months: $id("cr-months"),
      overlap: $id("cr-overlap"),
      count: $id("cr-count"),
      years: $id("cr-years"),
      days: $id("cr-days"),
      note: $id("cr-note"),
      table: $id("cr-table"),
      text: $id("cr-text"),
      copy: $id("cr-copy"),
      status: $id("cr-status")
    };

    if (!els.base || !els.list) return;

    if (!els.base.value) els.base.value = isoToday();

    var mode = "merge";
    if (UI.bindSegment) {
      UI.bindSegment(els.mode, function (v) {
        mode = v === "sum" ? "sum" : "merge";
        paint();
      });
    }

    var seq = 0;

    function rowTemplate(data) {
      seq += 1;
      var wrap = document.createElement("div");
      wrap.className = "cr-row";
      wrap.setAttribute("data-row", "1");
      wrap.innerHTML =
        '<div class="cr-row__head">' +
        '<span class="cr-row__no">경력</span>' +
        '<button type="button" class="btn-ghost cr-remove">삭제</button>' +
        "</div>" +
        '<label class="field">' +
        '<span class="field-label">회사명 <small>선택</small></span>' +
        '<span class="field-control"><input type="text" data-k="name" autocomplete="off" placeholder="예: ○○전자"></span>' +
        "</label>" +
        '<div class="field-row" style="margin-top:10px">' +
        '<label class="field">' +
        '<span class="field-label">입사일</span>' +
        '<span class="field-control"><input type="date" data-k="hire"></span>' +
        "</label>" +
        '<label class="field">' +
        '<span class="field-label">퇴사일</span>' +
        '<span class="field-control"><input type="date" data-k="leave"></span>' +
        "</label>" +
        "</div>" +
        '<label class="check" style="margin-top:10px">' +
        '<input type="checkbox" data-k="current">' +
        '<span class="check__label">재직 중<span class="check__desc">기준일까지 경력으로 계산합니다</span></span>' +
        "</label>" +
        '<label class="field" style="margin-top:10px">' +
        '<span class="field-label">수습 제외 <small>제외 개월</small></span>' +
        '<span class="field-control"><select data-k="probation">' +
        '<option value="0" selected>제외 안 함 (전체 인정)</option>' +
        '<option value="1">1개월 제외</option>' +
        '<option value="2">2개월 제외</option>' +
        '<option value="3">3개월 제외</option>' +
        '<option value="6">6개월 제외</option>' +
        "</select></span>" +
        "</label>";

      var name = wrap.querySelector('[data-k="name"]');
      var hire = wrap.querySelector('[data-k="hire"]');
      var leave = wrap.querySelector('[data-k="leave"]');
      var current = wrap.querySelector('[data-k="current"]');
      var probation = wrap.querySelector('[data-k="probation"]');
      var remove = wrap.querySelector(".cr-remove");

      if (data) {
        if (data.name) name.value = data.name;
        if (data.hire) hire.value = data.hire;
        if (data.leave) leave.value = data.leave;
        if (data.current) current.checked = true;
        if (data.probation) probation.value = String(data.probation);
      }

      function syncCurrent() {
        leave.disabled = current.checked;
        leave.setAttribute("aria-disabled", current.checked ? "true" : "false");
        if (current.checked) leave.value = "";
      }

      current.addEventListener("change", syncCurrent);
      syncCurrent();

      remove.addEventListener("click", function () {
        wrap.parentNode.removeChild(wrap);
        renumber();
        paint();
      });

      [name, hire, leave, probation].forEach(function (el) {
        el.addEventListener("input", paint);
        el.addEventListener("change", paint);
      });

      return wrap;
    }

    function renumber() {
      var rows = els.list.querySelectorAll('[data-row="1"]');
      rows.forEach(function (row, i) {
        var no = row.querySelector(".cr-row__no");
        if (no) no.textContent = "경력 " + (i + 1);
        var remove = row.querySelector(".cr-remove");
        if (remove) remove.hidden = rows.length < 2;
      });
    }

    function readRows() {
      return Array.prototype.map.call(els.list.querySelectorAll('[data-row="1"]'), function (row) {
        return {
          name: row.querySelector('[data-k="name"]').value,
          hire: row.querySelector('[data-k="hire"]').value,
          leave: row.querySelector('[data-k="leave"]').value,
          current: row.querySelector('[data-k="current"]').checked,
          probation: row.querySelector('[data-k="probation"]').value
        };
      });
    }

    function overlapNote(rows, index) {
      var me = rows[index];
      if (!me) return "";
      var start = K.parseISO(me.recognizedStart);
      var end = K.parseISO(me.end);
      if (!start || !end) return "";
      var days = 0;
      rows.forEach(function (other, i) {
        if (i === index) return;
        var s = K.parseISO(other.recognizedStart);
        var e = K.parseISO(other.end);
        if (!s || !e) return;
        var from = s.getTime() > start.getTime() ? s : start;
        var to = e.getTime() < end.getTime() ? e : end;
        if (to.getTime() > from.getTime()) days += K.daysBetween(from, to);
      });
      return days;
    }

    function paint() {
      var result = K.compute({
        base: els.base.value,
        mode: mode,
        entries: readRows()
      });

      if (!result.ok) {
        setText(els.total, "—");
        setText(
          els.totalSub,
          result.reason === "empty"
            ? "입사일을 넣은 경력이 아직 없습니다."
            : result.reason === "invalid"
              ? "퇴사일이 입사일보다 빠른 경력이 있습니다. 날짜를 확인해 주세요."
              : "기준일을 넣으면 총 경력을 계산합니다."
        );
        ["months", "overlap", "count", "years", "days"].forEach(function (k) {
          if (els[k]) setText(els[k], "—");
        });
        if (els.table) {
          var tb = els.table.querySelector("tbody");
          if (tb) tb.innerHTML = "";
        }
        if (els.text) els.text.value = "";
        if (window.DotoriNotifyResize) window.DotoriNotifyResize();
        return;
      }

      UI.countTo(
        els.total,
        result.recognizedMonths,
        function (v) {
          return yearsMonths(Math.max(0, Math.round(v)));
        },
        420,
        result.label
      );
      setText(
        els.totalSub,
        "경력 " + result.count + "건 · " + (mode === "merge" ? "겹친 기간 중복 제거" : "단순 합산")
      );
      setText(els.months, result.recognizedMonths + "개월");
      setText(
        els.overlap,
        result.overlapDays > 0 ? result.overlapDays + "일 제외" : "없음"
      );
      setText(els.count, result.count + "건");
      setText(els.years, yearsMonths(result.recognizedMonths));
      setText(els.days, result.totalDays.toLocaleString("ko-KR") + "일");

      if (els.note) {
        setText(
          els.note,
          mode === "merge"
            ? "겹치는 경력은 한 번만 세었습니다. 기간 합산은 1개월을 30일로 보는 인사 실무 관행을 따르므로, 지원하는 회사의 기준을 한 번 더 확인하세요."
            : "각 경력을 그대로 더했습니다. 겸직·프리랜서처럼 기간이 겹친다면 중복 제거로 바꿔 실제 인정 경력을 확인하세요."
        );
      }

      if (els.table) {
        var tbody = els.table.querySelector("tbody");
        if (tbody) {
          tbody.innerHTML = result.rows
            .map(function (r, i) {
              var ov = overlapNote(result.rows, i);
              var notes = [];
              if (r.current) notes.push("재직 중");
              if (r.probation) notes.push("수습 " + r.probation + "개월 제외");
              if (ov > 0) notes.push("겹침 " + ov + "일");
              return (
                "<tr>" +
                "<th scope=\"row\">" +
                (r.name ? escapeHtml(r.name) : "경력 " + (i + 1)) +
                "</th>" +
                "<td data-label=\"기간\">" +
                r.hire +
                " ~ " +
                (r.current ? "재직 중" : r.end) +
                "</td>" +
                "<td data-label=\"개월\">" +
                r.months +
                "개월" +
                (r.days ? " " + r.days + "일" : "") +
                "</td>" +
                "<td data-label=\"인정 개월\">" +
                r.recognizedMonths +
                "개월" +
                (r.recognizedDays ? " " + r.recognizedDays + "일" : "") +
                "</td>" +
                "<td class=\"is-muted\" data-label=\"비고\">" +
                (notes.length ? notes.join(" · ") : "—") +
                "</td>" +
                "</tr>"
              );
            })
            .join("");
        }
      }

      if (els.text) {
        var lines = [K.summary(result)];
        result.rows.forEach(function (r, i) {
          lines.push(
            "· " +
              (r.name || "경력 " + (i + 1)) +
              " " +
              r.hire +
              " ~ " +
              (r.current ? "재직 중" : r.end) +
              " (" +
              K.periodLabel(r.recognizedMonths, r.recognizedDays) +
              ")"
          );
        });
        els.text.value = lines.join("\n");
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    if (els.add) {
      els.add.addEventListener("click", function () {
        var row = rowTemplate({});
        els.list.appendChild(row);
        renumber();
        var first = row.querySelector('[data-k="hire"]');
        if (first) first.focus();
        paint();
      });
    }

    els.base.addEventListener("input", paint);
    els.base.addEventListener("change", paint);

    /* 기본 예시 2건 */
    els.list.appendChild(rowTemplate({ name: "회사 A", hire: "2019-03-04", leave: "2021-12-31" }));
    els.list.appendChild(rowTemplate({ name: "회사 B", hire: "2022-01-10", current: true }));
    renumber();
    paint();

    if (els.copy) {
      els.copy.addEventListener("click", function () {
        var text = (els.text && els.text.value) || "";
        if (!text) {
          if (els.status) els.status.textContent = "경력을 먼저 넣어 주세요.";
          return;
        }
        copyText(text).then(
          function () {
            flash(els.copy, "복사 완료 ✓");
            if (els.status) els.status.textContent = "이력서에 붙여 넣을 요약을 복사했습니다.";
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
