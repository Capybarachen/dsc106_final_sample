let currentSlide = 0;
let slides;
let totalSlides;
let isTransitioning = false;

const prevSlideBtn = document.getElementById("prevSlideBtn");
const nextSlideBtn = document.getElementById("nextSlideBtn");

function updateNavigationButtons() {
  prevSlideBtn.disabled = currentSlide === 0;
  nextSlideBtn.disabled = currentSlide === slides.length - 1;
}

function resetTypewriters(slide) {
  slide.querySelectorAll(".typewriter").forEach((el) => {
    if (el._typingTimeout) clearTimeout(el._typingTimeout);
    el._typingTimeout = null;
    const textElement = el.querySelector(".typewriter-text");
    if (textElement) textElement.textContent = "";
  });
}

function typewriterEffect(element, speed = 38) {
  const text = element.getAttribute("data-text") || "";
  const textElement = element.querySelector(".typewriter-text");
  if (!textElement) return;
  if (element._typingTimeout) clearTimeout(element._typingTimeout);
  textElement.textContent = "";
  let i = 0;
  function type() {
    if (i < text.length) {
      textElement.textContent += text.charAt(i++);
      element._typingTimeout = setTimeout(type, speed);
    }
  }
  type();
}

function triggerTypewriterInSlide(slide) {
  slide.querySelectorAll(".typewriter").forEach((el) => typewriterEffect(el));
}

function updateSlide() {
  slides.forEach((slide, index) => {
    slide.classList.remove("active", "prev", "next");
    resetTypewriters(slide);
    if (index === currentSlide) {
      slide.classList.add("active");
      triggerTypewriterInSlide(slide);
    } else if (index < currentSlide) slide.classList.add("prev");
    else slide.classList.add("next");
  });
  document.querySelectorAll(".indicator-dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === currentSlide);
  });
  updateNavigationButtons();
}

function goToSlide(index) {
  if (index === currentSlide || isTransitioning) return;
  isTransitioning = true;
  currentSlide = Math.max(0, Math.min(totalSlides - 1, index));
  updateSlide();
  setTimeout(() => (isTransitioning = false), 250);
}
function nextSlide() { if (currentSlide < totalSlides - 1) goToSlide(currentSlide + 1); }
function previousSlide() { if (currentSlide > 0) goToSlide(currentSlide - 1); }

document.addEventListener("DOMContentLoaded", () => {
  slides = document.querySelectorAll(".slide");
  totalSlides = slides.length;
  const indicatorContainer = document.getElementById("slide-indicator");
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement("div");
    dot.className = "indicator-dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => goToSlide(i));
    indicatorContainer.appendChild(dot);
  }
  prevSlideBtn.addEventListener("click", previousSlide);
  nextSlideBtn.addEventListener("click", nextSlide);
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); nextSlide(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); previousSlide(); }
  });
  document.querySelector(".slides-container").addEventListener("click", (e) => {
    if (e.target.closest("button,select,input,svg,.indicator-dot,.chart-container")) return;
    if (e.clientX < window.innerWidth / 2) previousSlide(); else nextSlide();
  });
  updateSlide();
  loadData();
});

function loadData() {
  Promise.all([
    d3.csv("global_yearly.csv", d => ({ year: +d.year, od550aer: +d.od550aer, tas_c: +d.tas_c, tas_anomaly: +d.tas_anomaly })),
    d3.csv("state_annual_climate.csv", d => ({ year: +d.year, state: d.state, od550aer: +d.od550aer, co2_ppm: +d.co2_ppm, tas_c: +d.tas_c })),
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
  ]).then(([data, stateData, usGeo]) => {
    drawSlide4Chart(data);

    const startSlider = document.getElementById("startYearSlider");
    const endSlider   = document.getElementById("endYearSlider");
    const startLabel  = document.getElementById("startYearLabel");
    const endLabel    = document.getElementById("endYearLabel");
    const rangeTitle  = document.getElementById("slide3YearRange");
    const fill = document.getElementById("sliderFill");
    const MIN = 1850, MAX = 2014;

    function redraw() {
      const s = Math.min(+startSlider.value, +endSlider.value);
      const e = Math.max(+startSlider.value, +endSlider.value);
      startLabel.textContent = s;
      endLabel.textContent   = e;
      rangeTitle.textContent = `${s}–${e}`;
      const pct = v => ((v - MIN) / (MAX - MIN)) * 100;
      fill.style.left  = `${pct(s)}%`;
      fill.style.right = `${100 - pct(e)}%`;
      drawSlide3Chart(data.filter(d => d.year >= s && d.year <= e));
    }

    startSlider.addEventListener("input", redraw);
    endSlider.addEventListener("input", redraw);
    redraw();

    initStateMapSlide(stateData, usGeo);
  });
}

