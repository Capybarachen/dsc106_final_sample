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
  if (typeof initSlide6 === "function") initSlide6();
});

function loadData() {
  Promise.all([
    d3.csv("global_yearly.csv", d => ({ year: +d.year, od550aer: +d.od550aer, tas_c: +d.tas_c, tas_anomaly: +d.tas_anomaly })),
    d3.csv("state_annual_climate.csv", d => ({ year: +d.year, state: d.state, od550aer: +d.od550aer, co2_ppm: +d.co2_ppm, tas_c: +d.tas_c })),
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
  ]).then(([data, stateData, usGeo]) => {

    initScrollyTelling(data);
    initStateMapSlide(stateData, usGeo);
  });
}

function initScrollyTelling(globalData) {
  const steps = document.querySelectorAll(".scrolly-step");
  const rangeTitle = document.getElementById("slide3YearRange");

  function activateStep(step) {
    steps.forEach(s => s.classList.remove("active"));
    step.classList.add("active");
    const start = +step.dataset.start;
    const end   = +step.dataset.end;
    rangeTitle.textContent = `${start}–${end}`;
    drawSlide3Chart(globalData.filter(d => d.year >= start && d.year <= end));
  }

  if (steps.length) activateStep(steps[0]);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) activateStep(entry.target);
    });
  }, {
    root: document.getElementById("temp-scrolly-slide"),
    threshold: 0.5,
  });

  steps.forEach(step => observer.observe(step));
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
let _stateSummaryLookup = {};
let _usSummary = {};
let _mapColorScale = null;
let _currentMapYear = 1980;
const climateStories = {

1957:{
title:"Before Rapid Warming",
text:"In the late 1950s, the strong nationwide warming seen today had not yet emerged. This year serves as a reference point before decades of greenhouse gas accumulation."
},

1980:{
title:"1980 U.S. Heat Wave",
text:"A major heat wave and drought affected large parts of the United States, causing agricultural losses and highlighting climate vulnerability."
},

1989:{
title:"Global Warming Enters Public Debate",
text:"Following the exceptionally warm years of the late 1980s, scientists increasingly linked rising temperatures to greenhouse gases. Warming became visible across many eastern and central states."
},

2006:{
title:"Greenhouse Gas Accumulation",
text:"By 2006, atmospheric CO₂ concentrations had risen above 380 ppm, increasing heat retention in the climate system. Strong warming became visible across much of the United States, particularly in northern and eastern states."
},

2013:{
title:"Record Long-Term Warming",
text:"By 2013, nearly every state showed warming relative to 1960. Several northern states exceeded +3°C warming, reflecting the long-term accumulation of greenhouse gases in the atmosphere."
}

};

document
  .querySelectorAll(".timeline-marker")
  .forEach(marker => {

    const year = Number(marker.dataset.year);

    const pct =
      ((year - 1950) / (2014 - 1950)) * 100;

    marker.style.left = `${pct}%`;

});

function initStateMapSlide(stateData, usGeo) {
  _stateClimateData = stateData;
  computeStateSummaries(stateData);
  const stateSet = new Set(stateData.map(d => d.state));
  const states = topojson.feature(usGeo, usGeo.objects.states);

  states.features.forEach(f => {
    _stateFeatureMap[String(f.id).padStart(2, "0")] = f;
  });

  stateData.forEach(d => {
    if (!_stateYearLookup[d.state]) _stateYearLookup[d.state] = {};
    _stateYearLookup[d.state][d.year] = d;
  });

  _mapColorScale =
    d3.scaleDiverging()
      .domain([3, 0, -2])
      .interpolator(d3.interpolateRdBu)
      .clamp(true);

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
      const row = (_stateYearLookup[name] || {})[_currentMapYear];
      const base = (_stateYearLookup[name] || {})[1960];

      const html = row && base
        ? `<strong>${name}</strong><br>
          Year: ${_currentMapYear}<br>
          Temp change since 1960: ${(row.tas_c - base.tas_c >= 0 ? "+" : "")}${(row.tas_c - base.tas_c).toFixed(2)} °C<br>
          Actual temp: ${row.tas_c.toFixed(2)} °C<br>
          Aerosol: ${row.od550aer.toFixed(4)}<br>
          CO₂: ${row.co2_ppm.toFixed(1)} ppm`
        : `<strong>${name}</strong><br>No data`;
      d3.select("#mapTooltip").classed("hidden", false)
        .style("left", `${event.clientX + 14}px`)
        .style("top",  `${event.clientY + 14}px`)
        .html(html);
    })
    .on("mouseout", function() {
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

    renderWarmingRankLists();

    updateClimateStory();

    updateTimelineMarkers();

  });

  document.getElementById("backToMapBtn").addEventListener("click", backToMap);
  backToMap();

  updateMapColors();

  renderWarmingRankLists();

  updateClimateStory();

  updateTimelineMarkers();
}

