/* 글자수·바이트 & 줄바꿈 정리기 — 페이지 연결
   - 입력 → 글자수(공백 포함/제외)·UTF-8/EUC-KR 바이트·원고지 매수·단어/문장·읽기 시간
   - 문자 메시지(SMS 90B / LMS 2,000B) 게이지
   - 원클릭 정리 5종 + 되돌리기 + 정리본 복사
*/
(function () {
  "use strict";

  var T = window.DotoriText;
  var UI = window.DotoriUI;
  if (!T || !UI) return;

  var $ = UI.$;
  var $id = function (id) {
    return document.getElementById(id);
  };

  var SAMPLE =
    "안녕하세요. 저는 3년 차 서비스 기획자로 일하고 있습니다.\n\n" +
    "고객 불편을 데이터로 확인하고, 작은 개선을 빠르게 실험하는 일을 좋아합니다.\n" +
    "지난해에는 결제 이탈률을 18% 줄이는 화면 개편을 맡아 끝까지 완주했습니다.\n\n" +
    "이번 지원을 통해 더 큰 사용자 문제를 풀고 싶습니다.";

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

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }

  function init() {
    var input = $id("tc-input");
    if (!input) return;

    var status = $id("tc-status");
    var smsBar = $id("tc-sms-bar");
    var smsNote = $id("tc-sms-note");
    var countEls = {
      chars: $id("tc-chars"),
      charsSub: $id("tc-chars-sub"),
      nospace: $id("tc-nospace"),
      utf8: $id("tc-utf8"),
      euckr: $id("tc-euckr"),
      sheets: $id("tc-sheets"),
      words: $id("tc-words"),
      sentences: $id("tc-sentences"),
      lines: $id("tc-lines"),
      read: $id("tc-read"),
      sms: $id("tc-sms"),
      smsCap: $id("tc-sms-cap"),
      avgSentence: $id("tc-avg-sentence"),
      avgWord: $id("tc-avg-word")
    };

    var undoStack = [];
    var lastClean = null;

    function pushUndo(value) {
      undoStack.push(value);
      if (undoStack.length > 20) undoStack.shift();
      var undoBtn = $id("tc-undo");
      if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    }

    function paintSms(info) {
      var bytes = info.bytesEucKr;
      var ratio = bytes / T.LMS_LIMIT;
      var width = Math.max(0, Math.min(1, ratio)) * 100;
      if (smsBar) {
        smsBar.style.width = width + "%";
        smsBar.classList.toggle("is-warn", bytes > T.SMS_LIMIT && bytes <= T.LMS_LIMIT);
        smsBar.classList.toggle("is-bad", bytes > T.LMS_LIMIT);
      }
      if (!smsNote) return;
      if (bytes === 0) {
        smsNote.textContent = "문자를 입력하면 SMS(90B) · LMS(2,000B) 기준으로 나눠 보여 드립니다.";
        return;
      }
      if (bytes <= T.SMS_LIMIT) {
        smsNote.textContent = "SMS 한 건으로 보낼 수 있습니다 · " + (T.SMS_LIMIT - bytes) + "B 남음";
      } else if (bytes <= T.LMS_LIMIT) {
        smsNote.textContent =
          "SMS를 넘어 LMS로 보내야 합니다 · 남은 " + (T.LMS_LIMIT - bytes) + "B";
      } else {
        smsNote.textContent =
          "LMS(2,000B)도 " + (bytes - T.LMS_LIMIT) + "B 초과 — MMS 또는 나눠 보내기";
      }
    }

    function update() {
      var info = T.analyze(input.value);
      setText(countEls.chars, info.charsWithSpace.toLocaleString("ko-KR"));
      setText(
        countEls.charsSub,
        info.charsNoSpace.toLocaleString("ko-KR") + "자(공백 제외)"
      );
      setText(countEls.nospace, info.charsNoSpace.toLocaleString("ko-KR") + "자");
      setText(countEls.utf8, info.bytesUtf8.toLocaleString("ko-KR") + "B");
      setText(countEls.euckr, info.bytesEucKr.toLocaleString("ko-KR") + "B");
      setText(
        countEls.sheets,
        info.charsWithSpace === 0
          ? "0매"
          : info.manuscriptSheets.toFixed(1) + "매 · " + info.manuscriptSheetsCeil + "장"
      );
      setText(countEls.words, info.words.toLocaleString("ko-KR") + "개");
      setText(countEls.sentences, info.sentences.toLocaleString("ko-KR") + "문장");
      setText(
        countEls.lines,
        info.lines === 0
          ? "0줄"
          : info.lines.toLocaleString("ko-KR") + "줄 (빈 줄 " + info.blankLines + ")"
      );
      setText(countEls.read, info.readLabel);
      setText(countEls.sms, info.sms.label);
      setText(
        countEls.smsCap,
        info.bytesEucKr === 0
          ? "−"
          : info.sms.tier === "over"
          ? "−" + info.sms.over + "B"
          : info.sms.remaining + "B 남음"
      );
      setText(countEls.avgSentence, info.perSentence ? info.perSentence + "자" : "−");
      setText(countEls.avgWord, info.perWord ? info.perWord + "자" : "−");
      paintSms(info);
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    var schedule = UI.onInput([input], update, 60);

    input.addEventListener("input", function () {
      if (status) status.textContent = "";
    });

    /* ---------------- 원클릭 정리 ---------------- */

    UI.$$("[data-clean]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-clean");
        var before = input.value;
        var after = T.clean(before, mode);
        if (after === before) {
          if (status) status.textContent = "이미 정리된 상태입니다.";
          return;
        }
        pushUndo(before);
        input.value = after;
        lastClean = mode;
        var delta = T.analyze(before).charsWithSpace - T.analyze(after).charsWithSpace;
        if (status) {
          status.textContent =
            (T.CLEANERS[mode] ? T.CLEANERS[mode].label : "정리") +
            " 완료 · " +
            (delta > 0 ? delta + "자 줄었습니다" : "글자수 변화 없음") +
            " · 되돌리기 가능";
        }
        update();
      });
    });

    var undoBtn = $id("tc-undo");
    if (undoBtn) {
      undoBtn.disabled = true;
      undoBtn.addEventListener("click", function () {
        if (!undoStack.length) return;
        input.value = undoStack.pop();
        undoBtn.disabled = undoStack.length === 0;
        if (status) status.textContent = "정리 전으로 되돌렸습니다.";
        update();
      });
    }

    /* ---------------- 복사 · 예시 · 비우기 ---------------- */

    var copyBtn = $id("tc-copy");
    if (copyBtn) {
      copyBtn.setAttribute("data-label", copyBtn.textContent);
      copyBtn.addEventListener("click", function () {
        if (!input.value) {
          if (status) status.textContent = "복사할 내용이 없습니다.";
          return;
        }
        copyText(input.value).then(
          function () {
            flash(copyBtn, "복사 완료 ✓");
            if (status) status.textContent = "정리한 내용을 클립보드에 복사했습니다.";
          },
          function () {
            if (status) status.textContent = "복사가 차단되었습니다. 내용을 직접 선택해 주세요.";
          }
        );
      });
    }

    var sampleBtn = $id("tc-sample");
    if (sampleBtn) {
      sampleBtn.addEventListener("click", function () {
        pushUndo(input.value);
        input.value = SAMPLE;
        if (status) status.textContent = "예시 문장을 넣었습니다. 지우고 내 글을 붙여 넣어도 됩니다.";
        update();
        input.focus();
      });
    }

    var clearBtn = $id("tc-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!input.value) return;
        pushUndo(input.value);
        input.value = "";
        if (status) status.textContent = "내용을 비웠습니다. 되돌리기로 복구할 수 있습니다.";
        update();
        input.focus();
      });
    }

    /* 붙여넣기·입력 모두 즉시 반영 */
    input.addEventListener("paste", function () {
      window.setTimeout(function () {
        schedule();
        update();
      }, 0);
    });

    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