// ── State Map Slide ──────────────────────────────────────────────────────────

const FIPS_TO_STATE = {
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California",
  "08":"Colorado","09":"Connecticut","10":"Delaware","12":"Florida","13":"Georgia",
  "15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa",
  "20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland",
  "25":"Massachusetts","26":"Michigan","27":"Minnesota","28":"Mississippi",
  "29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire",
  "34":"New Jersey","35":"New Mexico","36":"New York","37":"North Carolina",
  "38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania",
  "44":"Rhode Island","45":"South Carolina","46":"South Dakota","47":"Tennessee",
  "48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington",
  "54":"West Virginia","55":"Wisconsin","56":"Wyoming"
};

let _stateFeatureMap = {};
let _stateClimateData = [];
let _stateYearLookup = {};
let _mapColorScale = null;
let _currentMapYear = 1980;

function initStateMapSlide(stateData, usGeo) {
  _stateClimateData = stateData;
  const stateSet = new Set(stateData.map(d => d.state));
  const states = topojson.feature(usGeo, usGeo.objects.states);

  states.features.forEach(f => {
    _stateFeatureMap[String(f.id).padStart(2, "0")] = f;
  });

  stateData.forEach(d => {
    if (!_stateYearLookup[d.state]) _stateYearLookup[d.state] = {};
    _stateYearLookup[d.state][d.year] = d;
  });

  const tasExtent = d3.extent(stateData, d => d.tas_c);
  _mapColorScale = d3.scaleSequential(d3.interpolateOrRd).domain(tasExtent);

  const svg = d3.select("#usMapSvg");
  svg.attr("viewBox", "0 0 960 600");
  const projection = d3.geoAlbersUsa().scale(1280).translate([480, 300]);
  const path = d3.geoPath().projection(projection);

  svg.selectAll("path.us-state")
    .data(states.features)
    .join("path")
    .attr("class", "us-state")
    .attr("d", path)
    .on("mousemove", function(event, d) {
      const fips = String(d.id).padStart(2, "0");
      const name = FIPS_TO_STATE[fips];
      if (!name || !stateSet.has(name)) return;
      d3.select(this).attr("stroke", "#333").attr("stroke-width", 2);
      const row = (_stateYearLookup[name] || {})[_currentMapYear];
      const html = row
        ? `<strong>${name}</strong><br>Temp: ${row.tas_c.toFixed(2)} °C<br>Aerosol: ${row.od550aer.toFixed(4)}<br>CO₂: ${row.co2_ppm.toFixed(1)} ppm`
        : `<strong>${name}</strong><br>No data`;
      d3.select("#mapTooltip").classed("hidden", false)
        .style("left", `${event.clientX + 14}px`)
        .style("top",  `${event.clientY + 14}px`)
        .html(html);
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
      d3.select("#mapTooltip").classed("hidden", true);
    })
    .on("click", function(event, d) {
      const fips = String(d.id).padStart(2, "0");
      const name = FIPS_TO_STATE[fips];
      if (name && stateSet.has(name)) showStateDetail(name, fips);
    });

  const slider = document.getElementById("mapYearSlider");
  const yearLabel = document.getElementById("mapYearLabel");
  slider.addEventListener("input", function() {
    _currentMapYear = +this.value;
    yearLabel.textContent = _currentMapYear;
    updateMapColors();
  });

  document.getElementById("backToMapBtn").addEventListener("click", backToMap);
  backToMap();
  updateMapColors();
}

