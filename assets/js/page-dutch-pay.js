/* 모임 회비 · 더치페이 정산 계산기 — 페이지 연결
   - 참석자 추가/삭제, 차수 추가/삭제
   - 차수마다 결제자·참석자를 따로 지정
   - 정산 단위(끝전)와 송금 방식(상계/각자) 전환
   - 카톡 문구 자동 생성·복사
*/
(function () {
  "use strict";

  var D = window.DotoriDutch;
  var UI = window.DotoriUI;
  if (!D || !UI) return;

  function $id(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (!el) return;
    var next = String(value);
    if (el.textContent !== next) el.textContent = next;
  }

  var MAX_PEOPLE = 10;
  var MAX_ROUNDS = 5;

  var state = {
    people: ["민수", "지훈", "서연", "하늘"],
    rounds: [
      { amount: 120000, payer: 0, parts: [true, true, true, true] },
      { amount: 45000, payer: 1, parts: [true, true, true, false] }
    ],
    unit: 100,
    mode: "net"
  };

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
    var el = {
      people: $id("dp-people"),
      addPerson: $id("dp-add-person"),
      rounds: $id("dp-rounds"),
      addRound: $id("dp-add-round"),
      warn: $id("dp-warn"),
      warnText: $id("dp-warn-text"),
      unit: $id("dp-unit"),
      mode: $id("dp-mode"),
      value: $id("dp-value"),
      sub: $id("dp-sub"),
      total: $id("dp-total"),
      count: $id("dp-count"),
      max: $id("dp-max"),
      send: $id("dp-send"),
      transfers: $id("dp-transfers"),
      note: $id("dp-note"),
      text: $id("dp-text"),
      copy: $id("dp-copy"),
      status: $id("dp-status"),
      table: $id("dp-table"),
      roundTable: $id("dp-round-table")
    };

    if (!el.people || !el.rounds) return;

    /* ---------- 참석자 ---------- */

    function renderPeople() {
      el.people.innerHTML = "";
      state.people.forEach(function (name, i) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px";

        var ctrl = document.createElement("span");
        ctrl.className = "field-control";
        ctrl.style.flex = "1";
        ctrl.style.minWidth = "0";

        var input = document.createElement("input");
        input.type = "text";
        input.value = name;
        input.autocomplete = "off";
        input.maxLength = 12;
        input.setAttribute("aria-label", "참석자 " + (i + 1) + " 이름");
        input.placeholder = "이름";
        input.addEventListener("input", function () {
          state.people[i] = input.value;
          syncNames();
          paint();
        });
        ctrl.appendChild(input);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "btn-ghost";
        del.textContent = "삭제";
        del.style.minWidth = "52px";
        del.addEventListener("click", function () {
          removePerson(i);
        });

        row.appendChild(ctrl);
        row.appendChild(del);
        el.people.appendChild(row);
      });
      if (el.addPerson) el.addPerson.disabled = state.people.length >= MAX_PEOPLE;
    }

    function removePerson(index) {
      if (state.people.length <= 1) {
        if (el.status) el.status.textContent = "참석자는 한 명 이상 있어야 합니다.";
        return;
      }
      state.people.splice(index, 1);
      state.rounds.forEach(function (r) {
        r.parts.splice(index, 1);
        if (r.payer === index) {
          var first = r.parts.indexOf(true);
          r.payer = first >= 0 ? first : 0;
        } else if (r.payer > index) {
          r.payer -= 1;
        }
      });
      renderPeople();
      renderRounds();
      paint();
    }

    function addPerson() {
      if (state.people.length >= MAX_PEOPLE) return;
      state.people.push("참석자 " + (state.people.length + 1));
      state.rounds.forEach(function (r) {
        r.parts.push(true);
      });
      renderPeople();
      renderRounds();
      paint();
    }

    /* ---------- 차수 ---------- */

    var roundRefs = [];

    function renderRounds() {
      el.rounds.innerHTML = "";
      roundRefs = [];

      state.rounds.forEach(function (r, idx) {
        var box = document.createElement("div");
        box.style.cssText =
          "padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff;margin-top:10px";

        var head = document.createElement("div");
        head.style.cssText =
          "display:flex;align-items:center;justify-content:space-between;gap:10px";
        var title = document.createElement("strong");
        title.style.cssText = "font-size:14px;color:var(--navy)";
        title.textContent = idx + 1 + "차";
        head.appendChild(title);
        if (state.rounds.length > 1) {
          var del = document.createElement("button");
          del.type = "button";
          del.className = "btn-ghost";
          del.textContent = "이 차수 삭제";
          del.addEventListener("click", function () {
            state.rounds.splice(idx, 1);
            renderRounds();
            paint();
          });
          head.appendChild(del);
        }
        box.appendChild(head);

        var row = document.createElement("div");
        row.className = "field-row";
        row.style.marginTop = "10px";

        var amountLabel = document.createElement("label");
        amountLabel.className = "field";
        var amountSpan = document.createElement("span");
        amountSpan.className = "field-label";
        amountSpan.textContent = idx + 1 + "차 결제액";
        var amountCtrl = document.createElement("span");
        amountCtrl.className = "field-control";
        var amountInput = document.createElement("input");
        amountInput.type = "text";
        amountInput.inputMode = "numeric";
        amountInput.autocomplete = "off";
        amountInput.value = r.amount ? D.comma(r.amount) : "";
        amountInput.placeholder = "0";
        amountInput.setAttribute("aria-label", idx + 1 + "차 결제액");
        amountInput.addEventListener("input", function () {
          r.amount = D.num(amountInput.value, 0);
          paint();
        });
        var unitSpan = document.createElement("span");
        unitSpan.className = "field-unit";
        unitSpan.textContent = "원";
        amountCtrl.appendChild(amountInput);
        amountCtrl.appendChild(unitSpan);
        amountLabel.appendChild(amountSpan);
        amountLabel.appendChild(amountCtrl);

        var payerLabel = document.createElement("label");
        payerLabel.className = "field";
        var payerSpan = document.createElement("span");
        payerSpan.className = "field-label";
        payerSpan.textContent = "결제한 사람";
        var payerCtrl = document.createElement("span");
        payerCtrl.className = "field-control";
        var payerSelect = document.createElement("select");
        payerSelect.setAttribute("aria-label", idx + 1 + "차 결제자");
        payerSelect.addEventListener("change", function () {
          r.payer = Number(payerSelect.value) || 0;
          if (r.parts.length > r.payer) r.parts[r.payer] = true;
          if (chipRefs[r.payer]) chipRefs[r.payer].setAttribute("aria-pressed", "true");
          paint();
        });
        payerCtrl.appendChild(payerSelect);
        payerLabel.appendChild(payerSpan);
        payerLabel.appendChild(payerCtrl);

        row.appendChild(amountLabel);
        row.appendChild(payerLabel);
        box.appendChild(row);

        var partLabel = document.createElement("p");
        partLabel.className = "field-label";
        partLabel.style.margin = "12px 0 6px";
        partLabel.textContent = "참석자";
        box.appendChild(partLabel);

        var chips = document.createElement("div");
        chips.className = "filters";
        chips.setAttribute("role", "group");
        chips.setAttribute("aria-label", idx + 1 + "차 참석자");
        var chipRefs = [];
        state.people.forEach(function (name, pi) {
          var chip = document.createElement("button");
          chip.type = "button";
          chip.className = "chip";
          chip.textContent = name || "참석자 " + (pi + 1);
          chip.setAttribute("aria-pressed", r.parts[pi] ? "true" : "false");
          chip.addEventListener("click", function () {
            r.parts[pi] = !r.parts[pi];
            chip.setAttribute("aria-pressed", r.parts[pi] ? "true" : "false");
            if (r.parts[pi] && r.payer === pi) {
              /* 결제자가 참석으로 바뀌면 그대로 둔다 */
            }
            if (!r.parts[pi] && r.payer === pi) {
              var first = r.parts.indexOf(true);
              if (first >= 0) {
                r.payer = first;
                payerSelect.value = String(first);
              }
            }
            paint();
          });
          chips.appendChild(chip);
          chipRefs.push(chip);
        });
        box.appendChild(chips);

        el.rounds.appendChild(box);

        roundRefs.push({
          amountInput: amountInput,
          payerSelect: payerSelect,
          chips: chipRefs
        });
      });

      if (el.addRound) el.addRound.disabled = state.rounds.length >= MAX_ROUNDS;
      syncNames();
    }

    /* 이름을 바꾸면 결제자 목록·참석자 칩·표에 바로 반영 */
    function syncNames() {
      roundRefs.forEach(function (ref, ri) {
        var r = state.rounds[ri];
        if (!r || !ref) return;
        ref.chips.forEach(function (chip, pi) {
          var label = state.people[pi] || "참석자 " + (pi + 1);
          if (chip.textContent !== label) chip.textContent = label;
        });
        var select = ref.payerSelect;
        if (!select) return;
        var current = String(r.payer);
        while (select.firstChild) select.removeChild(select.firstChild);
        state.people.forEach(function (name, pi) {
          var opt = document.createElement("option");
          opt.value = String(pi);
          opt.textContent = (name || "참석자 " + (pi + 1)) + (r.parts[pi] ? "" : " (불참)");
          select.appendChild(opt);
        });
        select.value = current;
        if (!select.value) {
          select.value = "0";
          r.payer = 0;
        }
      });
    }

    /* ---------- 결과 ---------- */

    function clearChildren(node) {
      while (node && node.firstChild) node.removeChild(node.firstChild);
    }

    function paint() {
      var res = D.compute(state.people, state.rounds, state.unit);
      var mode = state.mode;
      var transfers = mode === "direct" ? res.direct : res.netted;

      if (res.totalAmount > 0) {
        UI.countTo(el.value, res.perHead, D.won, 360);
        setText(
          el.sub,
          "총 " +
            D.won(res.totalAmount) +
            " · " +
            res.people.length +
            "명 · " +
            res.activeRounds +
            "차수 정산"
        );
      } else {
        setText(el.value, "—");
        setText(el.sub, "참석자와 결제액을 넣으면 정산이 시작됩니다.");
      }

      setText(el.total, res.totalAmount > 0 ? D.won(res.totalAmount) : "—");
      setText(el.count, res.people.length + "명");
      setText(
        el.max,
        res.maxSpender && res.maxSpender.paid > 0
          ? res.maxSpender.name + " " + D.won(res.maxSpender.paid)
          : "—"
      );

      var sendTotal = transfers.reduce(function (a, t) {
        return a + t.amount;
      }, 0);
      setText(el.send, transfers.length ? D.won(sendTotal) : "—");

      /* 송금 목록 */
      if (el.transfers) {
        clearChildren(el.transfers);
        transfers.forEach(function (t) {
          var row = document.createElement("div");
          row.className = "result-row";
          var dt = document.createElement("dt");
          dt.textContent = t.from + " → " + t.to;
          var dd = document.createElement("dd");
          dd.textContent = D.won(t.amount);
          row.appendChild(dt);
          row.appendChild(dd);
          el.transfers.appendChild(row);
        });
      }

      if (el.note) {
        if (res.totalAmount <= 0) {
          el.note.textContent = "금액을 넣으면 각자 보낼 돈이 여기에 나옵니다.";
        } else if (!transfers.length) {
          el.note.textContent = "보낼 돈이 없습니다. 각자 결제한 금액이 부담액과 같습니다.";
        } else if (mode === "direct") {
          el.note.textContent =
            "결제자에게 각자 보내는 방식입니다. 차수마다 받는 사람이 다를 수 있습니다.";
        } else {
          el.note.textContent =
            "서로 주고받을 돈을 상계한 결과입니다. " + transfers.length + "건만 보내면 정산이 끝납니다.";
        }
      }

      /* 경고 */
      if (el.warn) {
        var warn = res.warnings.length ? res.warnings.join(" ") : "";
        el.warn.hidden = !warn;
        if (warn && el.warnText) el.warnText.textContent = warn;
      }

      /* 1인별 표 */
      if (el.table) {
        var tbody = el.table.querySelector("tbody");
        if (tbody) {
          clearChildren(tbody);
          res.balances.forEach(function (b) {
            var tr = document.createElement("tr");
            var th = document.createElement("th");
            th.scope = "row";
            th.textContent = b.name;
            var td1 = document.createElement("td");
            td1.textContent = D.won(b.paid);
            var td2 = document.createElement("td");
            td2.textContent = D.won(b.owed);
            var td3 = document.createElement("td");
            if (b.net > 0) td3.textContent = "+" + D.won(b.net) + " (받을 돈)";
            else if (b.net < 0) td3.textContent = "−" + D.won(-b.net) + " (보낼 돈)";
            else td3.textContent = "0원";
            if (b.net > 0) td3.className = "is-best";
            tr.appendChild(th);
            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);
            tbody.appendChild(tr);
          });
        }
      }

      /* 차수별 표 */
      if (el.roundTable) {
        var rbody = el.roundTable.querySelector("tbody");
        if (rbody) {
          clearChildren(rbody);
          res.rounds.forEach(function (r) {
            var tr = document.createElement("tr");
            var th = document.createElement("th");
            th.scope = "row";
            th.textContent = r.label;
            var cells = [
              r.amount > 0 ? D.won(r.amount) : "—",
              r.count ? r.payerName : "—",
              r.count ? r.count + "명" : "참석자 없음",
              r.count > 1 ? D.won(r.share) : r.count === 1 ? "—" : "—",
              r.count ? D.won(r.payerShare) : "—"
            ];
            tr.appendChild(th);
            cells.forEach(function (value, i) {
              var td = document.createElement("td");
              td.setAttribute("data-label", ["결제액", "결제자", "참석 인원", "1인 부담", "결제자 부담"][i]);
              td.textContent = value;
              tr.appendChild(td);
            });
            rbody.appendChild(tr);
          });
        }
      }

      /* 카톡 문구 */
      if (el.text) {
        var now = new Date();
        var date = now.getMonth() + 1 + "/" + now.getDate();
        el.text.value = D.kakaoText(res, { title: "모임 정산", date: date, mode: mode });
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    /* ---------- 이벤트 ---------- */

    if (el.addPerson) el.addPerson.addEventListener("click", addPerson);

    if (el.addRound) {
      el.addRound.addEventListener("click", function () {
        if (state.rounds.length >= MAX_ROUNDS) return;
        state.rounds.push({
          amount: 0,
          payer: 0,
          parts: state.people.map(function () {
            return true;
          })
        });
        renderRounds();
        paint();
      });
    }

    if (el.unit) {
      Array.prototype.forEach.call(el.unit.querySelectorAll("button[data-unit]"), function (btn) {
        btn.addEventListener("click", function () {
          Array.prototype.forEach.call(el.unit.querySelectorAll("button[data-unit]"), function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          state.unit = Number(btn.getAttribute("data-unit")) || 1;
          paint();
        });
      });
    }

    if (el.mode) {
      UI.bindSegment(el.mode, function (value) {
        state.mode = value === "direct" ? "direct" : "net";
        paint();
      });
    }

    if (el.copy) {
      el.copy.setAttribute("data-label", el.copy.textContent);
      el.copy.addEventListener("click", function () {
        var text = el.text ? el.text.value : "";
        if (!text || !text.trim()) {
          flash(el.copy, "금액 먼저");
          return;
        }
        copyText(text).then(
          function () {
            flash(el.copy, "복사 완료 ✓");
            if (el.status) el.status.textContent = "정산 문구를 클립보드에 복사했습니다.";
          },
          function () {
            flash(el.copy, "복사 실패");
            if (el.status) el.status.textContent = "복사하지 못했습니다. 문구를 직접 선택해 복사해 주세요.";
          }
        );
      });
    }

    renderPeople();
    renderRounds();
    paint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
