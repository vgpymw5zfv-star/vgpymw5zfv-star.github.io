/* 우리집 전기세 · 누진제 — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Elec = window.DotoriElec;
  if (!UI || !Core || !Elec) return;

  function init() {
    var el = {
      modeGroup: document.querySelector('[data-segment="usage-mode"]'),
      contractGroup: document.querySelector('[data-segment="contract"]'),
      seasonGroup: document.querySelector('[data-segment="season"]'),
      superuser: document.getElementById("elec-superuser"),
      areaWrap: document.getElementById("elec-area-wrap"),
      kwhWrap: document.getElementById("elec-kwh-wrap"),
      billWrap: document.getElementById("elec-bill-wrap"),
      areaM2: document.getElementById("elec-area-m2"),
      areaPyeong: document.getElementById("elec-area-pyeong"),
      areaChipBar: document.querySelector("[data-area-bar]"),
      personsGroup: document.querySelector('[data-segment="persons"]'),
      usage: document.getElementById("elec-usage"),
      bill: document.getElementById("elec-bill"),
      watts: document.getElementById("elec-watts"),
      hours: document.getElementById("elec-hours"),
      days: document.getElementById("elec-days"),
      presetBar: document.querySelector("[data-preset-bar]"),
      modeNote: document.getElementById("elec-mode-note"),
      breakdown: document.getElementById("elec-breakdown"),
      gauge: document.getElementById("elec-gauge"),
      gaugeScale: document.getElementById("elec-gauge-scale"),
      resultNote: document.getElementById("elec-result-note"),
      warnings: document.getElementById("elec-warnings"),
      example: document.getElementById("elec-example-table"),
      exampleCaption: document.getElementById("elec-example-caption"),
      contractTable: document.getElementById("elec-contract-table"),
      clampNote: document.getElementById("elec-clamp-note")
    };
    if (!el.usage) return;

    var syncLock = false;

    function segValue(group, fallback) {
      return UI.segmentValue(group) || fallback;
    }

    function mode() {
      return segValue(el.modeGroup, "area");
    }

    function contract() {
      return segValue(el.contractGroup, "low");
    }

    function season() {
      return segValue(el.seasonGroup, "general");
    }

    function persons() {
      return Number(segValue(el.personsGroup, "1")) || 1;
    }

    function superuserOn() {
      return !!(el.superuser && el.superuser.checked);
    }

    function applyMode() {
      var m = mode();
      if (el.areaWrap) el.areaWrap.hidden = m !== "area";
      if (el.kwhWrap) el.kwhWrap.hidden = m !== "kwh";
      if (el.billWrap) el.billWrap.hidden = m !== "bill";
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
    guard(el.areaM2, 0, 500, "전용면적", "㎡");
    guard(el.areaPyeong, 0, 200, "평수", "평");
    guard(el.usage, 0, 100000, "사용량", "kWh");
    guard(el.bill, 0, 100000000, "청구 금액", "원");
    guard(el.watts, 0, 10000, "소비전력", "W");
    guard(el.hours, 0, 24, "하루 사용시간", "시간");
    guard(el.days, 0, 31, "월 사용일수", "일");

    /* 전용면적 ↔ 평수 연동 */
    function syncArea(from) {
      if (syncLock) return;
      syncLock = true;
      if (from === "m2" && el.areaM2 && el.areaPyeong) {
        var m2 = UI.toNumber(el.areaM2, 0);
        el.areaPyeong.value = m2 > 0 ? String(Math.round(Elec.m2ToPyeong(m2) * 10) / 10) : "";
      } else if (from === "pyeong" && el.areaM2 && el.areaPyeong) {
        var p = UI.toNumber(el.areaPyeong, 0);
        el.areaM2.value = p > 0 ? String(Math.round(Elec.pyeongToM2(p) * 10) / 10) : "";
      }
      syncLock = false;
    }

    function setSegment(group, value) {
      if (!group) return;
      UI.$$("button", group).forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-value") === String(value) ? "true" : "false");
      });
    }

    function render() {
      var result = Elec.compute({
        mode: mode(),
        areaM2: UI.toNumber(el.areaM2, 0),
        persons: persons(),
        usageKwh: UI.toNumber(el.usage, 0),
        billWon: UI.toNumber(el.bill, 0),
        contract: contract(),
        season: season(),
        superuser: superuserOn(),
        watts: UI.toNumber(el.watts, 0),
        hours: UI.toNumber(el.hours, 0),
        days: UI.toNumber(el.days, 0)
      });

      var priceLabel = result.contractLabel + " · " + result.seasonLabel;

      /* 입력 방식 안내 */
      if (el.modeNote) {
        var note = "";
        if (result.mode === "area") {
          if (result.estimatedKwh > 0) {
            var supply = "";
            Elec.AREA_PRESETS.forEach(function (ap) {
              if (ap.m2 === result.areaM2 && ap.pyeong.indexOf("평형") >= 0) {
                supply = " · 공급면적 기준 " + ap.pyeong;
              }
            });
            note =
              "전용면적 <b>" + Core.comma(result.areaM2) + "㎡ (전용 " + result.pyeong + "평" + supply +
              ")</b> · <b>" + result.persons + "인</b> 기준 참고 추정 사용량은 <b>" +
              Core.comma(result.estimatedKwh) +
              "kWh</b>입니다. 면적별 평균 추정치이니 정확한 금액은 고지서의 사용량(kWh)·청구액으로 확인하세요.";
          } else {
            note = "전용면적을 입력하면 면적·가구원 수 기준 참고 사용량과 예상 요금을 바로 계산합니다.";
          }
        } else if (result.mode === "bill") {
          note =
            "청구 금액 기준 사용량은 <b>" + Core.comma(result.baseKwh) + "kWh</b>입니다. " +
            priceLabel + " 기준으로 역산했습니다.";
        } else {
          note =
            "입력한 사용량의 예상 청구액은 <b>" + Core.won(result.before.total) + "</b>입니다. (" +
            priceLabel + " 기준)";
        }
        el.modeNote.innerHTML = '<span class="notice__icon" aria-hidden="true">i</span><span>' + note + "</span>";
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
      UI.setText("elec-extra-unit", Core.won(Math.round(result.extraUnit)) + " / kWh");
      UI.setText("elec-tier", result.beforeTier + "구간 → " + result.afterTier + "구간");
      UI.setText("elec-yearly", Core.won(result.yearlyExtra));
      UI.setText("elec-price-label", result.contractShort + " · " + result.seasonShort);

      /* 청구서 구성 */
      if (el.breakdown) {
        var b = result.after;
        var rows = [["기본요금", b.base], ["전력량요금", b.energy]];
        if (b.superuserKwh > 0) {
          rows.push(["슈퍼유저(1,000kWh 초과)", b.superuserAmount]);
        }
        rows = rows.concat([
          ["기후환경요금", b.climate],
          ["연료비조정요금", b.fuel],
          ["부가가치세", b.vat],
          ["전력산업기반기금", b.fund]
        ]);
        var html = rows
          .map(function (row) {
            return '<tr><th scope="row">' + row[0] + "</th><td>" + Core.won(row[1]) + "</td></tr>";
          })
          .join("");
        html +=
          '<tr><th scope="row" style="color:var(--navy);font-weight:700">합계</th>' +
          '<td style="color:var(--blue-dark);font-weight:700">' +
          Core.won(b.total) +
          "</td></tr>";
        el.breakdown.innerHTML = html;
      }

      if (el.resultNote) {
        el.resultNote.textContent =
          result.contractLabel + " · " + result.seasonLabel +
          " 기준 · 기본요금 + 전력량요금 + 기후환경요금 9원 + 연료비조정요금 5원 + 부가세 10% + 전력산업기반기금 2.7%";
      }

      /* 게이지 */
      if (el.gauge) {
        el.gauge.style.width = result.gaugePercent.toFixed(1) + "%";
        el.gauge.className = "gauge__fill" + (result.jumped ? " is-jump" : "");
      }
      if (el.gaugeScale) {
        el.gaugeScale.innerHTML =
          "<span>0</span><span>" + result.limits[0] + "kWh</span><span>" +
          result.limits[1] + "kWh</span><span>" + result.gaugeMax + "+</span>";
      }

      /* 경고 */
      if (el.warnings) {
        var warns = [];
        if (result.jumped) {
          warns.push(
            "누진 구간이 " + result.beforeTier + "구간에서 " + result.afterTier +
              "구간으로 넘어갑니다. 기본요금이 함께 올라 추가분 1kWh당 " +
              Core.won(Math.round(result.extraUnit)) + "이 부과됩니다."
          );
        }
        if (result.addKwh > 0 && !result.jumped) {
          warns.push(
            "같은 구간 안에서는 1kWh당 약 " + Core.won(Math.round(result.marginalUnit)) + "이 추가됩니다."
          );
        }
        if (result.mode === "bill" && !result.exactMatch) {
          warns.push(
            "입력한 금액과 정확히 일치하는 사용량이 없어 가장 가까운 " +
              Core.comma(result.baseKwh) + "kWh로 계산했습니다(차이 " +
              Core.won(Math.abs(result.billDiffNotice)) + ")."
          );
        }
        if (result.mode === "area" && result.estimated) {
          warns.push(
            "면적·가구원 수 기준 추정치는 냉난방 사용 시간, 재택 여부, 가전 보유량에 따라 크게 달라집니다. 고지서가 있다면 사용량(kWh) 탭이 가장 정확합니다."
          );
        }
        if (result.mode === "area" && result.areaM2 >= 59 && result.contract === "low") {
          warns.push(
            "59㎡ 이상 아파트는 대부분 주택용 고압 계약입니다. 청구서의 계약 종별을 확인하고 고압으로 바꾸면 요금이 더 낮게 나옵니다."
          );
        }
        el.warnings.innerHTML = warns
          .map(function (w) {
            return (
              '<div class="notice notice--warn"><span class="notice__icon" aria-hidden="true">!</span><span>' +
              w + "</span></div>"
            );
          })
          .join("");
      }

      renderExamples(result);
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    /* 면적 칩 */
    if (el.areaChipBar) {
      UI.$$("button[data-area]", el.areaChipBar).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var m2 = Number(btn.getAttribute("data-area"));
          var p = Number(btn.getAttribute("data-persons")) || 1;
          UI.$$("button[data-area]", el.areaChipBar).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          if (el.areaM2) el.areaM2.value = String(m2);
          setSegment(el.personsGroup, p);
          syncArea("m2");
          /* 아파트 대표 면적은 주택용 고압, 원룸·소형은 저압이 대부분 → 자연스럽게 맞춰 준다 */
          if (m2 >= 59) {
            setSegment(el.contractGroup, "high");
          } else if (m2 <= 40) {
            setSegment(el.contractGroup, "low");
          }
          setSegment(el.modeGroup, "area");
          applyMode();
        });
      });
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
            if (el.watts) el.watts.focus();
            return;
          }
          el.watts.value = String(preset.watts);
          el.hours.value = String(preset.hours);
          el.days.value = String(preset.days);
          render();
        });
      });
    }

    /* 예시 표 — 현재 계약 종별·계절 기준 */
    function renderExamples(result) {
      var r = result || Elec.compute({ mode: "kwh", contract: contract(), season: season(), superuser: superuserOn() });
      if (el.example) {
        var bases = [150, 250, 350, 450];
        el.example.innerHTML = bases
          .map(function (baseKwh) {
            var cells = [1, 2, 4].map(function (hours) {
              var rr = Elec.compute({
                mode: "kwh",
                usageKwh: baseKwh,
                contract: r.contract,
                season: r.season,
                superuser: r.superuser,
                watts: 1800,
                hours: hours,
                days: 30
              });
              return "<td>" + Core.won(rr.extraBill) + "</td>";
            });
            return '<tr><th scope="row">' + baseKwh + "kWh</th>" + cells.join("") + "</tr>";
          })
          .join("");
      }
      if (el.exampleCaption) {
        el.exampleCaption.textContent =
          "2026년 11월 · " + r.contractLabel + " · " + r.seasonLabel +
          " 기준입니다. 기본요금 구간 점프까지 반영했습니다.";
      }

      if (el.contractTable) {
        el.contractTable.innerHTML = [200, 300, 400, 500]
          .map(function (kwh) {
            var low = Elec.bill(kwh, { contract: "low", season: r.season, superuser: r.superuser });
            var high = Elec.bill(kwh, { contract: "high", season: r.season, superuser: r.superuser });
            var diff = low.total - high.total;
            return (
              '<tr><th scope="row">' + kwh + "kWh</th><td>" + Core.won(low.total) +
              "</td><td>" + Core.won(high.total) +
              '</td><td class="is-best">' + Core.won(diff) + "</td></tr>"
            );
          })
          .join("");
      }
    }

    /* 이벤트 연결 */
    UI.bindSegment(el.modeGroup, applyMode);
    UI.bindSegment(el.contractGroup, render);
    UI.bindSegment(el.personsGroup, render);
    UI.bindSegment(el.seasonGroup, function (value) {
      /* 하계는 슈퍼유저(1,000kWh 초과)가 자동 적용된다 */
      if (el.superuser) el.superuser.checked = value === "summer" ? true : false;
      render();
    });

    if (el.superuser) el.superuser.addEventListener("change", render);

    if (el.areaM2) {
      el.areaM2.addEventListener("input", function () {
        syncArea("m2");
        render();
      });
      el.areaM2.addEventListener("change", function () {
        syncArea("m2");
        render();
      });
    }
    if (el.areaPyeong) {
      el.areaPyeong.addEventListener("input", function () {
        syncArea("pyeong");
        render();
      });
      el.areaPyeong.addEventListener("change", function () {
        syncArea("pyeong");
        render();
      });
    }

    [el.usage, el.bill, el.watts, el.hours, el.days]
      .filter(Boolean)
      .forEach(function (node) {
        node.addEventListener("change", render);
      });
    UI.onInput([el.usage, el.bill, el.watts, el.hours, el.days], render, 90);

    /* 초기 상태: 슈퍼유저는 계절 선택에 맞춘다 */
    if (el.superuser && season() === "summer") el.superuser.checked = true;
    syncArea("m2");
    applyMode();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