function updateMapColors() {
  d3.selectAll("path.us-state").attr("fill", d => {
    const name = FIPS_TO_STATE[String(d.id).padStart(2, "0")];
    const row = (_stateYearLookup[name] || {})[_currentMapYear];
    return row ? _mapColorScale(row.tas_c) : "#ccc";
  });
}

function showStateDetail(stateName, fips) {
  const stateData = _stateClimateData.filter(d => d.state === stateName);
  const feature = _stateFeatureMap[fips];
  const mapView = document.getElementById("mapView");
  const detailView = document.getElementById("stateDetailView");

  document.getElementById("stateMapHeading").textContent = stateName;
  document.getElementById("stateOutlineLabel").textContent = stateName;
  document.getElementById("backToMapBtn").style.display = "inline-block";

  // Render content while map is still visible so it's ready when we fade in
  const outlineSvg = d3.select("#stateOutlineSvg");
  outlineSvg.selectAll("*").remove();
  outlineSvg.attr("viewBox", "0 0 280 280");
  if (feature) {
    const proj = d3.geoMercator().fitExtent([[10, 10], [270, 270]], feature);
    outlineSvg.append("path")
      .datum(feature)
      .attr("d", d3.geoPath().projection(proj))
      .attr("fill", "#c0392b")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);
  }
  drawStateComboChart(stateData, stateName);

  // Fade map out, then swap views and fade detail in
  mapView.style.opacity = "0";
  setTimeout(() => {
    mapView.style.display = "none";
    mapView.style.opacity = "1";      // reset while hidden
    detailView.style.opacity = "0";
    detailView.style.display = "flex";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      detailView.style.opacity = "1";
    }));
  }, 300);
}

function backToMap() {
  const mapView = document.getElementById("mapView");
  const detailView = document.getElementById("stateDetailView");
  document.getElementById("backToMapBtn").style.display = "none";
  document.getElementById("stateMapHeading").textContent = "Select a State";

  if (detailView.style.display !== "flex") {
    // Initial setup — skip animation
    mapView.style.display = "block";
    mapView.style.opacity = "1";
    detailView.style.display = "none";
    return;
  }

  // Fade detail out, then swap views and fade map in
  detailView.style.opacity = "0";
  setTimeout(() => {
    detailView.style.display = "none";
    detailView.style.opacity = "1";   // reset while hidden
    mapView.style.opacity = "0";
    mapView.style.display = "block";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      mapView.style.opacity = "1";
    }));
  }, 300);
}

