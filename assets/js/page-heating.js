/* 겨울 난방비 계산기 — 도시가스 · 지역난방 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var H = window.DotoriHeating;
  if (!UI || !Core || !H) return;

  function init() {
    var el = {
      typeGroup: document.querySelector('[data-segment="type"]'),
      regionBar: document.querySelector("[data-region-bar]"),
      gasRegionGroup: document.getElementById("heat-gas-region-group"),
      dhPlanGroup: document.getElementById("heat-dh-plan-group"),
      planGroup: document.querySelector('[data-segment="plan"]'),
      planHelp: document.getElementById("heat-plan-help"),
      regionHelp: document.getElementById("heat-region-help"),
      customWrap: document.getElementById("heat-custom-wrap"),
      customBase: document.getElementById("heat-custom-base"),
      customCooking: document.getElementById("heat-custom-cooking"),
      customHeating: document.getElementById("heat-custom-heating"),
      gasModeGroup: document.querySelector('[data-segment="mode-gas"]'),
      dhModeGroup: document.querySelector('[data-segment="mode-dh"]'),
      mjWrap: document.getElementById("heat-mj-wrap"),
      m3Wrap: document.getElementById("heat-m3-wrap"),
      mcalWrap: document.getElementById("heat-mcal-wrap"),
      kwhWrap: document.getElementById("heat-kwh-wrap"),
      areaWrap: document.getElementById("heat-area-wrap"),
      mj: document.getElementById("heat-mj"),
      m3: document.getElementById("heat-m3"),
      coef: document.getElementById("heat-coef"),
      heat: document.getElementById("heat-heat"),
      mcal: document.getElementById("heat-mcal"),
      kwh: document.getElementById("heat-kwh"),
      areaBar: document.querySelector("[data-area-bar]"),
      areaM2: document.getElementById("heat-area-m2"),
      areaPyeong: document.getElementById("heat-area-pyeong"),
      areaLabel: document.getElementById("heat-area-label"),
      areaHelp: document.getElementById("heat-area-help"),
      habitGroup: document.querySelector('[data-segment="habit"]'),
      modeNote: document.getElementById("heat-mode-note"),
      clampNote: document.getElementById("heat-clamp-note"),
      breakdown: document.getElementById("heat-breakdown"),
      warnings: document.getElementById("heat-warnings"),
      savingText: document.getElementById("heat-saving-text"),
      gauge: document.getElementById("heat-gauge"),
      compareHead: document.getElementById("heat-compare-head"),
      compareBody: document.getElementById("heat-compare-table"),
      compareCaption: document.getElementById("heat-compare-caption"),
      compareTableCaption: document.getElementById("heat-compare-caption-table")
    };
    if (!el.mj) return;

    var CURRENT_MONTH = new Date().getMonth() + 1;
    var syncLock = false;

    /* ---------------- 상태 읽기 ---------------- */

    function type() {
      return UI.segmentValue(el.typeGroup) || "gas";
    }
    function gasMode() {
      return UI.segmentValue(el.gasModeGroup) || "mj";
    }
    function dhMode() {
      return UI.segmentValue(el.dhModeGroup) || "mcal";
    }
    function mode() {
      return type() === "district" ? dhMode() : gasMode();
    }
    function plan() {
      return UI.segmentValue(el.planGroup) || "single";
    }
    function habit() {
      return UI.segmentValue(el.habitGroup) || "normal";
    }
    function region() {
      if (!el.regionBar) return "seoul";
      var pressed = el.regionBar.querySelector('button[aria-pressed="true"]');
      return pressed ? pressed.getAttribute("data-region") : "seoul";
    }
    function month() {
      /* 지역난방 계절별 요금제는 ‘이번 달’ 절기를 쓴다 */
      return CURRENT_MONTH;
    }

    function setSegment(group, value) {
      if (!group) return;
      UI.$$("button", group).forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-value") === String(value) ? "true" : "false");
      });
    }

    /* 숫자 표시: 정수는 그대로, 소수는 최대 1자리 */
    function numLabel(v, digits) {
      var d = typeof digits === "number" ? digits : 1;
      var f = Math.pow(10, d);
      var r = Math.round(v * f) / f;
      return r.toLocaleString("ko-KR");
    }

    /* ---------------- 표시 전환 ---------------- */

    function applyVisibility() {
      var t = type();
      var m = mode();
      var gas = t === "gas";
      if (el.gasRegionGroup) el.gasRegionGroup.hidden = !gas;
      if (el.dhPlanGroup) el.dhPlanGroup.hidden = gas;
      if (el.gasModeGroup) el.gasModeGroup.hidden = !gas;
      if (el.dhModeGroup) el.dhModeGroup.hidden = gas;
      if (el.mjWrap) el.mjWrap.hidden = !(gas && m === "mj");
      if (el.m3Wrap) el.m3Wrap.hidden = !(gas && m === "m3");
      if (el.mcalWrap) el.mcalWrap.hidden = !(!gas && m === "mcal");
      if (el.kwhWrap) el.kwhWrap.hidden = !(!gas && m === "kwh");
      if (el.areaWrap) el.areaWrap.hidden = m !== "area";

      if (el.areaLabel) el.areaLabel.textContent = gas ? "전용면적" : "계약면적";
      if (el.areaHelp) {
        el.areaHelp.textContent = gas
          ? "1평 = 3.3058㎡(전용면적 기준). 부동산의 ‘34평형’은 공급면적 기준이라 전용면적은 84㎡ 안팎입니다."
          : "지역난방 기본요금은 계약면적(전용면적 + 발코니 확장 + 공용 열사용 면적) 기준입니다. 고지서의 계약면적을 넣으면 가장 정확합니다.";
      }
    }

    function regionHelpText(r) {
      if (r.custom) {
        return "고지서(또는 공급사 홈페이지)의 주택용 기본요금과 취사·난방 단가를 원/MJ로 넣으세요. 부가세는 별도로 붙습니다.";
      }
      var out = r.supplier + " · 기본요금 " + Core.comma(r.base) + "원 · ";
      if (r.splitApplies) {
        out += "취사 " + r.cooking.toFixed(4) + "원 · 난방 " + r.heating.toFixed(4) + "원/MJ";
      } else {
        out += "취사·난방 " + r.cooking.toFixed(4) + "원/MJ";
      }
      return out + " (2026년 11월, 부가세 별도)";
    }

    /* ---------------- 면적 ↔ 평수 ---------------- */

    function syncArea(from) {
      if (syncLock) return;
      syncLock = true;
      if (from === "m2" && el.areaM2 && el.areaPyeong) {
        var m2 = UI.toNumber(el.areaM2, 0);
        el.areaPyeong.value = m2 > 0 ? String(Math.round(H.m2ToPyeong(m2) * 10) / 10) : "";
      } else if (from === "pyeong" && el.areaM2 && el.areaPyeong) {
        var p = UI.toNumber(el.areaPyeong, 0);
        el.areaM2.value = p > 0 ? String(Math.round(H.pyeongToM2(p) * 10) / 10) : "";
      }
      syncLock = false;
    }

    /* ---------------- 범위 보정 ---------------- */

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
    guard(el.mj, 0, 200000, "사용열량", "MJ");
    guard(el.m3, 0, 20000, "검침량", "㎥");
    guard(el.coef, 0.5, 1.5, "온압보정계수", "");
    guard(el.heat, 41, 44.4, "평균열량", "MJ/㎥");
    guard(el.mcal, 0, 200000, "사용열량", "Mcal");
    guard(el.kwh, 0, 200000, "열량", "kWh");
    guard(el.areaM2, 0, 500, "면적", "㎡");
    guard(el.areaPyeong, 0, 200, "평수", "평");

    /* ---------------- 렌더 ---------------- */

    function render() {
      var r = H.compute({
        type: type(),
        region: region(),
        customBase: UI.toNumber(el.customBase, 1250),
        customCooking: UI.toNumber(el.customCooking, 22.5268),
        customHeating: UI.toNumber(el.customHeating, 22.5268),
        mode: mode(),
        usageMj: UI.toNumber(el.mj, 0),
        usageM3: UI.toNumber(el.m3, 0),
        coef: UI.toNumber(el.coef, 0.9945),
        avgHeat: UI.toNumber(el.heat, 42.5),
        usageMcal: UI.toNumber(el.mcal, 0),
        usageKwh: UI.toNumber(el.kwh, 0),
        areaM2: UI.toNumber(el.areaM2, 0),
        habit: habit(),
        plan: plan(),
        month: month()
      });

      if (el.regionHelp) el.regionHelp.textContent = regionHelpText(H.gasConfig({ region: region() }));

      /* 상단 결과 카드 */
      UI.countTo("heat-total", r.total, Core.comma);

      var sub;
      if (r.type === "gas") {
        sub = "도시가스 " + numLabel(r.mj, 1) + "MJ · " + r.regionLabel;
        if (r.mode === "m3" && !r.estimated) {
          sub = "검침 " + numLabel(UI.toNumber(el.m3, 0), 1) + "㎥ → " + numLabel(r.mj, 1) + "MJ · " + r.regionLabel;
        }
      } else {
        sub = "지역난방 " + numLabel(r.mcal, 0) + "Mcal (" + numLabel(r.kwh, 0) + "kWh) · " + (r.plan === "single" ? "단일요금" : "계절별");
      }
      if (r.estimated) {
        sub = r.type === "gas" ? "도시가스 추정 " : "지역난방 추정 ";
        sub += r.type === "gas" ? numLabel(r.mj, 0) + "MJ · " : numLabel(r.mcal, 0) + "Mcal · ";
        sub += r.areaM2 > 0 ? numLabel(r.areaM2, 0) + "㎡ · " + r.habitLabel : r.habitLabel;
      }
      UI.setText("heat-sub", sub);

      UI.setText(
        "heat-price-label",
        r.type === "gas"
          ? r.regionLabel + " · 도시가스"
          : "지역난방 · " + (r.plan === "single" ? "단일요금" : H.seasonLabel(r.seasonKey))
      );

      UI.setText("heat-base", Core.won(r.base));
      UI.setText("heat-energy", Core.won(r.energy));
      UI.setText("heat-vat", Core.won(r.vat));
      UI.setText("heat-dt-unit", r.unitName === "MJ" ? "1MJ당 평균" : "1Mcal당 평균");
      UI.setText(
        "heat-unit",
        r.unitName === "MJ"
          ? numLabel(r.unitPrice, 1) + "원 / MJ"
          : numLabel(r.unitPrice, 1) + "원 / Mcal"
      );
      UI.setText("heat-winter", Core.won(r.winterTotal));
      UI.setText("heat-saving", Core.won(r.savingAmount));

      /* 결과 기준 문구 */
      var note;
      if (r.type === "gas") {
        note = r.regionLabel + " 주택용 · 기본요금 " + Core.comma(r.base) + "원";
        if (r.splitApplies) {
          note += " · 취사 516MJ까지 " + r.cookingRate.toFixed(4) + "원/MJ · 초과분 " + r.heatingRate.toFixed(4) + "원/MJ";
        } else {
          note += " · 사용열량 × " + r.cookingRate.toFixed(4) + "원/MJ";
        }
        note += " + 부가세 10% (10원 미만 절사)";
      } else {
        note =
          "한국지역난방공사 " + (r.plan === "single" ? "단일요금" : "계절별 차등요금 · " + H.seasonLabel(r.seasonKey)) +
          " · 기본요금 " + r.areaM2.toFixed(0) + "㎡ × 52.40원 + " +
          numLabel(r.mcal, 0) + "Mcal × " + r.rate.toFixed(2) + "원 + 부가세 10%";
      }
      note += " · 겨울 4개월은 이번 달 사용량이 이어진다고 가정";
      UI.setText("heat-result-note", note);

      /* 입력 방식 안내 */
      if (el.modeNote) {
        var msg;
        if (r.estimated) {
          msg =
            "<b>" + numLabel(r.areaM2, 0) + "㎡ · " + r.habitLabel + "</b> 기준 겨울철 월 사용량을 <b>" +
            (r.type === "gas" ? numLabel(r.mj, 0) + "MJ" : numLabel(r.mcal, 0) + "Mcal") +
            "</b>로 어림했습니다. 면적별 평균 추정치이니 고지서의 " +
            (r.type === "gas" ? "사용열량(MJ)·검침량(㎥)" : "사용열량(Mcal)") +
            "를 넣으면 더 정확합니다.";
        } else if (r.type === "gas" && r.mode === "m3") {
          msg =
            "검침량 <b>" + numLabel(UI.toNumber(el.m3, 0), 1) + "㎥</b> × 보정계수 <b>" +
            UI.toNumber(el.coef, 0.9945).toFixed(4) + "</b> × 평균열량 <b>" +
            UI.toNumber(el.heat, 42.5).toFixed(2) + "MJ/㎥</b> = 사용열량 <b>" +
            numLabel(r.mj, 1) + "MJ</b>입니다.";
        } else if (r.type === "district" && r.mode === "kwh") {
          msg =
            "열량 <b>" + numLabel(UI.toNumber(el.kwh, 0), 0) + "kWh</b>는 <b>" +
            numLabel(r.mcal, 0) + "Mcal</b>입니다 (1kWh = 0.86Mcal).";
        } else if (r.type === "gas") {
          msg =
            "입력한 사용열량의 예상 난방비는 <b>" + Core.won(r.total) + "</b>입니다. (" +
            r.regionLabel + " 주택용 기준)";
        } else {
          msg =
            "입력한 사용열량의 예상 난방비는 <b>" + Core.won(r.total) + "</b>입니다. (지역난방 " +
            (r.plan === "single" ? "단일요금" : H.seasonLabel(r.seasonKey)) + " 기준)";
        }
        el.modeNote.innerHTML = '<span class="notice__icon" aria-hidden="true">i</span><span>' + msg + "</span>";
      }

      /* 청구서 구성 */
      if (el.breakdown) {
        var rows = [];
        if (r.type === "gas") {
          rows.push(["기본요금", Core.won(r.base)]);
          (r.parts || []).forEach(function (p) {
            rows.push([
              p.label + " · " + numLabel(p.mj, 1) + "MJ × " + p.rate.toFixed(4) + "원",
              Core.won(p.amount)
            ]);
          });
          if (!r.parts || !r.parts.length) rows.push(["사용요금 (사용열량 0)", Core.won(0)]);
          rows.push(["소계 (부가세 별도)", Core.won(r.subtotal)]);
          rows.push(["부가가치세 10%", Core.won(r.vat)]);
        } else {
          rows.push([
            "기본요금 · " + numLabel(r.areaM2, 0) + "㎡ × 52.40원",
            Core.won(r.base)
          ]);
          rows.push([
            "사용요금 · " + numLabel(r.mcal, 0) + "Mcal × " + r.rate.toFixed(2) + "원",
            Core.won(r.energy)
          ]);
          rows.push(["소계 (부가세 별도)", Core.won(r.subtotal)]);
          rows.push(["부가가치세 10%", Core.won(r.vat)]);
        }
        var html = rows
          .map(function (row) {
            return '<tr><th scope="row">' + row[0] + "</th><td>" + row[1] + "</td></tr>";
          })
          .join("");
        html +=
          '<tr><th scope="row" style="color:var(--navy);font-weight:700">합계</th>' +
          '<td style="color:var(--blue-dark);font-weight:700">' + Core.won(r.total) + "</td></tr>";
        el.breakdown.innerHTML = html;
      }

      /* 절약 팁 */
      if (el.savingText) {
        el.savingText.innerHTML =
          "실내온도를 1℃ 낮추면 난방비가 <b>약 " + r.savingPct + "%</b> 줄어듭니다. 이번 달 <b>" +
          Core.won(r.savingAmount) + "</b>, 겨울 4개월(11~2월)이면 <b>" +
          Core.won(r.savingWinter) + "</b>입니다.";
      }
      if (el.gauge) el.gauge.style.width = r.total > 0 ? r.savingPct + "%" : "0%";

      /* 경고·안내 */
      if (el.warnings) {
        var warns = [];
        if (r.estimated) {
          warns.push(
            "면적·난방 습관 기준 추정치는 기온, 재택 여부, 창호 단열, 보일러 효율에 따라 크게 달라집니다. 같은 84㎡라도 2~3배 차이가 나기도 합니다."
          );
        }
        if (r.type === "gas" && r.mode === "m3") {
          warns.push(
            "온압보정계수와 평균열량은 지역·월별로 조금씩 다릅니다. 고지서의 ‘사용열량(MJ)’을 그대로 넣는 쪽이 가장 정확합니다."
          );
        }
        if (r.type === "gas" && r.splitApplies) {
          warns.push(
            "이 지역은 취사·난방 단가가 달라 월 516MJ까지 취사 단가, 초과분은 난방 단가를 적용했습니다(취사·난방 겸용 세대 기준)."
          );
        }
        if (r.type === "gas" && r.custom) {
          warns.push("직접 입력 모드입니다. 공급사 요금표의 주택용 단가(부가세 별도, 원/MJ)를 넣었는지 확인하세요.");
        }
        if (r.type === "district") {
          warns.push(
            "지역난방 요금제(단일·계절별)는 단지 단위로 정해집니다. 관리비 고지서의 단가란을 보거나 관리사무소에 확인하세요. 공용 배분·배관 손실이 더해지면 고지서가 조금 더 나옵니다."
          );
        }
        if (r.total === 0) {
          warns.push("사용량이 0이면 기본요금만 청구됩니다. 지역난방은 면적을, 도시가스는 기본요금을 확인하세요.");
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

      renderCompare(r);
      if (window.DotoriNotifyResize) window.DotoriNotifyResize();
    }

    /* 지역별·요금제별 비교표 */
    function renderCompare(r) {
      if (!el.compareBody) return;
      if (r.type === "gas") {
        if (el.compareHead) {
          el.compareHead.innerHTML =
            "<tr><th scope=\"col\">지역</th><th scope=\"col\">기본요금</th><th scope=\"col\">취사 (원/MJ)</th>" +
            "<th scope=\"col\">난방 (원/MJ)</th><th scope=\"col\">이번 사용량 예상</th></tr>";
        }
        el.compareBody.innerHTML = H.REGIONS.filter(function (x) {
          return !x.custom;
        })
          .map(function (x) {
            var b = H.gasBill(r.mj, H.gasConfig({ region: x.id }));
            var cook = x.cooking === x.heating ? x.cooking.toFixed(4) : x.cooking.toFixed(4);
            var heat = x.cooking === x.heating ? "동일" : x.heating.toFixed(4);
            var best = b.total === r.total && x.id === r.region;
            return (
              "<tr><th scope=\"row\">" + x.label + "</th><td>" + Core.comma(x.base) + "원</td><td>" +
              cook + "</td><td>" + heat + "</td><td" +
              (best ? ' style="color:var(--blue-dark);font-weight:700"' : "") + ">" +
              Core.won(b.total) + "</td></tr>"
            );
          })
          .join("");
        if (el.compareCaption) {
          el.compareCaption.textContent =
            "2026년 11월 기준 · 부가세 별도 단가와 " + numLabel(r.mj, 1) + "MJ 사용 시 예상 청구액(부가세 포함)입니다.";
        }
        if (el.compareTableCaption) {
          el.compareTableCaption.textContent =
            numLabel(r.mj, 1) + "MJ · 기본요금 포함 · 부가세 10% 반영·10원 미만 절사 기준입니다.";
        }
      } else {
        if (el.compareHead) {
          el.compareHead.innerHTML =
            "<tr><th scope=\"col\">요금제</th><th scope=\"col\">단가 (원/Mcal)</th>" +
            "<th scope=\"col\">기본요금</th><th scope=\"col\">이번 사용량 예상</th></tr>";
        }
        var baseWon = H.dhBase(r.areaM2);
        var rows = [
          ["single", H.DH.SINGLE],
          ["winter", H.DH.WINTER],
          ["spring", H.DH.SPRING_FALL],
          ["summer", H.DH.SUMMER]
        ];
        el.compareBody.innerHTML = rows
          .map(function (row) {
            var b = H.dhBill(r.mcal, r.areaM2, { rate: row[1] });
            var label = row[0] === "single" ? "단일요금 (연중)" : H.seasonLabel(row[0]);
            var isThis = row[1] === r.rate;
            return (
              "<tr><th scope=\"row\">" + label + "</th><td>" + row[1].toFixed(2) + "원</td><td>" +
              Core.won(baseWon) + "</td><td" +
              (isThis ? ' style="color:var(--blue-dark);font-weight:700"' : "") + ">" +
              Core.won(b.total) + "</td></tr>"
            );
          })
          .join("");
        if (el.compareCaption) {
          el.compareCaption.textContent =
            "한국지역난방공사 주택용 · " + numLabel(r.areaM2, 0) + "㎡ · " + numLabel(r.mcal, 0) +
            "Mcal 기준 예상 청구액(부가세 포함)입니다.";
        }
        if (el.compareTableCaption) {
          el.compareTableCaption.textContent =
            "계절별 단가는 해당 절기(12~2월 / 3~5·9~11월 / 6~8월)에 적용되는 값입니다. 요금제는 단지 단위로 정해집니다.";
        }
      }
    }

    /* ---------------- 이벤트 ---------------- */

    UI.bindSegment(el.typeGroup, function (value) {
      /* 방식이 바뀌면 해당 방식의 첫 입력(사용열량)으로 돌아간다 */
      setSegment(value === "district" ? el.dhModeGroup : el.gasModeGroup, value === "district" ? "mcal" : "mj");
      applyVisibility();
      render();
    });

    UI.bindSegment(el.planGroup, function (value) {
      if (el.planHelp) {
        el.planHelp.textContent =
          value === "seasonal"
            ? "계절별 차등요금 단지입니다. 이번 달(" + month() + "월)은 " + H.seasonLabel(H.seasonOf(month())) +
              " 단가 " + H.dhConfig({ plan: "seasonal", month: month() }).rate.toFixed(2) + "원/Mcal가 적용됩니다."
            : "한국지역난방공사 주택용 단일요금 Mcal당 112.32원(부가세 별도). 계절별 차등요금을 쓰는 단지는 이번 달 절기 단가가 자동 적용됩니다.";
      }
      render();
    });

    if (el.regionBar) {
      UI.$$("button[data-region]", el.regionBar).forEach(function (btn) {
        btn.addEventListener("click", function () {
          UI.$$("button[data-region]", el.regionBar).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          var cfg = H.REGIONS.filter(function (x) {
            return x.id === btn.getAttribute("data-region");
          })[0];
          if (el.customWrap) el.customWrap.hidden = !cfg || !cfg.custom;
          if (cfg && el.coef) el.coef.value = cfg.coef.toFixed(4);
          render();
        });
      });
    }

    if (el.areaBar) {
      UI.$$("button[data-area]", el.areaBar).forEach(function (btn) {
        btn.addEventListener("click", function () {
          UI.$$("button[data-area]", el.areaBar).forEach(function (b) {
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          if (el.areaM2) el.areaM2.value = btn.getAttribute("data-area");
          syncArea("m2");
          setSegment(type() === "district" ? el.dhModeGroup : el.gasModeGroup, "area");
          applyVisibility();
          render();
        });
      });
    }

    UI.bindSegment(el.gasModeGroup, function () {
      applyVisibility();
      render();
    });
    UI.bindSegment(el.dhModeGroup, function () {
      applyVisibility();
      render();
    });
    UI.bindSegment(el.habitGroup, render);

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

    var inputs = [el.mj, el.m3, el.coef, el.heat, el.mcal, el.kwh, el.customBase, el.customCooking, el.customHeating];
    inputs.filter(Boolean).forEach(function (node) {
      node.addEventListener("change", render);
    });
    UI.onInput(inputs, render, 90);

    /* 초기 상태 */
    if (el.customWrap) el.customWrap.hidden = true;
    syncArea("m2");
    applyVisibility();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
