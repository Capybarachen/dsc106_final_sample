let slide6AnnualData = [];
let slide6TempData = [];
let slide6CoefData = [];
let slide6MapFeatures = [];
let slide6MapReady = false;
let slide6HoveredStatePath = null;
let slide6LastPointerEvent = null;

const slide6MapMetric = {
  label: "Average tas_c",
  units: "°C",
  colorDomain: [-5, 10, 25],
  colorRange: ["#2563eb", "#f8fafc", "#dc2626"],
  getValues(start, end) {
    return d3.rollup(
      slide6TempData.filter(
        d => d.year >= start && d.year <= end && Number.isFinite(d.tas_c)
      ),
      rows => d3.mean(rows, d => d.tas_c),
      d => d.state
    );
  },
  format(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)} °C` : "—";
  },
  getColorScale() {
    return d3.scaleLinear()
      .domain(this.colorDomain)
      .range(this.colorRange)
      .clamp(true);
  },
};

const slide6StateFips = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "District of Columbia",
  "12": "Florida",
  "13": "Georgia",
  "15": "Hawaii",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming",
};

function initSlide6() {
  Promise.all([
    d3.csv("state_annual_climate.csv", d3.autoType),
    d3.csv("state_regression_coefficients.csv", d3.autoType),
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").catch(() => null),
  ]).then(([annualRows, coefRows, usMap]) => {
    const co2ByYear = d3.rollup(
      annualRows.filter(d => Number.isFinite(d.co2_ppm)),
      rows => d3.median(rows, d => d.co2_ppm),
      d => d.year
    );

    const rowsWithImputedCo2 = annualRows.map(d => ({
      ...d,
      co2_ppm: Number.isFinite(d.co2_ppm) ? d.co2_ppm : co2ByYear.get(d.year),
    }));

    slide6TempData = annualRows.filter(
      d =>
        d.year >= 1960 &&
        d.year <= 2014 &&
        Number.isFinite(d.tas_c)
    );

    slide6AnnualData = rowsWithImputedCo2.filter(
      d =>
        d.year >= 1960 &&
        d.year <= 2014 &&
        Number.isFinite(d.tas_anomaly) &&
        Number.isFinite(d.co2_ppm) &&
        Number.isFinite(d.od550aer) &&
        Number.isFinite(d.rsdt)
    );

    slide6CoefData = coefRows;
    slide6MapFeatures = getSlide6StateFeatures(usMap);

    const stateSelect = document.getElementById("slide6StateSelect");
    const states = slide6CoefData.map(d => d.state).sort();

    stateSelect.innerHTML = states
      .map(s => `<option value="${s}">${s}</option>`)
      .join("");

    stateSelect.value = states.includes("California") ? "California" : states[0];

    document.getElementById("slide6StateSelect").addEventListener("change", updateSlide6);
    document.getElementById("slide6StartYear").addEventListener("input", updateSlide6);
    document.getElementById("slide6EndYear").addEventListener("input", updateSlide6);

    initSlide6Map();
    updateSlide6();
  });
}

function updateSlide6() {
  const state = document.getElementById("slide6StateSelect").value;

  const startSlider = document.getElementById("slide6StartYear");
  const endSlider = document.getElementById("slide6EndYear");

  let start = Math.min(+startSlider.value, +endSlider.value);
  let end = Math.max(+startSlider.value, +endSlider.value);

  document.getElementById("slide6StartLabel").textContent = start;
  document.getElementById("slide6EndLabel").textContent = end;

  const fill = document.getElementById("slide6SliderFill");
  const pct = v => ((v - 1960) / (2014 - 1960)) * 100;
  fill.style.left = `${pct(start)}%`;
  fill.style.right = `${100 - pct(end)}%`;

  const coef = slide6CoefData.find(d => d.state === state);
  const selectedAverageTemp = getSlide6AverageTemp(state, start, end);
  const stateRows = slide6AnnualData
    .filter(d => d.state === state && d.year >= start && d.year <= end)
    .sort((a, b) => a.year - b.year);

  document.getElementById("slide6AverageTemp").textContent = fmtSlide6AvgTemp(selectedAverageTemp);
  updateSlide6Map(start, end, state);

  if (!coef || stateRows.length < 2) {
    d3.select("#slide6Chart").selectAll("*").remove();
    return;
  }

  const first = stateRows[0];
  const last = stateRows[stateRows.length - 1];

  const observed = last.tas_anomaly - first.tas_anomaly;
  const co2Contribution = coef.beta_co2 * (last.co2_ppm - first.co2_ppm);
  const aerosolContribution = coef.beta_od550aer * (last.od550aer - first.od550aer);
  const rsdtContribution = coef.beta_rsdt * (last.rsdt - first.rsdt);
  const predicted = co2Contribution + aerosolContribution + rsdtContribution;

  setSlide6Value("slide6ObservedChange", observed, "#111827");
  setSlide6Value("slide6Co2Warming", co2Contribution, "#e53935");
  setSlide6Value("slide6AerosolCooling", aerosolContribution, "#2196f3");
  setSlide6Value("slide6PredictedChange", predicted, "#6b7280");

  document.getElementById("slide6Equation").innerHTML =
    `Model: tas anomaly = ${coef.intercept.toFixed(2)} 
    + ${coef.beta_co2.toExponential(2)}·CO₂ 
    + ${coef.beta_od550aer.toFixed(2)}·od550aer 
    + ${coef.beta_rsdt.toFixed(2)}·rsdt`;

  const chartRows = stateRows.map(d => ({
    year: d.year,
    observed: d.tas_anomaly - first.tas_anomaly,
    co2: coef.beta_co2 * (d.co2_ppm - first.co2_ppm),
    aerosol: coef.beta_od550aer * (d.od550aer - first.od550aer),
    rsdt: coef.beta_rsdt * (d.rsdt - first.rsdt),
  }));

  chartRows.forEach(d => {
    d.predicted = d.co2 + d.aerosol + d.rsdt;
  });

  drawSlide6Chart(chartRows);
}

function getSlide6StateFeatures(usMap) {
  if (!usMap || typeof topojson === "undefined") return [];

  return topojson
    .feature(usMap, usMap.objects.states)
    .features
    .map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        name:
          feature.properties?.name ||
          slide6StateFips[String(feature.id).padStart(2, "0")] ||
          String(feature.id),
      },
    }));
}

function getSlide6StateAverages(start, end) {
  return slide6MapMetric.getValues(start, end);
}

function getSlide6AverageTemp(state, start, end) {
  return d3.mean(
    slide6TempData.filter(
      d =>
        d.state === state &&
        d.year >= start &&
        d.year <= end &&
        Number.isFinite(d.tas_c)
    ),
    d => d.tas_c
  );
}

function initSlide6Map() {
  const svg = d3.select("#slide6Map");
  svg.selectAll("*").remove();

  const width = 960;
  const height = 600;
  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .on("click", event => event.stopPropagation())
    .on("pointerdown", event => event.stopPropagation());

  if (!slide6MapFeatures.length) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("class", "chart-label")
      .text("Map could not be loaded.");
    return;
  }

  const projection = d3.geoAlbersUsa().scale(1280).translate([480, 300]);
  const path = d3.geoPath().projection(projection);

  svg.append("g")
    .attr("class", "state-map-layer")
    .selectAll("path")
    .data(slide6MapFeatures)
    .join("path")
    .attr("class", "state-map-path")
    .attr("d", path)
    .on("mousemove", (event, d) => {
      event.stopPropagation();
      slide6HoveredStatePath = event.currentTarget;
      slide6LastPointerEvent = event;
      showSlide6StateTooltip(event, event.currentTarget);
    })
    .on("mouseleave", event => {
      event.stopPropagation();
      slide6HoveredStatePath = null;
      slide6LastPointerEvent = null;
      hideTooltip();
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      const name = d.properties.name;
      if (!d3.select(event.currentTarget).classed("has-data")) return;
      document.getElementById("slide6StateSelect").value = name;
      updateSlide6();
    });

  slide6MapReady = true;
}


function updateSlide6Map(start, end, selectedState) {
  if (!slide6MapReady) {
    initSlide6Map();
  }

  if (!slide6MapFeatures.length) return;

  const averages = getSlide6StateAverages(start, end);
  const color = slide6MapMetric.getColorScale();
  const availableStates = new Set(slide6CoefData.map(d => d.state));

  d3.select("#slide6Map")
    .selectAll(".state-map-path")
    .each(d => {
      d.properties.slide6AverageTemp = averages.get(d.properties.name);
    })
    .attr("class", d => {
      const name = d.properties.name;
      const avg = averages.get(name);
      return [
        "state-map-path",
        Number.isFinite(avg) ? "has-temp" : "no-temp",
        availableStates.has(name) ? "has-data" : "no-data",
        name === selectedState ? "selected" : "",
      ].join(" ");
    })
    .attr("fill", d => {
      const avg = averages.get(d.properties.name);
      return Number.isFinite(avg) ? color(avg) : "#e5e7eb";
    });

  drawSlide6MapLegend(color, start, end);

  if (slide6HoveredStatePath && slide6LastPointerEvent) {
    showSlide6StateTooltip(slide6LastPointerEvent, slide6HoveredStatePath);
  }
}

function showSlide6StateTooltip(event, statePath) {
  const state = d3.select(statePath);
  const d = state.datum();
  const avg = d.properties.slide6AverageTemp;
  const value = Number.isFinite(avg) ? slide6MapMetric.format(avg) : "No temperature data";
  const modelNote = state.classed("has-data")
    ? "Click to select"
    : "No regression model for this state yet";

  showTooltip(
    event,
    `<strong>${d.properties.name}</strong><br>Average temperature: ${value}<br>${modelNote}`
  );
}

function drawSlide6MapLegend(color, start, end) {
  const svg = d3.select("#slide6Map");
  svg.selectAll(".slide6-map-legend").remove();

  const domain = slide6MapMetric.colorDomain;
  const width = 240;
  const height = 10;
  const x = 960 - width - 28;
  const y = 28;
  const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
  const gradient = defs.select("#slide6MapGradient").empty()
    ? defs.append("linearGradient").attr("id", "slide6MapGradient")
    : defs.select("#slide6MapGradient");

  gradient
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  gradient.selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .join("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => color(domain[0] + d * (domain[2] - domain[0])));

  const legend = svg.append("g")
    .attr("class", "slide6-map-legend")
    .attr("transform", `translate(${x},${y})`);

  legend.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("rx", 5)
    .attr("fill", "url(#slide6MapGradient)");

  legend.append("text")
    .attr("class", "chart-label")
    .attr("x", 0)
    .attr("y", -8)
    .text(`${slide6MapMetric.label}, ${start}-${end} fixed scale`);

  legend.append("text")
    .attr("class", "chart-label")
    .attr("x", 0)
    .attr("y", 27)
    .text(slide6MapMetric.format(domain[0]));

  legend.append("text")
    .attr("class", "chart-label")
    .attr("x", width / 2)
    .attr("y", 27)
    .attr("text-anchor", "middle")
    .text(slide6MapMetric.format(domain[1]));

  legend.append("text")
    .attr("class", "chart-label")
    .attr("x", width)
    .attr("y", 27)
    .attr("text-anchor", "end")
    .text(slide6MapMetric.format(domain[2]));
}

function fmtSlide6Temp(v) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)} °C`;
}