function drawStateComboChart(data, stateName) {
  const svg = d3.select("#stateComboChart");
  svg.selectAll("*").remove();
  const W = 560, H = 380, m = { top: 50, right: 28, bottom: 46, left: 64 };
  svg.attr("viewBox", `0 0 ${W} ${H}`);

  const series = [
    { key: "tas_c",    label: "Temperature (°C)", color: "#e53935", fmt: v => `${v.toFixed(2)} °C`   },
    { key: "od550aer", label: "Aerosol od550aer",  color: "#f6ae2d", fmt: v => v.toFixed(4)           },
    { key: "co2_ppm",  label: "CO₂ (ppm)",         color: "#43a047", fmt: v => `${v.toFixed(1)} ppm` },
  ].map(s => {
    const sc = d3.scaleLinear().domain(d3.extent(data, d => d[s.key])).range([0, 1]);
    return { ...s, values: data.map(d => ({ year: d.year, value: sc(d[s.key]), raw: d[s.key] })) };
  });

  const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([m.left, W - m.right]);
  const y = d3.scaleLinear().domain([0, 1]).range([H - m.bottom, m.top]);

  svg.append("g").attr("class","axis").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
  svg.append("g").attr("class","axis").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.append("g").attr("class","grid").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W-m.left-m.right)).tickFormat("")).selectAll("line").attr("class","grid-line");

  const lineGen = d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX);
  const paths = series.map(s =>
    svg.append("path").datum(s.values).attr("class","line").attr("stroke", s.color).attr("d", lineGen)
  );

  const dot = svg.append("circle")
    .attr("r", 5).attr("fill", "#fff").attr("stroke-width", 2)
    .attr("pointer-events", "none").style("display", "none");

  const bisect = d3.bisector(d => d.year).left;

  svg.append("rect")
    .attr("x", m.left).attr("y", m.top)
    .attr("width", W - m.left - m.right).attr("height", H - m.top - m.bottom)
    .attr("fill", "none").attr("pointer-events", "all")
    .on("mousemove", function(event) {
      const [mx, my] = d3.pointer(event);
      const yearPos = x.invert(mx);

      // Snap to nearest actual year
      const idx = bisect(series[0].values, yearPos, 1);
      const lo = series[0].values[idx - 1];
      const hi = series[0].values[idx];
      const snapped = !hi ? lo : (yearPos - lo.year > hi.year - yearPos ? hi : lo);

      // Find closest series by vertical distance at snapped year
      let minDist = Infinity, closestIdx = 0;
      series.forEach((s, i) => {
        const pt = s.values.find(v => v.year === snapped.year);
        if (pt && Math.abs(my - y(pt.value)) < minDist) {
          minDist = Math.abs(my - y(pt.value));
          closestIdx = i;
        }
      });

      paths.forEach((p, i) =>
        p.attr("stroke-width", i === closestIdx ? 4 : 1.5).attr("opacity", i === closestIdx ? 1 : 0.2)
      );

      const activePt = series[closestIdx].values.find(v => v.year === snapped.year);
      dot.style("display", null)
        .attr("cx", x(activePt.year)).attr("cy", y(activePt.value))
        .attr("stroke", series[closestIdx].color);

      const s = series[closestIdx];
      d3.select("#mapTooltip").classed("hidden", false)
        .style("left", `${event.clientX + 14}px`)
        .style("top",  `${event.clientY + 14}px`)
        .html(`<strong>${stateName}</strong><br>Year: ${snapped.year}<br>${s.label}: ${s.fmt(activePt.raw)}`);
    })
    .on("mouseleave", function() {
      paths.forEach(p => p.attr("stroke-width", null).attr("opacity", null));
      dot.style("display", "none");
      d3.select("#mapTooltip").classed("hidden", true);
    });

  legend(svg, series, m.left, m.top - 20);
  label(svg, "Normalized (0–1 within each variable)", m.left, m.top + 16);
}

