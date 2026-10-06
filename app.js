/* Porto itinerary — renders trip.json into the page.
   No build step, no dependencies. Edit trip.json, reload. */

(function () {
  "use strict";

  const KIND_LABEL = { eat: "Eat", see: "See", move: "Move", rest: "Rest", shop: "Shop" };
  const KIND_ICON = { eat: "i-eat", see: "i-see", move: "i-move", rest: "i-rest", shop: "i-shop" };
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ---------- helpers -----------------------------------------------------

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const mapsUrl = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

  const routeUrl = (fromQ, toQ, mode) =>
    "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(fromQ) +
    "&destination=" + encodeURIComponent(toQ) + "&travelmode=" + (mode || "walking");

  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;

  function longDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return `${DAY_NAMES[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
  }

  // Current date + minutes-since-midnight in the trip's timezone.
  function nowIn(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value;
      const hour = Number(get("hour")) % 24;
      return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: hour * 60 + Number(get("minute")) };
    } catch {
      return null;
    }
  }

  const toMinutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

  // ---------- hero ---------------------------------------------------------

  function renderHero(trip) {
    document.getElementById("hero-dates").textContent = trip.dates;
    document.getElementById("hero-title").textContent = trip.title;
    document.getElementById("hero-lede").textContent = trip.lede;

    const base = trip.base;
    const card = document.getElementById("base-card");
    card.href = mapsUrl(base.q);
    document.getElementById("base-label").textContent = `${base.label} · ${base.name}`;
    document.getElementById("base-address").textContent = base.address;
    document.getElementById("base-note").textContent = base.note;

    document.getElementById("facts").innerHTML = trip.facts
      .map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("");
  }

  // ---------- tabs -----------------------------------------------------------

  function renderTabs(trip, panels) {
    const list = document.getElementById("tablist");
    const items = trip.days.map((d) => ({ id: d.id, day: d.short, label: d.tab }))
      .concat([{ id: "extras", day: "Before you go", label: "Bookings & more" }]);

    list.innerHTML = items.map((t) => `
      <button class="tab" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="false" tabindex="-1" data-id="${t.id}">
        <span class="tab__day">${esc(t.day)}</span>
        <span class="tab__label">${esc(t.label)}</span>
      </button>`).join("");

    const tabs = Array.from(list.querySelectorAll(".tab"));
    const nav = list.closest(".tabs");

    // Keep the active tab centred in the strip. Horizontal only — scrollIntoView()
    // would also nudge the window vertically, which fights the panel scroll below.
    function revealTab(tab, smooth) {
      const tr = tab.getBoundingClientRect();
      const lr = list.getBoundingClientRect();
      const left = list.scrollLeft + (tr.left - lr.left) - (lr.width - tr.width) / 2;
      list.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    }

    // Start the newly selected day from its top: if the reader was already scrolled
    // past where the panel begins (e.g. deep in the previous day), jump so the day
    // header sits just under the sticky tab bar. Never scroll *down* — when the hero
    // is still on screen the panel already starts right below the tabs.
    function scrollToPanelTop(panel) {
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - navH - 16);
      if (window.scrollY <= top) return;
      const root = document.documentElement;
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto"; // instant jump; the stylesheet asks for smooth scrolling elsewhere
      window.scrollTo(0, top);
      root.style.scrollBehavior = prev;
    }

    function select(id, { pushHash = true, focus = false, scroll = true } = {}) {
      if (!panels.has(id)) id = items[0].id;
      tabs.forEach((t) => {
        const on = t.dataset.id === id;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (on) {
          revealTab(t, scroll);
          if (focus) t.focus({ preventScroll: true });
        }
      });
      panels.forEach((panel, pid) => { panel.hidden = pid !== id; });
      if (pushHash && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
      const panel = panels.get(id);
      if (scroll) scrollToPanelTop(panel);
      // restart the stagger animation
      panel.querySelectorAll(".stop").forEach((s) => { s.style.animation = "none"; void s.offsetWidth; s.style.animation = ""; });
    }

    tabs.forEach((t) => t.addEventListener("click", () => select(t.dataset.id)));
    list.addEventListener("keydown", (e) => {
      const i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
      if (e.key === "ArrowRight") { e.preventDefault(); select(tabs[(i + 1) % tabs.length].dataset.id, { focus: true }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); select(tabs[(i - 1 + tabs.length) % tabs.length].dataset.id, { focus: true }); }
      if (e.key === "Home") { e.preventDefault(); select(tabs[0].dataset.id, { focus: true }); }
      if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1].dataset.id, { focus: true }); }
    });
    // Only react to hashes that name a panel; other anchors (the footer's "#top") must not change the tab.
    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if (panels.has(id)) select(id, { pushHash: false });
    });
    return select;
  }

  // ---------- days -------------------------------------------------------------

  function renderStop(stop, i, prev, day, trip, now) {
    const kind = stop.kind || "see";
    const reel = stop.reel ? trip.reels[String(stop.reel)] : null;

    let state = "";
    if (now && now.date === day.date) {
      const start = toMinutes(stop.time);
      const nextStart = day.stops[i + 1] ? toMinutes(day.stops[i + 1].time) : 24 * 60;
      if (now.minutes >= nextStart) state = "is-past";
      else if (now.minutes >= start) state = "is-now";
    }

    const chips = [
      `<span class="chip chip--kind">${icon(KIND_ICON[kind] || "i-see")}${KIND_LABEL[kind] || kind}</span>`,
      reel ? `<a class="chip chip--reel" href="${esc(reel.url)}" target="_blank" rel="noopener" title="Reel ${stop.reel}: ${esc(reel.about)} — ${esc(reel.by)}">${icon("i-ig")}IG Reel</a>` : "",
      stop.optional ? `<span class="chip chip--opt">Optional</span>` : "",
      state === "is-now" ? `<span class="chip chip--now">Now</span>` : "",
    ].join("");

    const actions = [];
    if (stop.q) {
      actions.push(`<a class="btn btn--primary" href="${mapsUrl(stop.q)}" target="_blank" rel="noopener">${icon("i-pin")} Open in Maps</a>`);
      if (prev && prev.q && prev.q !== stop.q) {
        actions.push(`<a class="btn btn--ghost" href="${routeUrl(prev.q, stop.q, stop.travel)}" target="_blank" rel="noopener" title="Directions from ${esc(prev.name)}">${icon("i-route")} Route from previous</a>`);
      }
    }

    return `
      <li class="stop stop--${esc(kind)} ${state}" style="--i:${i}" id="${day.id}-${i}">
        <div class="stop__time"><time datetime="${day.date}T${stop.time}">${stop.time}</time></div>
        <div class="stop__rail"><span class="stop__dot"></span></div>
        <article class="stop__card">
          <div class="stop__meta">${chips}</div>
          <h3 class="stop__name">${esc(stop.name)}</h3>
          ${stop.what ? `<p class="stop__what">${esc(stop.what)}</p>` : ""}
          ${stop.why ? `<p class="stop__why"><span class="label">Why now</span>${esc(stop.why)}</p>` : ""}
          ${stop.book ? `<p class="stop__book">${icon("i-book")}<span>${esc(stop.book)}</span></p>` : ""}
          ${stop.logistics ? `<details class="stop__more"><summary>Logistics ${icon("i-chevron")}</summary><p>${esc(stop.logistics)}</p></details>` : ""}
          ${actions.length ? `<div class="stop__actions">${actions.join("")}</div>` : ""}
        </article>
      </li>`;
  }

  function renderDay(day, trip, now) {
    const section = document.createElement("section");
    section.className = "day";
    section.id = `panel-${day.id}`;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", `tab-${day.id}`);
    section.hidden = true;

    const isToday = now && now.date === day.date;
    const stops = day.stops.map((s, i) => renderStop(s, i, i ? day.stops[i - 1] : null, day, trip, now)).join("");

    const alts = day.alternates?.length ? `
      <aside class="alts">
        <h3>If plans slip</h3>
        <ul>${day.alternates.map((a) => {
          const reel = trip.reels[String(a.reel)];
          return `<li><a href="${mapsUrl(a.q)}" target="_blank" rel="noopener">${esc(a.name)}</a> — ${esc(a.note)}${reel ? ` <a href="${esc(reel.url)}" target="_blank" rel="noopener" title="Reel ${a.reel}: ${esc(reel.about)} — ${esc(reel.by)}">IG reel</a>` : ""}</li>`;
        }).join("")}</ul>
      </aside>` : "";

    section.innerHTML = `
      <header class="day__head">
        <p class="day__date">${esc(longDate(day.date))}</p>
        <h2 class="day__title">${esc(day.title)}</h2>
        <p class="day__intro">${esc(day.intro)}</p>
        ${isToday ? `<p class="day__today">Today — times in Porto</p>` : ""}
      </header>
      <ol class="timeline">${stops}</ol>
      ${alts}`;
    return section;
  }

  // ---------- extras -----------------------------------------------------------

  function renderExtras(trip) {
    const section = document.createElement("section");
    section.className = "day";
    section.id = "panel-extras";
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", "tab-extras");
    section.hidden = true;

    const storeKey = "porto-bookings-v1";
    let done = {};
    try { done = JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { done = {}; }

    const bookings = trip.bookings.map((b) => {
      // `booked: true` in trip.json = confirmed already; shown ticked and locked on every device.
      const isDone = Boolean(b.booked || done[b.id]);
      const linkText = b.booked ? "confirmation" : "book";
      return `
      <li class="${isDone ? "done" : ""}${b.booked ? " booked" : ""}" data-id="${esc(b.id)}">
        <input type="checkbox" id="bk-${esc(b.id)}" ${isDone ? "checked" : ""} ${b.booked ? "disabled" : ""}>
        <label for="bk-${esc(b.id)}">
          <span class="what">${esc(b.what)}${b.link ? ` · <a href="${esc(b.link)}" target="_blank" rel="noopener">${linkText}</a>` : ""}</span>
          <span class="when">${esc(b.when)}</span>
        </label>
        <span class="for">${esc(b.for)}</span>
      </li>`;
    }).join("");

    const walking = trip.walking.map((w) => `<li><span>${esc(w.place)}</span><span>${w.min} min</span></li>`).join("");

    const bench = trip.bench.map((b) => {
      const reel = trip.reels[String(b.reel)];
      return `<li><strong>${esc(b.name)}</strong> — ${esc(b.why)}${reel ? ` <a href="${esc(reel.url)}" target="_blank" rel="noopener" title="Reel ${b.reel}: ${esc(reel.about)} — ${esc(reel.by)}">IG reel</a>` : ""}</li>`;
    }).join("");

    const reels = Object.entries(trip.reels).map(([n, r]) => `
      <li><a href="${esc(r.url)}" target="_blank" rel="noopener">${icon("i-ig")}<span class="n">${n}</span><span>${esc(r.about)} <span class="by">${esc(r.by)}</span></span></a></li>`).join("");

    const planBReel = trip.reels[String(trip.planB.reel)];

    section.innerHTML = `
      <header class="day__head">
        <p class="day__date">Before you go</p>
        <h2 class="day__title">Bookings, distances, and what didn't fit</h2>
        <p class="day__intro">Tick things off as you book them — this list remembers on your device.</p>
      </header>

      <div class="extra">
        <h3>Booking checklist</h3>
        <ul class="checklist" id="checklist">${bookings}</ul>
        <p>${esc(trip.noBooking)}</p>
      </div>

      <div class="extra">
        <h3>${esc(trip.planB.title)}</h3>
        <p>${esc(trip.planB.text)}${planBReel ? ` <a href="${esc(planBReel.url)}" target="_blank" rel="noopener" title="Reel ${trip.planB.reel}: ${esc(planBReel.about)} — ${esc(planBReel.by)}">IG reel</a>` : ""}</p>
      </div>

      <div class="extra">
        <h3>Walking times from the flat</h3>
        <ul class="walk">${walking}</ul>
      </div>

      <div class="extra">
        <h3>Saved spots that didn't make the cut</h3>
        <ul class="bench">${bench}</ul>
      </div>

      <div class="extra">
        <h3>The thirteen reels</h3>
        <ul class="reels">${reels}</ul>
      </div>`;

    section.querySelector("#checklist").addEventListener("change", (e) => {
      const li = e.target.closest("li");
      if (!li) return;
      done[li.dataset.id] = e.target.checked;
      li.classList.toggle("done", e.target.checked);
      try { localStorage.setItem(storeKey, JSON.stringify(done)); } catch { /* private mode */ }
    });

    return section;
  }

  // ---------- boot ---------------------------------------------------------------

  async function boot() {
    const main = document.getElementById("main");
    let trip;
    try {
      const res = await fetch("trip.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      trip = await res.json();
    } catch (err) {
      main.innerHTML = `<p class="noscript">Couldn't load <code>trip.json</code> (${esc(err.message)}). If you opened this file directly, serve the folder over HTTP instead.</p>`;
      return;
    }

    renderHero(trip);
    const now = nowIn(trip.timezone);

    const panels = new Map();
    trip.days.forEach((d) => { const p = renderDay(d, trip, now); panels.set(d.id, p); main.appendChild(p); });
    const extras = renderExtras(trip); panels.set("extras", extras); main.appendChild(extras);

    const select = renderTabs(trip, panels);

    // Default tab: the hash if present, else today's day during the trip, else the first day.
    // No scrolling on first paint — the hero should stay in view.
    const fromHash = location.hash.slice(1);
    const today = now ? trip.days.find((d) => d.date === now.date)?.id : null;
    select(fromHash || today || trip.days[0].id, { pushHash: false, scroll: false });
  }

  boot();
})();
