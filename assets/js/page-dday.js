/* D-day · 근무일(공휴일 제외) · 기념일 계산기 — 페이지 연결
   - 기준일·목표일 D-day, 총 일수·주·개월, 주말·공휴일 제외 근무일
   - 기념일(100·200·300·500·1,000일, 1·2·3·5·10주년) 자동 계산
   - 2026·2027년 법정공휴일·대체공휴일 표시, 요약 복사
*/
(function () {
  "use strict";

  var D = window.DotoriDday;
  var UI = window.DotoriUI;
  if (!D || !UI) return;

  var $id = function (id) {
    return document.getElementById(id);
  };

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function todayLocal() {
    var now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  function inputValue(date) {
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
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
        if (ok) resolve();
        else reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  function flash(btn, text) {
    if (!btn.getAttribute("data-label")) btn.setAttribute("data-label", btn.textContent);
    btn.textContent = text;
    btn.classList.add("is-copied");
    window.clearTimeout(btn._timer);
    btn._timer = window.setTimeout(function () {
      btn.textContent = btn.getAttribute("data-label");
      btn.classList.remove("is-copied");
    }, 1600);
  }

  function init() {
    var baseEl = $id("dd-base");
    var targetEl = $id("dd-target");
    if (!baseEl || !targetEl) return;

    var today = todayLocal();
    /* 열자마자 오늘 기준으로 계산한다 (날짜 입력값은 항상 오늘로 초기화) */
    baseEl.value = inputValue(today);
    targetEl.value = inputValue(D.addDays(today, 30));

    var valueEl = $id("dd-value");
    var subEl = $id("dd-sub");
    var stateEl = $id("dd-state");
    var totalEl = $id("dd-total");
    var weeksEl = $id("dd-weeks");
    var monthsEl = $id("dd-months");
    var businessEl = $id("dd-business");
    var weekendEl = $id("dd-weekend");
    var holidayEl = $id("dd-holiday");
    var bizNoteEl = $id("dd-biznote");
    var warnEl = $id("dd-warn");
    var statusEl = $id("dd-status");
    var upcomingEl = $id("dd-upcoming");
    var annivBody = $id("dd-anniv-body");
    var annivNote = $id("dd-anniv-note");
    var annivNow = $id("dd-anniv-now");
    var startEl = $id("dd-start");

    if (startEl) startEl.value = inputValue(today);

    var current = null;

    function paint() {
      var base = D.parseDate(baseEl.value);
      var target = D.parseDate(targetEl.value);
      if (!base || !target) {
        setText(stateEl, "날짜를 다시 확인해 주세요");
        return;
      }
      var diff = D.diffDays(base, target);
      var info = D.span(base, target);
      var w = D.weekParts(diff);
      var m = D.monthParts(base, target);

      setText(valueEl, D.ddayText(diff));
      setText(subEl, D.label(target) + (diff >= 0 ? "까지" : " 이후"));
      setText(stateEl, diff === 0 ? "오늘입니다" : diff > 0 ? "앞으로 " + diff + "일" : diff + "일 지났습니다");
      setText(totalEl, info.total.toLocaleString("ko-KR") + "일");
      setText(
        weeksEl,
        w.weeks > 0 ? w.weeks + "주 " + w.days + "일" : w.days + "일"
      );
      setText(
        monthsEl,
        m.months > 0 ? m.months + "개월 " + m.days + "일" : m.days + "일"
      );
      setText(businessEl, info.business.toLocaleString("ko-KR") + "일");
      setText(weekendEl, info.weekend.toLocaleString("ko-KR") + "일");
      setText(holidayEl, info.holiday.toLocaleString("ko-KR") + "일");

      if (bizNoteEl) {
        if (info.total === 0) {
          bizNoteEl.textContent = "같은 날짜입니다. 근무일 계산은 시작일과 목표일이 다를 때 채워집니다.";
        } else {
          var from = info.businessFrom ? D.label(info.businessFrom) : "";
          var to = info.businessTo ? D.label(info.businessTo) : "";
          bizNoteEl.textContent =
            (diff > 0 ? "기준일 다음 날부터 " : "목표일부터 기준일 전날까지 ") +
            "주말 " +
            info.weekend +
            "일과 공휴일 " +
            info.holiday +
            "일을 뺀 값입니다 (" +
            from +
            " ~ " +
            to +
            ").";
        }
      }

      if (warnEl) {
        warnEl.hidden = info.covered !== false;
      }

      current = { base: base, target: target, diff: diff, info: info, weeks: w, months: m };
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    UI.onInput([baseEl, targetEl], paint, 30);
    baseEl.addEventListener("change", paint);
    targetEl.addEventListener("change", paint);

    var todayBtn = $id("dd-today");
    if (todayBtn) {
      todayBtn.addEventListener("click", function () {
        baseEl.value = inputValue(todayLocal());
        paint();
      });
    }

    var swapBtn = $id("dd-swap");
    if (swapBtn) {
      swapBtn.addEventListener("click", function () {
        var a = baseEl.value;
        baseEl.value = targetEl.value;
        targetEl.value = a;
        paint();
      });
    }

    var copyBtn = $id("dd-copy");
    if (copyBtn) {
      copyBtn.setAttribute("data-label", copyBtn.textContent);
      copyBtn.addEventListener("click", function () {
        if (!current) return;
        var lines = [
          "D-day " + D.ddayText(current.diff) + " · " + D.label(current.target),
          "기준일 " + D.label(current.base) + " → 목표일 " + D.label(current.target),
          "총 " +
            current.info.total +
            "일 · " +
            (current.weeks.weeks > 0 ? current.weeks.weeks + "주 " + current.weeks.days + "일" : current.weeks.days + "일") +
            " · " +
            (current.months.months > 0 ? current.months.months + "개월 " + current.months.days + "일" : current.months.days + "일"),
          "근무일 " +
            current.info.business +
            "일 (주말 " +
            current.info.weekend +
            "일 · 공휴일 " +
            current.info.holiday +
            "일 제외)",
          "공휴일 기준: 2026·2027년 관공서 공휴일(대체공휴일 포함)",
          "https://vgpymw5zfv-star.github.io/dday/"
        ];
        copyText(lines.join("\n")).then(
          function () {
            flash(copyBtn, "복사 완료 ✓");
            if (statusEl) statusEl.textContent = "요약을 클립보드에 복사했습니다.";
          },
          function () {
            if (statusEl) statusEl.textContent = "복사가 차단되었습니다. 화면의 값을 직접 선택해 주세요.";
          }
        );
      });
    }

    /* ---------------- 기념일 ---------------- */

    function paintAnniversaries() {
      if (!annivBody) return;
      var start = D.parseDate(startEl ? startEl.value : "");
      if (!start) {
        annivBody.innerHTML = "";
        if (annivNote) annivNote.textContent = "시작일을 입력하면 기념일이 표시됩니다.";
        return;
      }
      var ref = D.parseDate(baseEl.value) || todayLocal();
      var list = D.anniversaries(start, ref);
      var rows = [];
      var nextFound = false;
      list.forEach(function (item) {
        var isNext = !nextFound && item.diff >= 0;
        if (isNext) nextFound = true;
        var note = item.holiday ? item.holiday.name : D.isWeekend(item.date) ? "주말" : "";
        rows.push(
          '<tr' +
            (isNext ? ' class="is-next"' : "") +
            ">" +
            '<th scope="row">' +
            item.label +
            "</th>" +
            '<td data-label="날짜">' +
            D.label(item.date) +
            "</td>" +
            '<td data-label="D-day"' +
            (item.diff === 0 ? ' class="is-best"' : "") +
            ">" +
            D.ddayText(item.diff) +
            "</td>" +
            '<td data-label="비고">' +
            (note || "-") +
            "</td>" +
            "</tr>"
        );
      });
      annivBody.innerHTML = rows.join("");
      if (annivNote) {
        annivNote.textContent =
          "기준일 " + D.label(ref) + " 기준 · 음력 기념일은 지원하지 않습니다.";
      }
      if (annivNow) {
        var upcoming = list.filter(function (item) {
          return item.diff >= 0;
        });
        annivNow.textContent = upcoming.length
          ? upcoming[0].label + " " + D.label(upcoming[0].date) + " · " + D.ddayText(upcoming[0].diff)
          : "남은 기념일이 없습니다";
      }
    }

    if (startEl) {
      UI.onInput([startEl], paintAnniversaries, 30);
      startEl.addEventListener("change", paintAnniversaries);
    }

    /* ---------------- 다가오는 공휴일 ---------------- */

    function paintUpcoming() {
      if (!upcomingEl) return;
      var ref = D.parseDate(baseEl.value) || todayLocal();
      var list = D.upcomingHolidays(ref, 5);
      if (!list.length) {
        upcomingEl.innerHTML = '<li><span class="muted-sm">2026·2027년 공휴일 데이터 범위를 벗어났습니다.</span></li>';
        return;
      }
      upcomingEl.innerHTML = list
        .map(function (h) {
          var diff = D.diffDays(ref, h.date);
          return (
            "<li><b>" +
            h.name +
            "</b><span>" +
            D.label(h.date) +
            " · " +
            D.ddayText(diff) +
            "</span></li>"
          );
        })
        .join("");
    }

    function paintAll() {
      paint();
      paintAnniversaries();
      paintUpcoming();
    }

    UI.onInput([baseEl], paintUpcoming, 30);
    baseEl.addEventListener("change", paintUpcoming);

    paintAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