function setSlide6Value(id, value, color) {
  const el = document.getElementById(id);
  el.textContent = fmtSlide6Temp(value);
  el.style.color = color;
}

function fmtSlide6AvgTemp(v) {
  return slide6MapMetric.format(v);
}

function drawSlide6Chart(data) {
  const svg = d3.select("#slide6Chart");
  svg.selectAll("*").remove();

  const { w, h, m } = box(svg, 900, 430);

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .range([m.left, w - m.right]);

  const allValues = data.flatMap(d => [d.observed, d.co2, d.aerosol, d.rsdt, d.predicted]);
  const y = d3.scaleLinear()
    .domain(d3.extent(allValues))
    .nice()
    .range([h - m.bottom, m.top]);

  axes(svg, x, y, w, h, m, true);

  svg.append("line")
    .attr("x1", m.left).attr("x2", w - m.right)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#94a3b8")
    .attr("stroke-dasharray", "4,3");

  const seriesDef = [
    { key: "observed", label: "Observed ΔT",              color: "#111827" },
    { key: "predicted", label: "Predicted ΔT",            color: "#6b7280", dash: "6,4" },
    { key: "co2",      label: "CO₂ contribution",         color: "#e53935" },
    { key: "aerosol",  label: "Aerosol contribution",      color: "#2196f3" },
    { key: "rsdt",     label: "Solar radiation",           color: "#f6ae2d" },
  ];

  const lineGen = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  const visible = seriesDef.map(() => true);

  const paths = seriesDef.map(s => {
    const values = data.map(d => ({ year: d.year, value: d[s.key] }));
    const p = svg.append("path")
      .datum(values)
      .attr("fill", "none")
      .attr("stroke", s.color)
      .attr("stroke-width", 2.4)
      .attr("d", lineGen);
    if (s.dash) p.attr("stroke-dasharray", s.dash);
    return p;
  });

  const crosshair = svg.append("line")
    .attr("y1", m.top).attr("y2", h - m.bottom)
    .attr("stroke", "#94a3b8").attr("stroke-width", 1).attr("stroke-dasharray", "4,3")
    .attr("pointer-events", "none")
    .style("display", "none");

  const hoverDots = seriesDef.map(s =>
    svg.append("circle")
      .attr("r", 4).attr("fill", s.color)
      .attr("stroke", "#fff").attr("stroke-width", 1.5)
      .attr("pointer-events", "none")
      .style("display", "none")
  );

  let lockedIdx = -1;

  // Lock hint shown inside chart when a line is pinned
  const lockHint = svg.append("text")
    .attr("class", "chart-label")
    .attr("x", w / 2)
    .attr("y", h - 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", "11")
    .style("display", "none");

  // Interactive legend — click to toggle series visibility
  const legendG = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${m.left},${m.top - 18})`);

  seriesDef.forEach((s, i) => {
    const item = legendG.append("g")
      .attr("class", "legend-item")
      .attr("transform", `translate(${i * 150},0)`)
      .on("click", function() {
        visible[i] = !visible[i];
        paths[i].style("display", visible[i] ? null : "none");
        hoverDots[i].style("display", "none");
        d3.select(this).attr("opacity", visible[i] ? 1 : 0.35);
        // If the locked line was just hidden, release the lock
        if (!visible[i] && lockedIdx === i) {
          lockedIdx = -1;
          lockHint.style("display", "none");
          paths.forEach((p, j) => {
            if (visible[j]) p.attr("stroke-width", 2.4).attr("opacity", 1);
          });
        }
      });
    item.append("circle").attr("r", 5).attr("fill", s.color);
    item.append("text").attr("x", 12).attr("y", 4).text(s.label);
  });

  label(svg, "Temperature anomaly change relative to selected start year", m.left, m.top + 22);

  const bisect = d3.bisector(d => d.year).left;

  const closestVisibleIdx = (pt, my) => {
    let minDist = Infinity, idx = -1;
    seriesDef.forEach((s, i) => {
      if (!visible[i]) return;
      const dist = Math.abs(my - y(pt[s.key]));
      if (dist < minDist) { minDist = dist; idx = i; }
    });
    return idx;
  };

  const applyEmphasis = activeIdx => {
    paths.forEach((p, i) => {
      if (!visible[i]) return;
      p.attr("stroke-width", i === activeIdx ? 3.5 : 1.5)
        .attr("opacity", i === activeIdx ? 1 : 0.22);
    });
  };

  const resetEmphasis = () => {
    paths.forEach((p, i) => { if (visible[i]) p.attr("stroke-width", 2.4).attr("opacity", 1); });
  };

  const snapYear = (mx) => {
    const yearPos = x.invert(mx);
    const idx = bisect(data, yearPos, 1);
    const d0 = data[Math.max(0, idx - 1)];
    const d1 = data[idx];
    return !d1 ? d0 : (yearPos - d0.year > d1.year - yearPos ? d1 : d0);
  };

  const buildTooltipHtml = (pt, activeIdx) => {
    const fmt = v => `${v >= 0 ? "+" : ""}${v.toFixed(3)} °C`;
    const s = seriesDef[activeIdx];
    return (
      `<strong>Year: ${pt.year}</strong>` +
      (lockedIdx >= 0 ? ` <span style="opacity:.6;font-size:10px">📌</span>` : "") +
      `<br><span style="color:${s.color};font-weight:700">▶ ${s.label}: ${fmt(pt[s.key])}</span>` +
      `<hr style="border:none;border-top:1px solid rgba(255,255,255,.25);margin:.3rem 0">` +
      seriesDef
        .filter((_, i) => visible[i] && i !== activeIdx)
        .map(t => `<span style="color:${t.color}">■</span> ${t.label}: ${fmt(pt[t.key])}`)
        .join("<br>")
    );
  };

  svg.append("rect")
    .attr("x", m.left).attr("y", m.top)
    .attr("width", w - m.left - m.right).attr("height", h - m.bottom - m.top)
    .attr("fill", "none").attr("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", function(event) {
      const [mx, my] = d3.pointer(event);
      const pt = snapYear(mx);
      const clickedIdx = closestVisibleIdx(pt, my);

      if (lockedIdx === clickedIdx) {
        // Click same line → release lock
        lockedIdx = -1;
        lockHint.style("display", "none");
        resetEmphasis();
      } else {
        // Lock to the closest line
        lockedIdx = clickedIdx;
        applyEmphasis(lockedIdx);
        lockHint
          .style("display", null)
          .text(`📌 ${seriesDef[lockedIdx].label} — click again to release`);
      }
    })
    .on("mousemove", function(event) {
      const [mx, my] = d3.pointer(event);
      const pt = snapYear(mx);
      const activeIdx = lockedIdx >= 0 ? lockedIdx : closestVisibleIdx(pt, my);

      // Only update emphasis when not locked (locked state is set on click)
      if (lockedIdx < 0) applyEmphasis(activeIdx);

      crosshair.style("display", null).attr("x1", x(pt.year)).attr("x2", x(pt.year));

      hoverDots.forEach((dot, i) => {
        dot.style("display", visible[i] ? null : "none")
          .attr("cx", x(pt.year))
          .attr("cy", y(pt[seriesDef[i].key]));
      });

      d3.select("#tooltip")
        .classed("hidden", false)
        .style("left", `${event.clientX + 14}px`)
        .style("top", `${event.clientY + 14}px`)
        .html(buildTooltipHtml(pt, activeIdx));
    })
    .on("mouseleave", function() {
      crosshair.style("display", "none");
      hoverDots.forEach(dot => dot.style("display", "none"));
      d3.select("#tooltip").classed("hidden", true);
      // Keep emphasis if a line is locked; otherwise reset
      if (lockedIdx < 0) resetEmphasis();
    });
}
