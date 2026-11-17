/* 원룸 전기세 누진제 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Elec = window.DotoriElec;
  if (!UI || !Core || !Elec) return;

  function init() {
    var el = {
      modeGroup: document.querySelector('[data-segment="usage-mode"]'),
      kwhWrap: document.getElementById("elec-kwh-wrap"),
      billWrap: document.getElementById("elec-bill-wrap"),
      usage: document.getElementById("elec-usage"),
      bill: document.getElementById("elec-bill"),
      watts: document.getElementById("elec-watts"),
      hours: document.getElementById("elec-hours"),
      days: document.getElementById("elec-days"),
      presetBar: document.querySelector("[data-preset-bar]"),
      modeNote: document.getElementById("elec-mode-note"),
      breakdown: document.getElementById("elec-breakdown"),
      gauge: document.getElementById("elec-gauge"),
      warnings: document.getElementById("elec-warnings"),
      example: document.getElementById("elec-example-table"),
      clampNote: document.getElementById("elec-clamp-note")
    };
    if (!el.usage) return;

    function mode() {
      return UI.segmentValue(el.modeGroup) || "kwh";
    }

    function applyMode() {
      var bill = mode() === "bill";
      el.kwhWrap.hidden = bill;
      el.billWrap.hidden = !bill;
      render();
    }

    /* 범위를 벗어난 입력을 바로잡고 안내 문구를 보여 준다 */
    function guard(input, min, max, label, unit) {
      if (!input) return;
      function check() {
        if (input.value === "") {
          if (el.clampNote) el.clampNote.hidden = true;
          return;
        }
        var v = Number(input.value);
        if (!isFinite(v)) {
          input.value = "";
          return;
        }
        if (v < min || v > max) {
          input.value = String(v < min ? min : max);
          if (el.clampNote) {
            el.clampNote.hidden = false;
            el.clampNote.textContent =
              label + "은(는) " + min + "~" + max + unit + " 범위로 입력해 주세요. " +
              (v < min ? min : max) + unit + "으로 조정했습니다.";
          }
        } else if (el.clampNote) {
          el.clampNote.hidden = true;
        }
      }
      input.addEventListener("change", check);
      input.addEventListener("blur", check);
    }
    guard(el.usage, 0, 100000, "사용량", "kWh");
    guard(el.bill, 0, 100000000, "청구 금액", "원");
    guard(el.watts, 0, 10000, "소비전력", "W");
    guard(el.hours, 0, 24, "하루 사용시간", "시간");
    guard(el.days, 0, 31, "월 사용일수", "일");

    function render() {
      var result = Elec.compute({
        mode: mode(),
        usageKwh: UI.toNumber(el.usage, 0),
        billWon: UI.toNumber(el.bill, 0),
        watts: UI.toNumber(el.watts, 0),
        hours: UI.toNumber(el.hours, 0),
        days: UI.toNumber(el.days, 0)
      });

      /* 입력 방식 안내 */
      if (mode() === "bill") {
        if (el.modeNote) {
          el.modeNote.innerHTML =
            '<span class="notice__icon" aria-hidden="true">i</span><span>청구 금액 기준 사용량은 <b>' +
            Core.comma(result.baseKwh) +
            "kWh</b>입니다. 예상 청구액 " +
            Core.won(result.before.total) +
            "</span>";
        }
      } else if (el.modeNote) {
        el.modeNote.innerHTML =
          '<span class="notice__icon" aria-hidden="true">i</span><span>입력한 사용량의 예상 청구액은 <b>' +
          Core.won(result.before.total) +
          "</b>입니다.</span>";
      }

      UI.countTo("elec-extra", result.extraBill, Core.comma);
      UI.setText(
        "elec-sub",
        "월 " + Core.comma(result.addKwh) + "kWh 추가 · " +
          (result.jumped
            ? result.beforeTier + "구간 → " + result.afterTier + "구간 점프"
            : result.afterTier + "구간 유지")
      );
      UI.setText("elec-add-kwh", Core.comma(result.addKwh) + "kWh");
      UI.setText("elec-before-total", Core.won(result.before.total));
      UI.setText("elec-after-total", Core.won(result.after.total));
      UI.setText(
        "elec-extra-unit",
        Core.won(Math.round(result.extraUnit)) + " / kWh"
      );
      UI.setText(
        "elec-tier",
        result.beforeTier + "구간 → " + result.afterTier + "구간"
      );
      UI.setText("elec-yearly", Core.won(result.yearlyExtra));

      /* 청구서 구성 */
      if (el.breakdown) {
        var b = result.after;
        var rows = [
          ["기본요금", b.base],
          ["전력량요금", b.energy],
          ["기후환경요금", b.climate],
          ["연료비조정요금", b.fuel],
          ["부가가치세", b.vat],
          ["전력산업기반기금", b.fund]
        ];
        var html = rows
          .map(function (row) {
            return (
              '<tr><th scope="row">' + row[0] + "</th><td>" +
              Core.won(row[1]) + "</td></tr>"
            );
          })
          .join("");
        html +=
          '<tr><th scope="row" style="color:var(--navy);font-weight:700">합계</th>' +
          '<td style="color:var(--blue-dark);font-weight:700">' +
          Core.won(b.total) +
          "</td></tr>";
        el.breakdown.innerHTML = html;
      }

      /* 게이지 */
      if (el.gauge) {
        el.gauge.style.width = result.gaugePercent.toFixed(1) + "%";
        el.gauge.className = "gauge__fill" + (result.jumped ? " is-jump" : "");
      }

      /* 경고 */
      if (el.warnings) {
        var warns = [];
        if (result.jumped) {
          warns.push(
            "누진 구간이 " + result.beforeTier + "구간에서 " + result.afterTier +
              "구간으로 넘어갑니다. 기본요금이 함께 올라 추가분 1kWh당 " +
              Core.won(Math.round(result.extraUnit)) +
              "이 부과됩니다."
          );
        }
        if (result.addKwh > 0 && !result.jumped) {
          warns.push(
            "같은 구간 안에서는 1kWh당 약 " +
              Core.won(Math.round(result.marginalUnit)) +
              "이 추가됩니다."
          );
        }
        if (mode() === "bill" && !result.exactMatch) {
          warns.push(
            "입력한 금액과 정확히 일치하는 사용량이 없어 가장 가까운 " +
              Core.comma(result.baseKwh) +
              "kWh로 계산했습니다(차이 " +
              Core.won(Math.abs(result.billDiffNotice)) +
              ")."
          );
        }
        el.warnings.innerHTML = warns
          .map(function (w) {
            return (
              '<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">!</span><span>' +
              w +
              "</span></div>"
            );
          })
          .join("");
      }

      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    /* 프리셋 */
    if (el.presetBar) {
      UI.$$("button[data-preset]", el.presetBar).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-preset");
          var preset = null;
          Elec.PRESETS.forEach(function (p) {
            if (p.id === id) preset = p;
          });
          UI.$$("button[data-preset]", el.presetBar).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          if (!preset || preset.id === "custom") {
            el.watts.focus();
            return;
          }
          el.watts.value = String(preset.watts);
          el.hours.value = String(preset.hours);
          el.days.value = String(preset.days);
          render();
        });
      });
    }

    /* 예시 표 */
    function renderExamples() {
      if (!el.example) return;
      var bases = [150, 200, 300, 450];
      el.example.innerHTML = bases
        .map(function (baseKwh) {
          var cells = [1, 2, 4].map(function (hours) {
            var r = Elec.compute({
              mode: "kwh",
              usageKwh: baseKwh,
              watts: 1500,
              hours: hours,
              days: 30
            });
            return "<td>" + Core.won(r.extraBill) + "</td>";
          });
          return (
            '<tr><th scope="row">' + baseKwh + "kWh</th>" + cells.join("") + "</tr>"
          );
        })
        .join("");
    }

    UI.bindSegment(el.modeGroup, applyMode);
    [el.usage, el.bill, el.watts, el.hours, el.days]
      .filter(Boolean)
      .forEach(function (node) {
        node.addEventListener("change", render);
      });
    UI.onInput([el.usage, el.bill, el.watts, el.hours, el.days], render, 90);

    renderExamples();
    applyMode();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
