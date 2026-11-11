/* ==========================================================
   extras.js — Daily check-in bubble + Sign-up roster
   Data is saved in this browser (localStorage).
   ========================================================== */
(function () {
  const CHECKIN_KEY = "andrea-checkins";
  const ROSTER_KEY = "andrea-roster";

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function niceDate(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  let checkins = load(CHECKIN_KEY, {});
  let roster = load(ROSTER_KEY, []);

  /* ---------- Today's workout from the plan ---------- */
  function todaysPlan() {
    const t = todayISO();
    const days = PLAN.days;
    const hit = days.find(d => d.date === t);
    if (hit) return { day: hit, note: "" };
    if (t < days[0].date) return { day: days[0], note: `Plan starts ${niceDate(days[0].date)}` };
    return { day: null, note: "You've finished the 30 days — great work!" };
  }

  function streak() {
    let n = 0;
    const d = new Date();
    for (;;) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!checkins[iso]) break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  /* ---------- Floating check-in bubble ---------- */
  const bubble = document.createElement("button");
  bubble.className = "checkin-bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-haspopup", "dialog");
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.className = "checkin-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Daily check-in");
  panel.hidden = true;
  document.body.appendChild(panel);

  function paintBubble() {
    const done = !!checkins[todayISO()];
    bubble.classList.toggle("is-done", done);
    bubble.innerHTML = done
      ? `<span class="cb-icon">✓</span><span class="cb-text">Checked in</span>`
      : `<span class="cb-icon">👋</span><span class="cb-text">Daily check-in</span><span class="cb-dot" aria-hidden="true"></span>`;
    bubble.setAttribute("aria-label", done ? "Checked in today — open check-in" : "Open daily check-in");
  }

  function paintPanel() {
    const t = todayISO();
    const entry = checkins[t];
    const { day, note } = todaysPlan();
    const workout = day
      ? `<div class="cp-workout" data-kind="${PLAN.types[day.type].kind}">
           <small>${note || "Today"} · Day ${day.day}</small>
           <strong>${esc(day.type)}</strong>
           <span>${day.minutes} min · ${esc(day.details)}</span>
         </div>`
      : `<div class="cp-workout"><strong>${esc(note)}</strong></div>`;

    const moods = [["💪", "Great"], ["🙂", "Good"], ["😐", "Okay"], ["😮‍💨", "Tired"], ["🤕", "Sore"]];
    const picked = entry ? entry.mood : "";
    const days = Object.keys(checkins).length;

    panel.innerHTML = `
      <div class="cp-head">
        <div><small>${niceDate(t)}</small><h3>Daily check-in</h3></div>
        <button class="cp-close" type="button" aria-label="Close">×</button>
      </div>
      ${workout}
      <p class="cp-q">How are you feeling today?</p>
      <div class="cp-moods">
        ${moods.map(([e, l]) => `<button type="button" class="cp-mood ${picked === l ? "on" : ""}" data-mood="${l}"><span>${e}</span>${l}</button>`).join("")}
      </div>
      <label class="cp-label" for="cpNote">Note (optional)</label>
      <textarea id="cpNote" rows="2" placeholder="e.g. Legs felt strong, did an extra set">${entry ? esc(entry.note) : ""}</textarea>
      <button type="button" class="cp-submit">${entry ? "Update check-in" : "Check in"}</button>
      <div class="cp-stats">
        <span><b>${streak()}</b> day streak</span>
        <span><b>${days}</b> total check-ins</span>
      </div>`;

    let mood = picked;
    panel.querySelectorAll(".cp-mood").forEach(b => b.onclick = () => {
      mood = b.dataset.mood;
      panel.querySelectorAll(".cp-mood").forEach(x => x.classList.toggle("on", x === b));
    });
    panel.querySelector(".cp-close").onclick = closePanel;
    panel.querySelector(".cp-submit").onclick = () => {
      if (!mood) {
        panel.querySelector(".cp-q").classList.add("shake");
        setTimeout(() => panel.querySelector(".cp-q") && panel.querySelector(".cp-q").classList.remove("shake"), 500);
        return;
      }
      checkins[t] = { mood, note: panel.querySelector("#cpNote").value.trim(), at: new Date().toISOString() };
      store(CHECKIN_KEY, checkins);
      paintBubble();
      paintPanel();
      const s = panel.querySelector(".cp-submit");
      s.textContent = "✓ Saved!";
    };
  }

  function openPanel() { paintPanel(); panel.hidden = false; bubble.setAttribute("aria-expanded", "true"); }
  function closePanel() { panel.hidden = true; bubble.setAttribute("aria-expanded", "false"); bubble.focus(); }
  bubble.onclick = () => (panel.hidden ? openPanel() : closePanel());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) closePanel(); });

  paintBubble();

  /* ---------- Sign-up roster ---------- */
  const section = document.createElement("section");
  section.className = "roster";
  section.id = "roster";
  section.innerHTML = `
    <div class="roster-head">
      <h2>Join the challenge</h2>
      <p>Sign up to do the 30-day plan together and keep each other on track.</p>
    </div>
    <div class="roster-grid">
      <form class="roster-form" novalidate>
        <label>Name <input name="name" required maxlength="60" autocomplete="name" placeholder="Your name"></label>
        <label><span>Email <span class="opt">(optional)</span></span> <input name="email" type="email" maxlength="100" autocomplete="email" placeholder="you@example.com"></label>
        <label>Main goal
          <select name="goal">
            <option>Lose weight</option>
            <option>Build strength</option>
            <option>Ride longer</option>
            <option>Stay consistent</option>
          </select>
        </label>
        <button type="submit">Sign me up</button>
        <p class="roster-msg" aria-live="polite"></p>
      </form>
      <div class="roster-list-wrap">
        <div class="roster-count"></div>
        <ol class="roster-list"></ol>
      </div>
    </div>`;
  const footer = document.querySelector("footer");
  footer.parentNode.insertBefore(section, footer);

  const form = section.querySelector(".roster-form");
  const list = section.querySelector(".roster-list");
  const count = section.querySelector(".roster-count");
  const msg = section.querySelector(".roster-msg");

  function paintRoster() {
    count.textContent = roster.length === 1 ? "1 person signed up" : `${roster.length} people signed up`;
    list.innerHTML = roster.length
      ? roster.map((p, i) => `
          <li>
            <span class="avatar" aria-hidden="true">${esc(p.name.trim().charAt(0).toUpperCase())}</span>
            <span class="who"><b>${esc(p.name)}</b><small>${esc(p.goal)} · joined ${new Date(p.joined).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></span>
            <button type="button" class="remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">×</button>
          </li>`).join("")
      : `<li class="empty">No one yet — be the first!</li>`;
    list.querySelectorAll(".remove").forEach(b => b.onclick = () => {
      roster.splice(+b.dataset.i, 1);
      store(ROSTER_KEY, roster);
      paintRoster();
    });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    if (!name) { msg.textContent = "Please enter a name."; msg.className = "roster-msg err"; form.name.focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "That email doesn't look right."; msg.className = "roster-msg err"; form.email.focus(); return; }
    if (roster.some(p => p.name.toLowerCase() === name.toLowerCase())) { msg.textContent = `${name} is already on the roster.`; msg.className = "roster-msg err"; return; }
    roster.push({ name, email, goal: form.goal.value, joined: new Date().toISOString() });
    store(ROSTER_KEY, roster);
    form.reset();
    msg.textContent = `Welcome aboard, ${name}!`;
    msg.className = "roster-msg ok";
    paintRoster();
  });

  paintRoster();

  /* ---------- Rep tracker inside each day's window ---------- */
  const REPS_KEY = "andrea-reps";
  let reps = load(REPS_KEY, {});

  // Targets for each week (index 0 = week 1 ... 3 = week 4+)
  const SETS = [2, 3, 3, 3];
  const REPS = [10, 10, 12, 15];
  const PLANK = [20, 30, 40, 45];

  function exercisesFor(day) {
    const w = Math.min(Math.floor((day.day - 1) / 7), 3);
    const s = SETS[w], r = REPS[w];
    switch (day.type) {
      case "Strength A": return [
        { name: "Squats", sets: s, target: r, unit: "reps" },
        { name: "Push-ups", sets: s, target: r, unit: "reps" },
        { name: "Glute bridges", sets: s, target: r, unit: "reps" },
        { name: "Plank", sets: 3, target: PLANK[w], unit: "sec" }];
      case "Strength B": return [
        { name: "Lunges", sets: s, target: r, unit: "reps" },
        { name: "Rows", sets: s, target: r, unit: "reps" },
        { name: "Step-ups", sets: s, target: r, unit: "reps" },
        { name: "Dead bugs", sets: 3, target: 10, unit: "reps" }];
      case "Rest / active recovery": return [
        { name: "Walk", sets: 1, target: 20, unit: "min" },
        { name: "Stretching", sets: 1, target: 10, unit: "min" }];
      case "Cycling – intervals": {
        const n = [5, 6, 7, 8][w];
        return [
          { name: "Hard intervals", sets: 1, target: n, unit: "rounds" },
          { name: "Ride time", sets: 1, target: day.minutes, unit: "min" },
          { name: "Distance", sets: 1, target: null, unit: "miles" }];
      }
      default: return [
        { name: "Ride time", sets: 1, target: day.minutes, unit: "min" },
        { name: "Distance", sets: 1, target: null, unit: "miles" }];
    }
  }

  function addTracker(body) {
    if (body.querySelector(".replog")) return;
    // add the rest note to "What to do" on strength days
    const what = body.querySelector(".dlg > p, #dlgBody > p");
    if (what && /sets of/.test(what.textContent) && !/30 sec rest/.test(what.textContent)) {
      what.textContent = what.textContent.replace(/\.?\s*$/, "") + ". Take a 30 sec rest between each set.";
    }
    const m = (body.querySelector("small") || {}).textContent || "";
    const n = parseInt((m.match(/Day (\d+)/) || [])[1], 10);
    if (!n) return;
    const day = PLAN.days[n - 1];
    const log = reps[n] || {};
    const ex = exercisesFor(day);
    const maxSets = Math.max(...ex.map(e => e.sets));

    const hasSets = ex.some(e => e.sets > 1);
    const wrap = document.createElement("div");
    wrap.className = "replog";
    wrap.innerHTML = `
      <h4>Track your reps</h4>
      ${hasSets ? `<div class="rest-bar" role="timer" aria-live="polite">
        <span class="rest-label">⏱ Tap ▶ to time a set · 30s rest between sets</span>
        <span class="rest-ring" aria-hidden="true"><i></i></span>
        <button type="button" class="sound-btn" aria-pressed="${soundOn}" aria-label="Alarm sound ${soundOn ? "on" : "off"}">${soundOn ? "🔔" : "🔕"}</button>
        <button type="button" class="rest-btn">Start 30s rest</button>
      </div>` : ""}
      <div class="replog-scroll">
        <table>
          <thead><tr><th scope="col">Exercise</th><th scope="col">Goal</th>${
            Array.from({ length: maxSets }, (_, i) => `<th scope="col">${maxSets > 1 ? "Set " + (i + 1) : "Actual"}</th>`).join("")
          }</tr></thead>
          <tbody>${ex.map((e, ei) => `
            <tr>
              <th scope="row">${e.name}</th>
              <td class="goal">${e.target == null ? "—" : (e.sets > 1 ? e.sets + " × " : "") + e.target + " " + e.unit}</td>
              ${Array.from({ length: maxSets }, (_, si) => si < e.sets
                ? `<td><div class="set-cell">
                     <input type="number" inputmode="decimal" min="0" step="any"
                       aria-label="${e.name} ${e.sets > 1 ? "set " + (si + 1) : ""} (${e.unit})"
                       placeholder="${e.target == null ? "" : e.target}"
                       data-k="${ei}-${si}" value="${log[ei + "-" + si] ?? ""}">
                     ${e.sets > 1 ? `<button type="button" class="set-go" data-k="${ei}-${si}"
                       aria-label="Start timer for ${e.name} set ${si + 1}">▶</button>` : ""}
                   </div>
                   ${e.sets > 1 ? `<span class="set-time" data-t="${ei}-${si}">${log["t" + ei + "-" + si] ? fmtTime(+log["t" + ei + "-" + si]) : ""}</span>` : ""}
                   </td>`
                : `<td></td>`).join("")}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="replog-sum"></p>`;

    const foot = body.querySelector(".dlg-foot");
    body.insertBefore(wrap, foot);

    function summary() {
      const cur = reps[n] || {};
      let goal = 0, hit = 0;
      ex.forEach((e, ei) => {
        if (e.target == null) return;
        for (let si = 0; si < e.sets; si++) {
          goal++;
          const v = parseFloat(cur[ei + "-" + si]);
          if (!isNaN(v) && v >= e.target) hit++;
        }
      });
      const any = Object.keys(cur).length;
      wrap.querySelector(".replog-sum").textContent = any
        ? `${hit} of ${goal} sets hit their goal${hit === goal && goal ? " — nice work! 🎉" : ""}`
        : "Type what you actually did in each set. Saved automatically.";
    }

    wrap.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => {
        reps[n] = reps[n] || {};
        if (inp.value === "") delete reps[n][inp.dataset.k]; else reps[n][inp.dataset.k] = inp.value;
        if (!Object.keys(reps[n]).length) delete reps[n];
        store(REPS_KEY, reps);
        summary();
      });
      // after a set is logged (leaving the box), start the 30s rest if more sets remain
      inp.addEventListener("change", () => {
        if (inp.value === "") return;
        const [ei, si] = inp.dataset.k.split("-").map(Number);
        const e = ex[ei];
        const isLastSetOfWorkout = ei === ex.length - 1 && si === e.sets - 1;
        if (e.sets > 1 && !isLastSetOfWorkout) startRest(wrap);
      });
    });
    if (hasSets) wrap.querySelector(".rest-btn").onclick = () => {
      if (setRun) finishSet(wrap, false); else toggleRest(wrap);
    };

    const sb = wrap.querySelector(".sound-btn");
    if (sb) sb.onclick = () => {
      soundOn = !soundOn; store(SOUND_KEY, soundOn);
      sb.textContent = soundOn ? "🔔" : "🔕";
      sb.setAttribute("aria-pressed", soundOn);
      sb.setAttribute("aria-label", `Alarm sound ${soundOn ? "on" : "off"}`);
      if (soundOn) alarm("tick");
    };

    // ▶ per-set timer buttons
    wrap.querySelectorAll(".set-go").forEach(btn => btn.onclick = () => {
      const [ei, si] = btn.dataset.k.split("-").map(Number);
      if (setRun && setRun.k === btn.dataset.k) { finishSet(wrap, false); return; }
      startSet(wrap, n, ex, ei, si);
    });
    summary();
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }

  /* ---------- Per-set timer ----------
     Rep exercises: stopwatch counts up — press again (or "Done") when the set is finished.
     Timed exercises (plank): counts down from the goal and finishes by itself.
     When a set ends, its time is saved and the 30s rest starts. */
  let setRun = null; // { k, n, ex, ei, si, start, countdown }

  function startSet(wrap, n, ex, ei, si) {
    if (setRun) finishSet(wrap, false, true);
    clearInterval(restTimer); restTimer = null;
    const e = ex[ei];
    const bar = wrap.querySelector(".rest-bar");
    setRun = { k: `${ei}-${si}`, n, ex, ei, si, start: Date.now(), countdown: e.unit === "sec" ? e.target : 0 };
    wrap.querySelectorAll(".set-go").forEach(b => b.classList.toggle("on", b.dataset.k === setRun.k));
    wrap.querySelector(`.set-go[data-k="${setRun.k}"]`).textContent = "■";
    bar.classList.remove("finished"); bar.classList.add("running", "set-mode");
    bar.querySelector(".rest-btn").textContent = "Done ✓";
    const tick = () => {
      if (!document.body.contains(bar)) { clearInterval(restTimer); restTimer = null; setRun = null; return; }
      const el = (Date.now() - setRun.start) / 1000;
      const label = `${e.name} · set ${si + 1}`;
      if (setRun.countdown) {
        const left = Math.max(0, Math.ceil(setRun.countdown - el));
        bar.querySelector(".rest-label").textContent = `🔥 ${label} — hold ${left}s`;
        bar.style.setProperty("--p", Math.min(1, el / setRun.countdown));
        if (left <= 0) { finishSet(wrap, true); }
      } else {
        bar.querySelector(".rest-label").textContent = `🔥 ${label} — ${fmtTime(el)}`;
        bar.style.setProperty("--p", (el % 60) / 60);
      }
    };
    tick();
    restTimer = setInterval(tick, 250);
  }

  function finishSet(wrap, auto, silent) {
    if (!setRun) return;
    clearInterval(restTimer); restTimer = null;
    const { k, n, ex, ei, si, start, countdown } = setRun;
    const secs = countdown && auto ? countdown : (Date.now() - start) / 1000;
    reps[n] = reps[n] || {};
    reps[n]["t" + k] = Math.round(secs);
    // timed hold finished on its own: fill in the seconds if the box is empty
    const inp = wrap.querySelector(`input[data-k="${k}"]`);
    if (countdown && inp && inp.value === "") { inp.value = Math.round(secs); reps[n][k] = inp.value; }
    store(REPS_KEY, reps);
    const t = wrap.querySelector(`.set-time[data-t="${k}"]`);
    if (t) t.textContent = fmtTime(secs);
    const b = wrap.querySelector(`.set-go[data-k="${k}"]`);
    if (b) { b.textContent = "▶"; b.classList.remove("on"); }
    setRun = null;
    const bar = wrap.querySelector(".rest-bar");
    bar.classList.remove("set-mode");
    if (inp) inp.dispatchEvent(new Event("input"));
    if (silent) return;
    const isLast = ei === ex.length - 1 && si === ex[ei].sets - 1;
    if (!isLast) startRest(wrap);
    else { stopRest(wrap, false); bar.querySelector(".rest-label").textContent = "🎉 Last set done — great workout!"; }
    if (!countdown && inp && inp.value === "") inp.focus();
  }

  /* ---------- 30-second rest timer ---------- */
  const REST_SECONDS = 30;
  let restTimer = null;

  /* ---------- Alarms ----------
     "rest"  = two soft low tones when a break starts
     "tick"  = short blip for the 3-2-1 countdown
     "go"    = loud rising alarm when the break ends and the next set starts */
  const SOUND_KEY = "andrea-sound";
  let soundOn = load(SOUND_KEY, true);
  let audioCtx = null;

  function tone(freq, start, dur, vol, type) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    o.connect(g); g.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function alarm(kind) {
    if (soundOn) {
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
        if (kind === "rest") { tone(523, 0, 0.35, 0.25); tone(392, 0.4, 0.5, 0.25); }
        else if (kind === "tick") { tone(660, 0, 0.12, 0.2, "square"); }
        else { // "go"
          [0, 0.18, 0.36].forEach(t => tone(784, t, 0.14, 0.35, "square"));
          tone(1047, 0.56, 0.6, 0.4, "square");
        }
      } catch (e) {}
    }
    try {
      if (navigator.vibrate) navigator.vibrate(kind === "go" ? [300, 100, 300, 100, 500] : kind === "rest" ? [200] : [60]);
    } catch (e) {}
    // visual flash too, so it works on mute
    const bar = document.querySelector("#dlgBody .rest-bar");
    if (bar && kind !== "tick") {
      bar.classList.remove("flash-rest", "flash-go");
      void bar.offsetWidth;
      bar.classList.add(kind === "go" ? "flash-go" : "flash-rest");
    }
  }
  function beep() { alarm("go"); }

  function stopRest(wrap, finished) {
    clearInterval(restTimer); restTimer = null;
    const bar = wrap && wrap.querySelector(".rest-bar");
    if (!bar) return;
    bar.classList.remove("running");
    bar.classList.toggle("finished", !!finished);
    bar.style.setProperty("--p", 0);
    bar.querySelector(".rest-label").textContent = finished ? "✅ Rest over — start your next set!" : "⏱ Tap ▶ to time a set · 30s rest between sets";
    bar.querySelector(".rest-btn").textContent = "Start 30s rest";
  }

  function startRest(wrap) {
    const bar = wrap.querySelector(".rest-bar");
    if (!bar) return;
    clearInterval(restTimer);
    const end = Date.now() + REST_SECONDS * 1000;
    bar.classList.add("running"); bar.classList.remove("finished");
    bar.querySelector(".rest-btn").textContent = "Skip rest";
    alarm("rest");
    let lastTick = null;
    const tick = () => {
      if (!document.body.contains(bar)) { clearInterval(restTimer); restTimer = null; return; }
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      bar.querySelector(".rest-label").textContent = left <= 3 && left > 0 ? `⏱ Get ready… ${left}` : `⏱ Resting… ${left}s`;
      bar.style.setProperty("--p", (REST_SECONDS - left) / REST_SECONDS);
      if (left <= 3 && left > 0 && left !== lastTick) { lastTick = left; alarm("tick"); }
      if (left <= 0) { stopRest(wrap, true); alarm("go"); }
    };
    tick();
    restTimer = setInterval(tick, 250);
  }

  function toggleRest(wrap) {
    const bar = wrap.querySelector(".rest-bar");
    if (bar.classList.contains("running")) stopRest(wrap, false); else startRest(wrap);
  }

  // stop the timer if the window closes
  const dlgEl = document.getElementById("dlg");
  if (dlgEl) dlgEl.addEventListener("close", () => { clearInterval(restTimer); restTimer = null; setRun = null; });

  /* ---------- Daily sign-in sheet (who did each day's workout) ---------- */
  const SIGNIN_KEY = "andrea-signins";
  let signins = load(SIGNIN_KEY, {}); // { dayNumber: { "Name": "ISO time" } }

  function dayNumberFrom(body) {
    const m = (body.querySelector("small") || {}).textContent || "";
    return parseInt((m.match(/Day (\d+)/) || [])[1], 10);
  }

  function addSignin(body) {
    if (body.querySelector(".signin")) return;
    const n = dayNumberFrom(body);
    if (!n) return;

    const box = document.createElement("div");
    box.className = "signin";
    const foot = body.querySelector(".dlg-foot");
    body.insertBefore(box, foot);

    function paint() {
      const today = signins[n] || {};
      const names = roster.map(p => p.name);
      const count = Object.keys(today).length;
      box.innerHTML = `
        <h4>Sign-in sheet <span class="si-count">${count} signed in</span></h4>
        ${names.length ? `
          <p class="si-help">Tap your name when you finish this workout.</p>
          <div class="si-list">
            ${names.map(nm => {
              const at = today[nm];
              return `<button type="button" class="si-person ${at ? "in" : ""}" data-name="${esc(nm)}" aria-pressed="${!!at}">
                <span class="si-avatar" aria-hidden="true">${at ? "✓" : esc(nm.charAt(0).toUpperCase())}</span>
                <span class="si-name">${esc(nm)}</span>
                <span class="si-time">${at ? new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Sign in"}</span>
              </button>`;
            }).join("")}
          </div>`
        : `<p class="si-help">No one has signed up yet. <a href="#roster" class="si-link">Join the challenge</a> first, then sign in here.</p>`}`;

      box.querySelectorAll(".si-person").forEach(b => b.onclick = () => {
        const nm = b.dataset.name;
        signins[n] = signins[n] || {};
        if (signins[n][nm]) delete signins[n][nm]; else signins[n][nm] = new Date().toISOString();
        if (!Object.keys(signins[n]).length) delete signins[n];
        store(SIGNIN_KEY, signins);
        paint();
        badges();
      });
      const link = box.querySelector(".si-link");
      if (link) link.onclick = () => { const d = document.getElementById("dlg"); if (d) d.close(); };
    }
    paint();
  }

  /* little "👥 2" badge on each day button */
  function badges() {
    document.querySelectorAll(".daybtn").forEach(btn => {
      const n = parseInt(((btn.querySelector("strong") || {}).textContent || "").replace(/\D/g, ""), 10);
      const c = signins[n] ? Object.keys(signins[n]).length : 0;
      let b = btn.querySelector(".si-badge");
      if (!c) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement("span"); b.className = "si-badge"; btn.appendChild(b); }
      b.textContent = `👥 ${c}`;
      b.setAttribute("aria-label", `${c} signed in`);
    });
  }
  const daysGrid = document.getElementById("days");
  if (daysGrid) new MutationObserver(badges).observe(daysGrid, { childList: true });
  badges();

  // when the roster changes, refresh an open sign-in sheet
  const _paintRoster = paintRoster;
  paintRoster = function () {
    _paintRoster();
    const s = document.querySelector("#dlgBody .signin");
    if (s) { s.remove(); addSignin(document.getElementById("dlgBody")); }
  };

  /* ---------- BMI check on rest days ----------
     Formula (US units):  BMI = 703 × weight (lb) ÷ height (in)²
     Weight for a target BMI: weight = target × height (in)² ÷ 703 */
  const BMI_KEY = "andrea-bmi";
  const HEIGHT_KEY = "andrea-height";
  const BMI_GOAL = 25;
  let bmiLog = load(BMI_KEY, {});       // { dayNumber: { lb, bmi, date } }
  let height = load(HEIGHT_KEY, { ft: "", in: "" });

  const calcBMI = (lb, inches) => (703 * lb) / (inches * inches);
  const weightFor = (bmi, inches) => (bmi * inches * inches) / 703;
  function bmiCategory(b) {
    if (b < 18.5) return "Underweight range";
    if (b < 25) return "Healthy range";
    if (b < 30) return "Overweight range";
    return "Obesity range";
  }

  function bmiChart(entries) {
    if (entries.length < 2) return "";
    const W = 300, H = 90, P = 18;
    const vals = entries.map(e => e.bmi);
    const lo = Math.min(...vals, BMI_GOAL) - 1, hi = Math.max(...vals) + 1;
    const x = i => P + (i * (W - 2 * P)) / (entries.length - 1);
    const y = v => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo);
    const pts = entries.map((e, i) => `${x(i).toFixed(1)},${y(e.bmi).toFixed(1)}`).join(" ");
    return `<svg class="bmi-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="BMI trend across rest days">
      <line x1="${P}" x2="${W - P}" y1="${y(BMI_GOAL)}" y2="${y(BMI_GOAL)}" class="goal-line"/>
      <text x="${W - P}" y="${y(BMI_GOAL) - 4}" text-anchor="end" class="goal-txt">goal ${BMI_GOAL}</text>
      <polyline points="${pts}" class="trend"/>
      ${entries.map((e, i) => `<circle cx="${x(i)}" cy="${y(e.bmi)}" r="3.5"><title>Day ${e.day}: ${e.bmi.toFixed(1)}</title></circle>`).join("")}
    </svg>`;
  }

  /* step-by-step "how to calculate" — uses your own numbers once you've entered them */
  function howTo(mine, inches) {
    const ex = mine && inches
      ? { ft: Math.floor(inches / 12), inch: +(inches % 12).toFixed(1), total: inches, lb: mine.lb }
      : { ft: 5, inch: 6, total: 66, lb: 180 };
    const sq = ex.total * ex.total;
    const top = 703 * ex.lb;
    const result = top / sq;
    const yours = mine && inches ? "with your numbers" : "example";
    return `
      <details class="bmi-how">
        <summary>How to calculate BMI yourself (step by step)</summary>
        <ol>
          <li><b>Weigh yourself in pounds.</b> Use the same scale, same time of day (morning, before eating is best).
            <span class="ex">${yours}: ${ex.lb} lb</span></li>
          <li><b>Turn your height into inches.</b> Multiply feet by 12, then add the extra inches.
            <span class="ex">${ex.ft} ft × 12 + ${ex.inch} in = ${ex.total} in</span></li>
          <li><b>Square your height.</b> Multiply your height in inches by itself.
            <span class="ex">${ex.total} × ${ex.total} = ${sq.toLocaleString()}</span></li>
          <li><b>Multiply your weight by 703.</b> (703 converts pounds and inches to the metric BMI scale.)
            <span class="ex">${ex.lb} × 703 = ${top.toLocaleString()}</span></li>
          <li><b>Divide step 4 by step 3.</b> That number is your BMI — round to one decimal.
            <span class="ex">${top.toLocaleString()} ÷ ${sq.toLocaleString()} = <b>${result.toFixed(1)}</b></span></li>
          <li><b>See where it falls:</b> under 18.5 underweight · 18.5–24.9 healthy · 25–29.9 overweight · 30 and up obesity.
            <span class="ex">${result.toFixed(1)} → ${bmiCategory(result)}</span></li>
          <li><b>Find your goal weight (optional).</b> Goal BMI × height² ÷ 703.
            <span class="ex">${BMI_GOAL} × ${sq.toLocaleString()} ÷ 703 ≈ ${Math.round(weightFor(BMI_GOAL, ex.total))} lb</span></li>
        </ol>
        <p class="bmi-metric">Using metric? BMI = weight (kg) ÷ height (m)². Example: 82 kg ÷ (1.68 × 1.68) = 29.1</p>
      </details>`;
  }

  function addBMI(body) {
    if (body.querySelector(".bmi")) return;
    const n = dayNumberFrom(body);
    if (!n || PLAN.days[n - 1].type !== "Rest / active recovery") return;

    const box = document.createElement("div");
    box.className = "bmi";
    const foot = body.querySelector(".dlg-foot");
    body.insertBefore(box, foot);

    function paint() {
      const mine = bmiLog[n];
      const entries = Object.keys(bmiLog).map(Number).sort((a, b) => a - b).map(d => ({ day: d, ...bmiLog[d] }));
      const first = entries[0];
      const inches = (+height.ft || 0) * 12 + (+height.in || 0);

      let result = "";
      if (mine) {
        const goalLb = inches ? weightFor(BMI_GOAL, inches) : null;
        const toGo = goalLb ? mine.lb - goalLb : null;
        const change = first && first.day !== n ? mine.bmi - first.bmi : null;
        result = `
          <div class="bmi-result">
            <div class="bmi-big"><b>${mine.bmi.toFixed(1)}</b><span>${bmiCategory(mine.bmi)}</span></div>
            <ul class="bmi-facts">
              ${change !== null ? `<li><b>${change <= 0 ? "▼" : "▲"} ${Math.abs(change).toFixed(1)}</b> since Day ${first.day}</li>` : ""}
              ${goalLb ? `<li>BMI ${BMI_GOAL} at your height ≈ <b>${Math.round(goalLb)} lb</b></li>` : ""}
              ${toGo !== null ? (toGo > 0 ? `<li><b>${Math.round(toGo)} lb</b> to go to reach BMI ${BMI_GOAL}</li>` : `<li><b>Goal reached!</b> 🎉</li>`) : ""}
            </ul>
          </div>`;
      }

      box.innerHTML = `
        <h4>BMI check</h4>
        <p class="bmi-formula">BMI = 703 × weight (lb) ÷ height (in)²</p>
        <form class="bmi-form">
          <label>Height
            <span class="bmi-h">
              <input name="ft" type="number" min="3" max="8" inputmode="numeric" value="${esc(height.ft)}" aria-label="Height feet" placeholder="5"> ft
              <input name="in" type="number" min="0" max="11.9" step="any" inputmode="decimal" value="${esc(height.in)}" aria-label="Height inches" placeholder="6"> in
            </span>
          </label>
          <label>Weight
            <span class="bmi-h"><input name="lb" type="number" min="50" max="900" step="any" inputmode="decimal" value="${mine ? mine.lb : ""}" placeholder="lb" aria-label="Weight in pounds"> lb</span>
          </label>
          <button type="submit">${mine ? "Update BMI" : "Check BMI"}</button>
        </form>
        <p class="bmi-msg" aria-live="polite"></p>
        ${result}
        ${entries.length ? `
          <div class="bmi-history">
            <div class="bmi-hist-head">Your BMI on rest days</div>
            ${bmiChart(entries)}
            <ol>${entries.map(e => `<li class="${e.day === n ? "cur" : ""}"><span>Day ${e.day}</span><span>${e.lb} lb</span><b>${e.bmi.toFixed(1)}</b></li>`).join("")}</ol>
          </div>` : ""}
        ${howTo(mine, inches)}
        <p class="bmi-note">BMI is a rough guide and doesn't tell muscle from fat. Weigh in at the same time of day each time for the fairest comparison.</p>`;

      box.querySelector(".bmi-form").onsubmit = ev => {
        ev.preventDefault();
        const f = ev.target;
        const ft = parseFloat(f.ft.value), inch = parseFloat(f.in.value || 0), lb = parseFloat(f.lb.value);
        const msg = box.querySelector(".bmi-msg");
        const total = (ft || 0) * 12 + (inch || 0);
        if (!ft || total < 36 || total > 96) { msg.textContent = "Enter your height in feet and inches."; msg.className = "bmi-msg err"; return; }
        if (!lb || lb < 50 || lb > 900) { msg.textContent = "Enter your weight in pounds."; msg.className = "bmi-msg err"; return; }
        height = { ft: String(ft), in: String(inch || 0) };
        store(HEIGHT_KEY, height);
        bmiLog[n] = { lb: Math.round(lb * 10) / 10, bmi: calcBMI(lb, total), date: new Date().toISOString() };
        store(BMI_KEY, bmiLog);
        paint();
      };
    }
    paint();
  }

  /* ---------- Meal plan to lower BMI ----------
     7 days that line up with the weekly workouts (Mon = Strength A ... Sun = Rest). */
  const MEALS = {
    Monday: { focus: "Strength A — protein at every meal to help muscles recover", meals: [
      ["Breakfast", "Greek yogurt parfait: 1 cup plain Greek yogurt, 1 cup berries, 2 tbsp granola"],
      ["Lunch", "Grilled chicken salad with chickpeas, cucumber, tomato and 1 tbsp olive-oil vinaigrette"],
      ["Snack", "Apple + string cheese"],
      ["Dinner", "Baked salmon, roasted broccoli, ½ cup brown rice"]] },
    Tuesday: { focus: "Steady ride — light carbs before you ride", meals: [
      ["Breakfast", "Veggie scramble (2 eggs, spinach, peppers) + 1 slice whole-grain toast"],
      ["Lunch", "Turkey & hummus whole-wheat wrap + carrot sticks"],
      ["Snack", "Banana about 30–60 min before the ride"],
      ["Dinner", "Turkey & bean chili + side salad"]] },
    Wednesday: { focus: "Strength B — quick, fresh meals", meals: [
      ["Breakfast", "Overnight oats: ½ cup oats, milk, 1 tbsp chia, berries"],
      ["Lunch", "Black bean burrito bowl: greens, ½ cup brown rice, black beans, corn, salsa, 2 tbsp plain Greek yogurt"],
      ["Snack", "Hard-boiled egg + 1 cup pineapple"],
      ["Dinner", "Chicken & vegetable stir-fry (light soy sauce) over cauliflower rice or ½ cup whole-wheat noodles"]] },
    Thursday: { focus: "Interval ride — refuel with protein + carbs after", meals: [
      ["Breakfast", "Smoothie: milk, banana, handful of spinach, 1 tbsp peanut butter"],
      ["Lunch", "Tuna salad made with Greek yogurt over greens + whole-grain crackers"],
      ["Snack", "About 15 almonds"],
      ["Dinner", "Lean beef or tofu tacos on corn tortillas with cabbage slaw and salsa"]] },
    Friday: { focus: "Strength A — keep it simple", meals: [
      ["Breakfast", "2 hard-boiled eggs, 1 orange, 1 slice whole-grain toast"],
      ["Lunch", "Lentil soup + side salad"],
      ["Snack", "Plain Greek yogurt with cinnamon"],
      ["Dinner", "Sheet-pan chicken fajitas with peppers & onions, 2 small tortillas"]] },
    Saturday: { focus: "Long ride — the one day to eat more carbs", meals: [
      ["Breakfast", "1–2 hrs before: oatmeal with banana, 1 tsp honey, 1 tbsp peanut butter"],
      ["During ride", "Water every 15–20 min; for rides over an hour, a banana or 2 fig bars"],
      ["Lunch", "After ride: turkey sandwich on whole grain, fruit, glass of milk"],
      ["Dinner", "1 cup whole-wheat pasta, marinara with lean ground turkey, big salad"]] },
    Sunday: { focus: "Rest day — lighter meals", meals: [
      ["Breakfast", "Veggie omelet + berries"],
      ["Lunch", "Shrimp bowl: greens, ½ cup quinoa, ¼ avocado, salsa"],
      ["Snack", "Cucumber slices + 2 tbsp hummus"],
      ["Dinner", "Baked cod or tofu, small roasted sweet potato, green beans"]] }
  };
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdayOf = iso => DAY_NAMES[new Date(iso + "T12:00:00").getDay()];
  const mealIcon = m => ({ Breakfast: "🍳", Lunch: "🥗", Snack: "🍎", Dinner: "🍽️", "During ride": "🚴", "Meal prep": "🥡" }[m] || "•");
  const mealList = d => `<ul class="meal-list">${MEALS[d].meals.map(([m, food]) =>
    `<li><span class="mi" aria-hidden="true">${mealIcon(m)}</span><span><b>${m}</b>${esc(food)}</span></li>`).join("")}</ul>`;

  // full meal-plan section (placed before the sign-up roster)
  const mealSec = document.createElement("section");
  mealSec.className = "meals";
  mealSec.id = "meals";
  const todayName = DAY_NAMES[new Date().getDay()];
  mealSec.innerHTML = `
    <div class="roster-head">
      <h2>Meal plan to lower BMI</h2>
      <p>Matched to your workouts. Repeat this week for all 30 days, and swap in foods you like that fit the same pattern. No pork and no cottage cheese.</p>
    </div>
    <div class="plate">
      <div class="plate-pic" aria-hidden="true"><span class="p-veg">Veggies ½</span><span class="p-pro">Protein ¼</span><span class="p-carb">Whole grains ¼</span></div>
      <ul class="plate-rules">
        <li><b>Plate method:</b> half vegetables, a quarter lean protein, a quarter whole grains or starch.</li>
        <li><b>Protein every meal</b> keeps you full and protects muscle while you lose fat.</li>
        <li><b>Drink water</b> — about 8 cups a day, more on ride days. Skip soda, juice and sweet coffee drinks.</li>
        <li><b>Cut back</b> on fried food, fast food, sweets and alcohol.</li>
        <li><b>Aim for 1–2 lb a week.</b> Slow and steady is what lowers BMI for good.</li>
      </ul>
    </div>
    <div class="tabs meal-tabs" role="tablist">
      ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d =>
        `<button type="button" role="tab" data-d="${d}" aria-selected="${d === todayName}">${d.slice(0, 3)}</button>`).join("")}
    </div>
    <div class="meal-day"></div>
    <p class="bmi-note">General healthy-eating guide, not medical advice. Check with your doctor or a registered dietitian before big diet changes, especially if you have a health condition or take medication.</p>`;
  section.parentNode.insertBefore(mealSec, section);

  function showMealDay(d) {
    mealSec.querySelectorAll(".meal-tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.d === d));
    mealSec.querySelector(".meal-day").innerHTML = `<p class="meal-focus">${esc(MEALS[d].focus)}</p>${mealList(d)}`;
  }
  mealSec.querySelectorAll(".meal-tabs button").forEach(b => b.onclick = () => showMealDay(b.dataset.d));
  showMealDay(todayName);

  // "Today's meals" inside each day's window
  function addMeals(body) {
    if (body.querySelector(".day-meals")) return;
    const n = dayNumberFrom(body);
    if (!n) return;
    const d = weekdayOf(PLAN.days[n - 1].date);
    const box = document.createElement("details");
    box.className = "day-meals";
    box.innerHTML = `<summary>🍽️ Today's meals <span>(${d})</span></summary>
      <p class="meal-focus">${esc(MEALS[d].focus)}</p>${mealList(d)}`;
    const foot = body.querySelector(".dlg-foot");
    body.insertBefore(box, foot);
  }

  const dlgBody = document.getElementById("dlgBody");
  if (dlgBody) {
    new MutationObserver(() => { addMeals(dlgBody); addTracker(dlgBody); addBMI(dlgBody); addSignin(dlgBody); }).observe(dlgBody, { childList: true });
  }
})();