function updateClimateStory(){

  const content =
    document.getElementById("storyContent");

  const yearBox =
    document.getElementById("storyYear");

  const story =
    climateStories[_currentMapYear];

  if(!story){

    yearBox.innerHTML = "";

    content.innerHTML =
      "Move the timeline to explore important climate milestones.";

    return;
  }

  yearBox.innerHTML =
    `<div class="story-year">${_currentMapYear}</div>`;

  content.innerHTML = `
    <strong>${story.title}</strong>
    <br><br>
    ${story.text}
  `;
}

function updateTimelineMarkers(){

  d3.selectAll(".timeline-marker")
    .classed("active-marker", false);

  d3.select(`.timeline-marker[data-year="${_currentMapYear}"]`)
    .classed("active-marker", true);
}

function mean(arr, key) {
  return d3.mean(arr, d => d[key]);
}

function computeStateSummaries(stateData) {
  const START = 1960;
  const END = 2014;
  const WINDOW = 3;

  const summaries = [];

  d3.groups(stateData, d => d.state).forEach(([state, rows]) => {
    const data = rows
      .filter(d => d.year >= START && d.year <= END)
      .sort((a, b) => d3.ascending(a.year, b.year));

    if (data.length < 6) return;

    const first = data[0];
    const last = data[data.length - 1];

    const deltaTemp = last.tas_c - first.tas_c;
    const deltaAod = last.od550aer - first.od550aer;
    const deltaCo2 = last.co2_ppm - first.co2_ppm;

    summaries.push({
      state,
      deltaTemp,
      deltaAod,
      deltaCo2
    });
  });

  const usAvgTemp = d3.mean(summaries, d => d.deltaTemp);
  const usAvgAod = d3.mean(summaries, d => d.deltaAod);
  const maxTemp = d3.max(summaries, d => Math.abs(d.deltaTemp));
  const maxAod = d3.max(summaries, d => Math.abs(d.deltaAod));

  summaries
    .sort((a, b) => d3.descending(a.deltaTemp, b.deltaTemp))
    .forEach((d, i) => {
      d.tempRank = i + 1;
      d.nStates = summaries.length;
      d.warmerThanPct = ((summaries.length - d.tempRank) / (summaries.length - 1)) * 100;
      d.usAvgTemp = usAvgTemp;
      d.usAvgAod = usAvgAod;
      d.maxTemp = maxTemp;
      d.maxAod = maxAod;
      _stateSummaryLookup[d.state] = d;
    });

  _usSummary = { usAvgTemp, usAvgAod, maxTemp, maxAod };
}


function updateMapColors() {
  d3.selectAll("path.us-state").attr("fill", d => {
    const name = FIPS_TO_STATE[String(d.id).padStart(2, "0")];

    const row = (_stateYearLookup[name] || {})[_currentMapYear];
    const base = (_stateYearLookup[name] || {})[1960];

    if (!row || !base) return "#ccc";

    const tempChange = row.tas_c - base.tas_c;

    return _mapColorScale(tempChange);
  });
}

function renderWarmingRankLists() {
  const rows = Object.keys(_stateYearLookup)
    .map(state => {
      const row = (_stateYearLookup[state] || {})[_currentMapYear];
      const base = (_stateYearLookup[state] || {})[1960];

      if (!row || !base) return null;

      return {
        state,
        tempChange: row.tas_c - base.tas_c
      };
    })
    .filter(d => d && Number.isFinite(d.tempChange))
    .sort((a, b) => d3.descending(a.tempChange, b.tempChange));

  const top = rows.slice(0, 5);
  const slow = rows.slice(-5).reverse();

  d3.select("#rankNote")
    .text(`Temperature change from 1960 to ${_currentMapYear}.`);

  d3.select("#topWarmingList")
    .selectAll("li")
    .data(top)
    .join("li")
    .html(d => `
      <span>${d.state}</span>
      <strong>${fmtSigned(d.tempChange, 2, "°C")}</strong>
    `);

  d3.select("#slowWarmingList")
    .selectAll("li")
    .data(slow)
    .join("li")
    .html(d => `
      <span>${d.state}</span>
      <strong>${fmtSigned(d.tempChange, 2, "°C")}</strong>
    `);
}

