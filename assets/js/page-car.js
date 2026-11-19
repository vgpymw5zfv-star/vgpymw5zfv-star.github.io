/* 내 차 유지비 vs 대중교통(K-패스) — 페이지 연결 */
(function () {
  "use strict";
  var UI = window.DotoriUI;
  var Core = window.DotoriCore;
  var Car = window.DotoriCarCost;
  if (!UI || !Core || !Car) return;

  function init() {
    var el = {
      fuel: document.getElementById("car-fuel"),
      cc: document.getElementById("car-cc"),
      ccField: document.querySelector("[data-car-cc-field]"),
      age: document.getElementById("car-age"),
      eff: document.getElementById("car-eff"),
      effUnit: document.querySelector("[data-car-eff-unit]"),
      price: document.getElementById("car-price"),
      priceUnit: document.querySelector("[data-car-price-unit]"),
      km: document.getElementById("car-km"),
      prepay: document.getElementById("car-prepay"),
      parking: document.getElementById("car-parking"),
      insurance: document.getElementById("car-ins"),
      maintenance: document.getElementById("car-maint"),
      loanCheck: document.getElementById("car-loan-check"),
      loanField: document.querySelector("[data-car-loan-field]"),
      loan: document.getElementById("car-loan"),
      transit: document.getElementById("car-transit"),
      kpass: document.getElementById("car-kpass"),
      fare: document.getElementById("car-fare"),
      taxi: document.getElementById("car-taxi"),
      warnings: document.getElementById("car-warnings"),
      table: document.getElementById("car-km-table")
    };
    if (!el.fuel) return;

    function fuelInfo(key) {
      return Car.CONST.FUELS[key] || Car.CONST.FUELS.gasoline;
    }

    function readInput() {
      return {
        fuelType: el.fuel.value,
        displacement: UI.toNumber(el.cc, 1998),
        ageYears: UI.toNumber(el.age, 5),
        efficiency: UI.toNumber(el.eff, fuelInfo(el.fuel.value).eff),
        fuelPrice: UI.toNumber(el.price, Car.CONST.FUEL_PRICE[el.fuel.value] || 1855),
        monthlyKm: UI.toNumber(el.km, 1000),
        prepay: el.prepay ? el.prepay.value : "none",
        parkingTollWon: UI.toNumber(el.parking, 0),
        insuranceYearWon: UI.toNumber(el.insurance, 900000),
        maintenanceYearWon: UI.toNumber(el.maintenance, 600000),
        includeLoan: !!(el.loanCheck && el.loanCheck.checked),
        loanMonthlyWon: UI.toNumber(el.loan, 0),
        transitWon: UI.toNumber(el.transit, 66650),
        kpassType: el.kpass ? el.kpass.value : "general",
        fare: UI.toNumber(el.fare, 1550),
        taxiFare: UI.toNumber(el.taxi, 12000)
      };
    }

    function syncFuel() {
      var key = el.fuel.value;
      var info = fuelInfo(key);
      var isEv = key === "electric";
      if (el.ccField) el.ccField.hidden = isEv;
      if (el.effUnit) el.effUnit.textContent = info.effUnit;
      if (el.priceUnit) el.priceUnit.textContent = info.unit;
      if (el.price) el.price.value = String(Car.CONST.FUEL_PRICE[key]);
      if (el.eff) el.eff.value = String(info.eff);
    }

    function syncLoan() {
      if (el.loanField) el.loanField.hidden = !(el.loanCheck && el.loanCheck.checked);
    }

    function render() {
      var r = Car.compute(readInput());

      var labels = {
        transit: "대중교통(K-패스)이 유리",
        car: "내 차가 유리",
        same: "차이 없음"
      };
      UI.setText("car-better", labels[r.cheaper] || "비교 불가");
      UI.countTo("car-diff", r.monthlyDiff, Core.comma);
      UI.setText(
        "car-sub",
        "차 월 " + Core.won(r.total) + " · 대중교통 월 " + Core.won(r.transit.amount)
      );
      UI.setText(
        "car-pill",
        r.fuelLabel + " · " + Core.comma(r.monthlyKm) + "km/월 · km당 " + Core.won(Math.round(r.perKm))
      );

      UI.setText("car-fuel-m", Core.won(r.fuelMonthly));
      UI.setText("car-tax-m", Core.won(r.taxMonthly));
      UI.setText("car-ins-m", Core.won(r.insuranceMonthly));
      UI.setText("car-maint-m", Core.won(r.maintenanceMonthly));
      UI.setText("car-parking-m", Core.won(r.parking));
      UI.setText("car-loan-m", Core.won(r.loan));
      UI.setText("car-total", Core.won(r.total));
      UI.setText("car-yearly", Core.won(r.yearly));
      UI.setText("car-transit-amount", Core.won(r.transit.amount));
      UI.setText("car-monthly-car", Core.won(r.total));
      UI.setText("car-monthly-transit", Core.won(r.transit.amount));
      UI.setText("car-transit-yearly", Core.won(r.transit.yearly));
      UI.setText("car-transit-five", Core.won(r.transit.fiveYear));
      UI.setText("car-transit-refund", Core.won(r.transit.refund));
      UI.setText("car-year-diff", Core.won(r.yearlyDiff));
      UI.setText("car-5y-diff", Core.won(r.fiveYearDiff));
      UI.setText("car-taxi-rides", r.taxiRides + "회");
      UI.setText("car-five-year", Core.won(r.fiveYear));

      UI.setText("car-tax-base", Core.won(r.tax.taxBase));
      UI.setText("car-tax-auto", Core.won(r.tax.autoTax));
      UI.setText("car-tax-edu", Core.won(r.tax.eduTax));
      UI.setText("car-tax-total", Core.won(r.tax.total));
      UI.setText(
        "car-tax-age",
        r.tax.isEv
          ? "정액 (차령 경감 없음)"
          : Math.round(r.tax.ageDiscountRate * 100) + "% 경감 (차령 " + r.tax.ageYears + "년)"
      );
      UI.setText("car-tax-prepaid", Core.won(r.tax.afterPrepay));
      UI.setText(
        "car-tax-discount",
        (r.tax.prepayDiscount > 0 ? "-" : "") + Core.won(r.tax.prepayDiscount)
      );

      if (el.warnings) {
        el.warnings.innerHTML = r.warnings
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

    function renderTable() {
      if (!el.table) return;
      var o = readInput();
      var rows = Car.byMonthlyKm(o, [500, 1000, 1500, 2000, 3000]);
      el.table.innerHTML = rows
        .map(function (row) {
          var cheaper =
            row.cheaper === "transit"
              ? "대중교통 " + Core.won(row.diff)
              : row.cheaper === "car"
              ? "차 " + Core.won(row.diff)
              : "동일";
          return (
            "<tr><th scope=\"row\">" +
            Core.comma(row.monthlyKm) +
            "km</th><td>" +
            Core.won(row.fuelMonthly) +
            "</td><td>" +
            Core.won(row.total) +
            "</td><td class=\"is-best\">" +
            Core.won(Math.round(row.perKm)) +
            "</td><td>" +
            cheaper +
            "</td></tr>"
          );
        })
        .join("");
    }

    if (el.fuel) {
      el.fuel.addEventListener("change", function () {
        syncFuel();
        render();
        renderTable();
      });
    }
    if (el.loanCheck) {
      el.loanCheck.addEventListener("change", function () {
        syncLoan();
        render();
        renderTable();
      });
    }

    var inputs = [
      el.cc,
      el.age,
      el.eff,
      el.price,
      el.km,
      el.parking,
      el.insurance,
      el.maintenance,
      el.loan,
      el.transit,
      el.fare,
      el.taxi
    ].filter(Boolean);
    inputs.forEach(function (node) {
      node.addEventListener("change", function () {
        render();
        renderTable();
      });
    });
    [el.prepay, el.kpass].filter(Boolean).forEach(function (node) {
      node.addEventListener("change", function () {
        render();
        renderTable();
      });
    });
    UI.onInput(inputs, function () {
      render();
      renderTable();
    }, 100);

    syncFuel();
    syncLoan();
    render();
    renderTable();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