function drawSlide3Chart(data) {
  const svg = d3.select("#slide3Chart"); svg.selectAll("*").remove();
  const { w, h, m } = box(svg, 900, 430);
  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([m.left, w - m.right]);
  const y = d3.scaleLinear().domain(d3.extent(data, (d) => d.tas_anomaly)).nice().range([h - m.bottom, m.top]);
  const zero = y(0);
  const barW = (w - m.left - m.right) / data.length;

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d > 0 ? "+" : ""}${d.toFixed(2)} °C`));
  svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.left - m.right)).tickFormat("")).selectAll("line").attr("class", "grid-line");

  svg.append("defs").append("clipPath").attr("id", "slide3Clip")
    .append("rect").attr("x", m.left).attr("y", m.top)
    .attr("width", w - m.left - m.right).attr("height", h - m.top - m.bottom);

  svg.append("g").attr("clip-path", "url(#slide3Clip)")
    .selectAll("rect.bar").data(data).join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.year) - barW / 2)
    .attr("width", Math.max(barW - 0.5, 1))
    .attr("y", (d) => d.tas_anomaly >= 0 ? y(d.tas_anomaly) : zero)
    .attr("height", (d) => Math.abs(y(d.tas_anomaly) - zero))
    .attr("fill", (d) => d.tas_anomaly >= 0 ? "#e53935" : "#2196f3");

  svg.append("line")
    .attr("x1", m.left).attr("x2", w - m.right).attr("y1", zero).attr("y2", zero)
    .attr("stroke", "#333").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");

  label(svg, "Temperature anomaly relative to 1850–1900 baseline", m.left, m.top - 10);
}

function drawSlide4Chart(data) {
  const svg = d3.select("#slide4Chart");
  const { w, h, m } = box(svg, 900, 430);
  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.year)).range([m.left, w - m.right]);
  const series = [
    { key: "od550aer", label: "od550aer", color: "#f6ae2d" },
    { key: "tas_c",    label: "temperature (°C)", color: "#e53935" },
  ].map((s) => {
    const sc = d3.scaleLinear().domain(d3.extent(data, (d) => d[s.key])).range([0, 1]);
    return { ...s, values: data.map((d) => ({ year: d.year, value: sc(d[s.key]) })) };
  });
  const y = d3.scaleLinear().domain([0, 1]).range([h - m.bottom, m.top]);
  axes(svg, x, y, w, h, m, true);
  const lineGen = d3.line().x((d) => x(d.year)).y((d) => y(d.value)).curve(d3.curveMonotoneX);
  const bisect = d3.bisector((d) => d.year).left;
  const paths = series.map((s) =>
    svg.append("path").datum(s.values).attr("class", "line").attr("stroke", s.color).attr("d", lineGen)
  );
  legend(svg, series, m.left, m.top - 18);
  label(svg, "Normalized (0–1 within each variable)", m.left, m.top + 22);
  svg.append("rect")
    .attr("x", m.left).attr("y", m.top)
    .attr("width", w - m.left - m.right).attr("height", h - m.top - m.bottom)
    .attr("fill", "none").attr("pointer-events", "all")
    .on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event);
      const year = x.invert(mx);
      let minDist = Infinity, closestIdx = 0;
      series.forEach((s, i) => {
        const idx = bisect(s.values, year, 1);
        const d0 = s.values[idx - 1], d1 = s.values[idx];
        const val = d1 ? d0.value + (year - d0.year) / (d1.year - d0.year) * (d1.value - d0.value) : d0.value;
        const dist = Math.abs(my - y(val));
        if (dist < minDist) { minDist = dist; closestIdx = i; }
      });
      paths.forEach((p, i) => p.attr("stroke-width", i === closestIdx ? 4 : 1.5).attr("opacity", i === closestIdx ? 1 : 0.2));
    })
    .on("mouseleave", () => paths.forEach((p) => p.attr("stroke-width", null).attr("opacity", null)));
}

// D3 chart helpers
function axes(svg, x, y, w, h, m, yearTicks) {
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.bottom})`).call(d3.axisBottom(x).ticks(6).tickFormat(yearTicks ? d3.format("d") : undefined));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.left - m.right)).tickFormat("")).selectAll("line").attr("class", "grid-line");
}
function box(svg, w = 620, h = 340) { svg.attr("viewBox", `0 0 ${w} ${h}`); return { w, h, m: { top: 44, right: 28, bottom: 48, left: 64 } }; }
function label(svg, text, x, y, anchor = "start") { svg.append("text").attr("class", "chart-label").attr("x", x).attr("y", y).attr("text-anchor", anchor).text(text); }
function legend(svg, items, x, y) { const g = svg.append("g").attr("class", "legend").attr("transform", `translate(${x},${y})`); items.forEach((s, i) => { const e = g.append("g").attr("transform", `translate(${i * 150},0)`); e.append("circle").attr("r", 5).attr("fill", s.color); e.append("text").attr("x", 12).attr("y", 4).text(s.label); }); }
function corr(a, b) { const ma = d3.mean(a), mb = d3.mean(b); const num = d3.sum(a, (v, i) => (v - ma) * (b[i] - mb)); const den = Math.sqrt(d3.sum(a, (v) => (v - ma) ** 2) * d3.sum(b, (v) => (v - mb) ** 2)); return den ? num / den : 0; }
function showTooltip(event, html, container) { d3.select(container || "#tooltip").classed("hidden", false).style("left", `${event.offsetX + 14}px`).style("top", `${event.offsetY + 14}px`).html(html); }
function hideTooltip(container) { d3.select(container || "#tooltip").classed("hidden", true); }