function showStateDetail(stateName, fips) {
  const stateData = _stateClimateData.filter(d => d.state === stateName);
  const summary = _stateSummaryLookup[stateName];

  const mapView = document.getElementById("mapOverview");
  const detailView = document.getElementById("stateDetailView");

  document.getElementById("stateMapHeading").textContent = stateName;
  document.getElementById("backToMapBtn").style.display = "inline-block";

  document.getElementById("stateNarrativePane").innerHTML = makeStateNarrative(summary);
  renderStateSummary(summary);
  drawStateComboChart(stateData, stateName);

  mapView.style.opacity = "0";

  setTimeout(() => {
    mapView.style.display = "none";
    mapView.style.opacity = "1";

    detailView.style.opacity = "0";
    detailView.style.display = "grid";

    const attrSection = document.getElementById("stateAttributionSection");
    attrSection.style.opacity = "0";
    attrSection.style.display = "block";

    requestAnimationFrame(() => requestAnimationFrame(() => {
      detailView.style.opacity = "1";
      attrSection.style.opacity = "1";
      if (typeof updateSlide6 === "function") updateSlide6(stateName);
    }));
  }, 300);
}

function backToMap() {
  const mapView = document.getElementById("mapOverview");
  const detailView = document.getElementById("stateDetailView");
  document.getElementById("backToMapBtn").style.display = "none";
  document.getElementById("stateMapHeading").textContent = "Select a State";

  if (detailView.style.display !== "grid") {
    // Initial setup — skip animation
    mapView.style.display = "block";
    mapView.style.opacity = "1";
    detailView.style.display = "none";
    return;
  }

  // Fade detail out, then swap views and fade map in
  detailView.style.opacity = "0";
  const attrSection = document.getElementById("stateAttributionSection");
  if (attrSection) attrSection.style.opacity = "0";
  setTimeout(() => {
    detailView.style.display = "none";
    detailView.style.opacity = "1";
    if (attrSection) { attrSection.style.display = "none"; attrSection.style.opacity = "1"; }
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
  const W = 620, H = 360, m = { top: 50, right: 28, bottom: 46, left: 64 };
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
  const svg = d3.select("#slide3Chart");
  const W = 900, H = 430, m = { top: 44, right: 28, bottom: 48, left: 82 };
  const isInit = !svg.select(".s3-bars").empty();

  if (!isInit) {
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    svg.append("defs").append("clipPath").attr("id", "slide3Clip")
      .append("rect").attr("x", m.left).attr("y", m.top)
      .attr("width", W - m.left - m.right).attr("height", H - m.top - m.bottom);
    svg.append("g").attr("class", "s3-grid axis").attr("transform", `translate(${m.left},0)`);
    svg.append("g").attr("class", "s3-x-axis axis").attr("transform", `translate(0,${H - m.bottom})`);
    svg.append("g").attr("class", "s3-y-axis axis").attr("transform", `translate(${m.left},0)`);
    svg.append("g").attr("class", "s3-bars").attr("clip-path", "url(#slide3Clip)");
    svg.append("line").attr("class", "s3-zero")
      .attr("stroke", "#333").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");
    svg.append("text").attr("class", "chart-label").attr("x", W / 2).attr("y", H - 8).attr("text-anchor", "middle").text("Year");
    svg.append("text").attr("class", "chart-label").attr("transform", "rotate(-90)")
      .attr("x", -(H / 2)).attr("y", 14).attr("text-anchor", "middle").text("Temperature Anomaly (°C)");
  }

  const t = d3.transition().duration(650).ease(d3.easeCubicInOut);
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([m.left, W - m.right]);
  const y = d3.scaleLinear().domain(d3.extent(data, d => d.tas_anomaly)).nice().range([H - m.bottom, m.top]);
  const zero = y(0);
  const barW = (W - m.left - m.right) / data.length;

  svg.select(".s3-x-axis").transition(t).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
  svg.select(".s3-y-axis").transition(t).call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d > 0 ? "+" : ""}${d.toFixed(2)} °C`));
  svg.select(".s3-grid").transition(t)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.left - m.right)).tickFormat(""))
    .selectAll("line").attr("class", "grid-line");
  svg.select(".s3-zero").transition(t)
    .attr("x1", m.left).attr("x2", W - m.right).attr("y1", zero).attr("y2", zero);

  svg.select(".s3-bars")
    .selectAll("rect.bar")
    .data(data, d => d.year)
    .join(
      enter => enter.append("rect").attr("class", "bar")
        .attr("fill", d => d.tas_anomaly >= 0 ? "#e53935" : "#2196f3")
        .attr("x", W - m.right)
        .attr("width", Math.max(barW - 0.5, 1))
        .attr("y", d => d.tas_anomaly >= 0 ? y(d.tas_anomaly) : zero)
        .attr("height", d => Math.abs(y(d.tas_anomaly) - zero))
        .call(e => e.transition(t).attr("x", d => x(d.year) - barW / 2)),
      update => update.call(u => u.transition(t)
        .attr("x", d => x(d.year) - barW / 2)
        .attr("width", Math.max(barW - 0.5, 1))
        .attr("y", d => d.tas_anomaly >= 0 ? y(d.tas_anomaly) : zero)
        .attr("height", d => Math.abs(y(d.tas_anomaly) - zero))),
      exit => exit.call(e => e.transition(t).attr("x", W - m.right).remove())
    );
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
function showTooltip(event, html, container) { d3.select(container || "#tooltip").classed("hidden", false).style("left", `${event.clientX + 14}px`).style("top", `${event.clientY + 14}px`).html(html); }
function hideTooltip(container) { d3.select(container || "#tooltip").classed("hidden", true); }


function makeStateNarrative(s) {

  const tempLevel =
    s.deltaTemp > s.usAvgTemp + 0.25 ? "above" :
    s.deltaTemp < s.usAvgTemp - 0.25 ? "below" :
    "near";

  const aerosolText =
    s.deltaAod > 0.015 ? "increased" :
    s.deltaAod < -0.015 ? "decreased" :
    "changed only slightly";

  let story = "";

  if (tempLevel === "above") {

    story = `
      <p>${s.state} warmed faster than ${s.warmerThanPct.toFixed(0)}% of U.S. states between 1960 and 2014.</p>

      <p>Although aerosol levels ${aerosolText}, the warming trend remained stronger than the national average.</p>

      <p>This suggests that factors beyond aerosol changes may also contribute to regional temperature differences.</p>
    `;

  } else if (tempLevel === "below") {

    story = `
      <p>${s.state} warmed more slowly than most U.S. states between 1960 and 2014.</p>

      <p>Aerosol levels ${aerosolText}, while CO₂ continued to rise over the same period.</p>

      <p>This suggests that regional warming patterns cannot be explained by one variable alone.</p>
    `;

  } else {

    story = `
      <p>${s.state} followed a temperature trend close to the U.S. average.</p>

      <p>Aerosol levels ${aerosolText}, while CO₂ rose steadily over time.</p>

      <p>This makes ${s.state} a useful comparison case.</p>
    `;
  }

  return `
    <div class="rank-card">

      <div class="rank-number">
        #${s.tempRank}
      </div>

      <div class="rank-title">
        Warming Rank
      </div>

      <div class="rank-subtitle">
        among ${s.nStates} U.S. states
      </div>

      <div class="rank-percentile">
        Warmer than ${s.warmerThanPct.toFixed(0)}%
        of U.S. states
      </div>

    </div>

    ${story}
  `;
}

function fmtSigned(v, digits = 2, suffix = "") {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}${suffix}`;
}

function barWidth(value, maxValue) {
  if (!maxValue || maxValue === 0) return 0;
  return Math.max(4, Math.abs(value) / maxValue * 100);
}

function makeComparisonRows(stateName, stateValue, usValue, maxValue, digits, suffix) {
  return `
    <div class="bar-row">
      <div class="bar-label">${stateName}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${barWidth(stateValue, maxValue)}%"></div>
      </div>
      <div class="bar-value">${fmtSigned(stateValue, digits, suffix)}</div>
    </div>

    <div class="bar-row">
      <div class="bar-label">U.S. avg</div>
      <div class="bar-track us">
        <div class="bar-fill" style="width:${barWidth(usValue, maxValue)}%"></div>
      </div>
      <div class="bar-value">${fmtSigned(usValue, digits, suffix)}</div>
    </div>
  `;
}

function renderStateSummary(s) {
  document.getElementById("stateSummaryPane").innerHTML = `
    <h4>Temperature Rank</h4>

    <div class="kpi-card">
      <div class="kpi-title">Temperature Change</div>
      <div class="kpi-value">${fmtSigned(s.deltaTemp, 2, "°C")}</div>
      ${makeComparisonRows(
        s.state,
        s.deltaTemp,
        s.usAvgTemp,
        s.maxTemp,
        2,
        "°C"
      )}
    </div>

    <div class="kpi-card">
      <div class="kpi-title">Aerosol Change</div>
      <div class="kpi-value">${fmtSigned(s.deltaAod, 3)}</div>
      ${makeComparisonRows(
        s.state,
        s.deltaAod,
        s.usAvgAod,
        s.maxAod,
        3,
        ""
      )}
    </div>

    <p class="summary-note">
      Δ = 2014 value minus 1960 value.
    </p>
  `;
}