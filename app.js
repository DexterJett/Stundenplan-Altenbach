(function () {
  "use strict";

  const P = window.AltenbachPlan;
  const STORAGE_KEY = "altenbach-stundenplan-v2";
  const LEGACY_KEY = "altenbach-stundenplan-v1";
  const PASS_KEY = "altenbach-passwort";
  const SESSION_KEY = "altenbach-sitzung";
  const LOCK_KEY = "altenbach-gesperrt";

  const els = {
    modeWeek: document.querySelector("#mode-week"),
    modeStandard: document.querySelector("#mode-standard"),
    saved: document.querySelector("#saved"),
    prev: document.querySelector("#prev-week"),
    next: document.querySelector("#next-week"),
    today: document.querySelector("#today-week"),
    relation: document.querySelector("#week-relation"),
    label: document.querySelector("#week-label"),
    banner: document.querySelector("#banner"),
    bannerText: document.querySelector("#banner-text"),
    discard: document.querySelector("#discard-week"),
    noteWrap: document.querySelector("#note-wrap"),
    note: document.querySelector("#week-note"),
    confirm: document.querySelector("#confirm"),
    confirmText: document.querySelector("#confirm-text"),
    confirmYes: document.querySelector("#confirm-yes"),
    confirmNo: document.querySelector("#confirm-no"),
    print: document.querySelector("#print-btn"),
    copy: document.querySelector("#copy-btn"),
    download: document.querySelector("#download-btn"),
    upload: document.querySelector("#upload-btn"),
    uploadInput: document.querySelector("#upload-input"),
    restore: document.querySelector("#restore-standard"),
    clearWeeks: document.querySelector("#clear-weeks"),
    copyFallback: document.querySelector("#copy-fallback"),
    copyText: document.querySelector("#copy-text"),
    hint: document.querySelector("#hint"),
    hintClose: document.querySelector("#hint-close"),
    rota: document.querySelector("#rota"),
    days: document.querySelector("#days"),
    toast: document.querySelector("#toast"),
    editor: document.querySelector("#editor"),
    kicker: document.querySelector("#editor-kicker"),
    title: document.querySelector("#editor-title"),
    context: document.querySelector("#editor-context"),
    errors: document.querySelector("#editor-errors"),
    shiftList: document.querySelector("#shift-list"),
    addShift: document.querySelector("#add-shift"),
    presets: document.querySelector("#presets"),
    presetName: document.querySelector("#preset-name"),
    presetSave: document.querySelector("#preset-save"),
    close: document.querySelector("#editor-close"),
    lock: document.querySelector("#lock"),
    lockForm: document.querySelector("#lock-form"),
    lockPassword: document.querySelector("#lock-password"),
    lockRemember: document.querySelector("#lock-remember"),
    lockError: document.querySelector("#lock-error"),
    lockSubmit: document.querySelector("#lock-submit"),
    lockBtn: document.querySelector("#lock-btn"),
    sheet: document.querySelector(".sheet"),
  };

  let defaultStandard = null;
  let password = "";
  let state = null;
  let mode = "week";
  let weekId = "";
  let savedTimer = 0;
  let toastTimer = 0;
  let editorCtx = null;
  let draft = [];

  els.modeWeek.addEventListener("click", () => setMode("week"));
  els.modeStandard.addEventListener("click", () => setMode("standard"));
  els.prev.addEventListener("click", () => shiftWeek(-7));
  els.next.addEventListener("click", () => shiftWeek(7));
  els.today.addEventListener("click", () => {
    weekId = P.toDateId(P.startOfWeek(new Date()));
    rememberWeek();
    render();
  });
  els.note.addEventListener("input", () => {
    const week = ensureWeek();
    week.note = els.note.value;
    collapseWeekIfClean();
    persist(true);
    render({ keepNoteFocus: true });
  });
  els.discard.addEventListener("click", () => {
    ask("Änderungen dieser Woche verwerfen und den Standardplan zeigen?", () => {
      delete state.weeks[weekId];
      els.note.value = "";
      persist(true);
      render();
    });
  });
  els.confirmNo.addEventListener("click", () => {
    els.confirm.hidden = true;
  });
  els.print.addEventListener("click", () => window.print());
  window.addEventListener("beforeprint", () => {
    els.noteWrap.classList.toggle("is-empty", !els.note.value.trim());
  });
  els.copy.addEventListener("click", copyWhatsApp);
  els.download.addEventListener("click", downloadPlan);
  els.upload.addEventListener("click", () => els.uploadInput.click());
  els.uploadInput.addEventListener("change", () => {
    const file = els.uploadInput.files && els.uploadInput.files[0];
    els.uploadInput.value = "";
    if (file) readUpload(file);
  });
  els.restore.addEventListener("click", () => {
    ask("Den Standardplan auf den ursprünglichen Winterplan zurücksetzen? Wochen mit eigener Anpassung bleiben unverändert.", () => {
      state.standard = P.clonePlan(defaultStandard);
      persist(true);
      render();
    });
  });
  els.clearWeeks.addEventListener("click", () => {
    ask("Alle Wochenanpassungen löschen? Der Standardplan bleibt erhalten.", () => {
      state.weeks = {};
      els.note.value = "";
      persist(true);
      render();
    });
  });
  els.hintClose.addEventListener("click", () => {
    state.hintDismissed = true;
    els.hint.hidden = true;
    persist(false);
  });
  els.close.addEventListener("click", () => els.editor.close());
  els.addShift.addEventListener("click", () => {
    draft.push(P.suggestNextShift(draft));
    renderDraft();
    const inputs = els.shiftList.querySelectorAll('input[type="time"]');
    const last = inputs[inputs.length - 2] || inputs[inputs.length - 1];
    if (last) last.focus();
  });
  els.editor.addEventListener("click", (event) => {
    if (event.target === els.editor) els.editor.close();
  });
  els.rota.addEventListener("click", onEditClick);
  els.days.addEventListener("click", onEditClick);
  els.presetSave.addEventListener("click", savePreset);
  els.presetName.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    savePreset();
  });
  els.lockForm.addEventListener("submit", onUnlock);
  els.lockBtn.addEventListener("click", lockApp);

  renderPresets();
  boot().catch(() => showGate());

  function onEditClick(event) {
    const button = event.target.closest("[data-person][data-day]");
    if (!button) return;
    openEditor(button.dataset.person, button.dataset.day);
  }

  function setMode(next) {
    mode = next;
    els.confirm.hidden = true;
    render();
  }

  function shiftWeek(days) {
    weekId = P.toDateId(P.addDays(P.parseDateId(weekId), days));
    rememberWeek();
    render();
  }

  function rememberWeek() {
    state.lastWeekId = weekId;
    persist(false);
  }

  function displayPlan() {
    if (mode === "standard") return state.standard;
    return state.weeks[weekId] ? state.weeks[weekId].plan : state.standard;
  }

  function weekIsCustom() {
    return Boolean(state.weeks[weekId]);
  }

  function ensureWeek() {
    if (!state.weeks[weekId]) {
      state.weeks[weekId] = { plan: P.clonePlan(state.standard), note: "" };
    }
    return state.weeks[weekId];
  }

  function collapseWeekIfClean() {
    const week = state.weeks[weekId];
    if (!week) return;
    if (!week.note.trim() && P.plansEqual(week.plan, state.standard)) {
      delete state.weeks[weekId];
    }
  }

  function commit(personId, dayId, shifts) {
    const next = P.canonicalShifts(shifts);
    if (mode === "standard") {
      state.standard[personId][dayId] = next;
    } else {
      const week = ensureWeek();
      week.plan[personId][dayId] = next;
      collapseWeekIfClean();
    }
    persist(true);
    render({ keepEditor: true });
  }

  function render(options = {}) {
    const plan = displayPlan();
    const sunday = P.parseDateId(weekId);
    const todayId = P.toDateId(new Date());
    const standardMode = mode === "standard";
    const custom = !standardMode && weekIsCustom();

    els.modeWeek.setAttribute("aria-pressed", String(!standardMode));
    els.modeStandard.setAttribute("aria-pressed", String(standardMode));
    els.prev.hidden = standardMode;
    els.next.hidden = standardMode;
    els.today.hidden = standardMode;
    els.noteWrap.hidden = standardMode;
    els.hint.hidden = state.hintDismissed;

    if (standardMode) {
      els.relation.textContent = "Vorlage";
      els.label.textContent = "Winterplan";
      els.banner.hidden = false;
      els.bannerText.textContent = "Der Standardplan ist die Vorlage. Wochen ohne eigene Anpassung übernehmen ihn.";
      els.discard.hidden = true;
    } else {
      els.relation.textContent = P.weekRelation(sunday, new Date());
      els.label.textContent = P.formatRange(sunday);
      els.banner.hidden = !custom;
      els.bannerText.textContent = "Diese Woche ist angepasst.";
      els.discard.hidden = !custom;
      if (!options.keepNoteFocus) {
        els.note.value = state.weeks[weekId] ? state.weeks[weekId].note : "";
      }
    }

    document.title = `${els.label.textContent} · Stundenplan Altenbach`;
    renderTable(plan, sunday, todayId, standardMode);
    renderDays(plan, sunday, todayId, standardMode);
    if (options.keepEditor && editorCtx) updatePresetActive();
  }

  function renderTable(plan, sunday, todayId, standardMode) {
    const table = el("table");
    const thead = el("thead");
    const headRow = el("tr");
    headRow.append(el("th", { scope: "col" }, "Name"));
    P.DAYS.forEach((day, index) => {
      const date = P.addDays(sunday, index);
      const head = el("th", { scope: "col" });
      if (P.toDateId(date) === todayId && !standardMode) head.classList.add("is-today");
      head.append(day.short, el("span", null, `${date.getDate()}.${date.getMonth() + 1}.`));
      headRow.append(head);
    });
    thead.append(headRow);

    const tbody = el("tbody");
    for (const person of P.PEOPLE) {
      const row = el("tr", { "data-person": person.id });
      const name = el("th", { scope: "row" });
      name.append(
        el("span", { class: "who" }, person.name),
        el("span", { class: "load" }, P.formatPersonLoad(plan, person.id)),
      );
      row.append(name);
      P.DAYS.forEach((day, index) => {
        const shifts = plan[person.id][day.id];
        const date = P.addDays(sunday, index);
        const changed = !standardMode && weekIsCustom() && !P.shiftsEqual(shifts, state.standard[person.id][day.id]);
        const cell = el("td");
        if (P.toDateId(date) === todayId && !standardMode) cell.classList.add("is-today");
        if (changed) cell.classList.add("is-changed");
        const button = el("button", {
          type: "button",
          class: "cell",
          "data-person": person.id,
          "data-day": day.id,
          "aria-label": ariaLabel(person, day, shifts, changed),
        });
        const pills = el("div", { class: "pills" });
        if (!shifts.length) {
          pills.append(el("span", { class: "free" }, "frei"));
        } else {
          for (const shift of shifts) {
            pills.append(el("span", { class: shift.end == null ? "pill is-open" : "pill" }, P.formatShift(shift)));
          }
        }
        button.append(pills);
        if (changed) button.append(el("span", { class: "changed-flag" }, "geändert"));
        button.append(el("span", { class: "edit-hint" }, "ändern"));
        cell.append(button);
        row.append(cell);
      });
      tbody.append(row);
    }
    table.append(thead, tbody);
    const wrap = el("div", { class: "table-scroll" });
    wrap.append(table);
    els.rota.replaceChildren(wrap);
  }

  function renderDays(plan, sunday, todayId, standardMode) {
    const fragment = document.createDocumentFragment();
    P.DAYS.forEach((day, index) => {
      const date = P.addDays(sunday, index);
      const card = el("article", { class: "day-card" });
      if (P.toDateId(date) === todayId && !standardMode) card.classList.add("is-today");
      const head = el("div", { class: "day-head" });
      const title = el("h4");
      title.append(`${day.label}`, el("span", null, `${date.getDate()}.${date.getMonth() + 1}.`));
      if (P.toDateId(date) === todayId && !standardMode) {
        title.append(el("span", { class: "today-pill" }, "heute"));
      }
      head.append(title);
      const gaps = P.findDayGaps(plan, day.id);
      if (gaps.length) {
        head.append(el("p", { class: "gap-label" }, `Niemand da: ${P.formatGaps(gaps)}`));
      }
      card.append(head, renderAxis());

      const lanes = el("div", { class: "lanes" });
      if (gaps.length) {
        const layer = el("div", { class: "gap-layer" });
        for (const gap of gaps) {
          const left = P.scalePercent(gap.start);
          const width = Math.max(P.scalePercent(gap.end) - left, 0);
          layer.append(el("i", { class: "gap-band", style: `left:${left}%;width:${width}%` }));
        }
        lanes.append(layer);
      }

      for (const person of P.PEOPLE) {
        const shifts = plan[person.id][day.id];
        const changed = !standardMode && weekIsCustom() && !P.shiftsEqual(shifts, state.standard[person.id][day.id]);
        const lane = el("button", {
          type: "button",
          class: changed ? "lane is-changed" : "lane",
          "data-person": person.id,
          "data-day": day.id,
          "aria-label": ariaLabel(person, day, shifts, changed),
        });
        lane.append(el("span", { class: "lane-name" }, person.name));
        const track = el("span", { class: "track" });
        for (let hour = 10; hour <= 23; hour += 1) {
          track.append(el("i", { class: "gridline", style: `left:${P.scalePercent(hour * 60)}%` }));
        }
        if (!shifts.length) {
          track.append(el("span", { class: "frei-label" }, "frei"));
        } else {
          for (const shift of shifts) {
            const open = shift.end == null;
            const left = P.scalePercent(P.toMinutes(shift.start));
            const right = P.scalePercent(open ? P.SCALE_END : P.toMinutes(shift.end));
            const width = Math.max(right - left, 1.4);
            const bar = el("span", {
              class: open ? "bar is-open" : "bar",
              style: `left:${left}%;width:${width}%`,
            });
            bar.append(el("span", null, P.formatShift(shift)));
            track.append(bar);
          }
        }
        lane.append(track);
        lanes.append(lane);
      }
      card.append(lanes);
      fragment.append(card);
    });
    els.days.replaceChildren(fragment);
  }

  function renderAxis() {
    const axis = el("div", { class: "axis", "aria-hidden": "true" });
    axis.append(el("span"));
    const scale = el("span", { class: "axis-scale" });
    for (let hour = 10; hour <= 22; hour += 2) {
      const transform = hour === 10 ? "translateX(0)" : "translateX(-50%)";
      scale.append(el("span", {
        style: `left:${P.scalePercent(hour * 60)}%;transform:${transform}`,
      }, String(hour)));
    }
    axis.append(scale);
    return axis;
  }

  function ariaLabel(person, day, shifts, changed) {
    const suffix = changed ? " Geändert gegenüber dem Standard." : "";
    return `${person.name}, ${day.label}: ${P.formatShiftList(shifts)}. Zeiten ändern.${suffix}`;
  }

  function openEditor(personId, dayId) {
    editorCtx = { personId, dayId };
    const person = P.PEOPLE.find((item) => item.id === personId);
    const day = P.DAYS.find((item) => item.id === dayId);
    const sunday = P.parseDateId(weekId);
    const date = P.addDays(sunday, P.DAYS.findIndex((item) => item.id === dayId));
    draft = P.canonicalShifts(displayPlan()[personId][dayId]).map((shift) => ({ ...shift }));
    els.title.textContent = person.name;
    els.kicker.textContent = mode === "standard"
      ? `${day.label} · Standardplan`
      : `${day.label} ${date.getDate()}. ${P.MONTHS[date.getMonth()]}`;
    if (mode === "standard") {
      els.context.textContent = "Du änderst die Vorlage für alle Wochen ohne eigene Anpassung.";
    } else {
      els.context.textContent = `Vorlage an diesem Tag: ${P.formatShiftList(state.standard[personId][dayId])}`;
    }
    renderDraft();
    els.editor.showModal();
    const first = els.shiftList.querySelector("input");
    if (first) first.focus();
  }

  function renderDraft() {
    els.shiftList.replaceChildren();
    if (!draft.length) {
      els.shiftList.append(el("p", { class: "empty-day" }, "An diesem Tag frei."));
    }
    draft.forEach((shift, index) => {
      const row = el("div", { class: "shift-row" });
      const startLabel = el("label", null, "Von");
      const start = el("input", { type: "time", step: "900", value: shift.start, autocomplete: "off" });
      start.addEventListener("input", () => {
        shift.start = start.value;
        afterDraftEdit();
      });
      startLabel.append(start);

      const endLabel = el("label", null, "Bis");
      const end = el("input", {
        type: "time",
        step: "900",
        value: shift.end || "",
        autocomplete: "off",
      });
      end.disabled = shift.end == null;
      end.addEventListener("input", () => {
        shift.end = end.value || null;
        afterDraftEdit();
      });
      endLabel.append(end);

      const check = el("label", { class: "check" });
      const box = el("input", { type: "checkbox" });
      box.checked = shift.end == null;
      box.addEventListener("change", () => {
        if (box.checked) {
          end.dataset.restore = end.value || "22:00";
          shift.end = null;
          end.disabled = true;
        } else {
          const restore = end.dataset.restore || "22:00";
          shift.end = restore;
          end.disabled = false;
          end.value = restore;
        }
        afterDraftEdit();
      });
      check.append(box, document.createTextNode(" Ende"));

      const remove = el("button", { type: "button", class: "remove" }, "Entfernen");
      remove.addEventListener("click", () => {
        draft.splice(index, 1);
        renderDraft();
        afterDraftEdit();
      });

      row.append(startLabel, endLabel, check, remove);
      els.shiftList.append(row);
    });
    afterDraftEdit({ skipCommit: true });
    updatePresetActive();
  }

  function afterDraftEdit(options = {}) {
    const errors = P.validateShifts(draft);
    els.errors.hidden = errors.length === 0;
    els.errors.textContent = errors.join(" ");
    updatePresetActive();
    if (options.skipCommit) return;
    if (errors.length) return;
    commit(editorCtx.personId, editorCtx.dayId, draft);
  }

  function customPresets() {
    return state && Array.isArray(state.presets) ? state.presets : [];
  }

  function applyPreset(shifts) {
    draft = shifts.map((shift) => ({ ...shift }));
    renderDraft();
    afterDraftEdit();
  }

  function renderPresets() {
    els.presets.replaceChildren();
    for (const preset of P.PRESETS) {
      els.presets.append(presetButton(preset, false));
    }
    for (const preset of customPresets()) {
      const chip = el("span", { class: "preset-chip" });
      const remove = el("button", {
        type: "button",
        class: "preset-delete",
        "aria-label": `${preset.label} entfernen`,
      }, "×");
      remove.addEventListener("click", () => {
        state.presets = state.presets.filter((item) => item.id !== preset.id);
        persist(true);
        renderPresets();
        toast("Schnellwahl entfernt.");
      });
      chip.append(presetButton(preset, true), remove);
      els.presets.append(chip);
    }
    updatePresetActive();
  }

  function presetButton(preset, custom) {
    const button = el("button", {
      type: "button",
      class: custom ? "preset-apply" : "",
      "data-shifts": JSON.stringify(P.canonicalShifts(preset.shifts)),
    }, preset.label);
    button.addEventListener("click", () => applyPreset(preset.shifts));
    return button;
  }

  function updatePresetActive() {
    const current = JSON.stringify(P.canonicalShifts(draft));
    for (const button of els.presets.querySelectorAll("[data-shifts]")) {
      button.classList.toggle("is-active", button.dataset.shifts === current);
    }
  }

  function savePreset() {
    if (!state) return;
    if (!Array.isArray(state.presets)) state.presets = [];
    const errors = P.validateShifts(draft);
    els.errors.hidden = errors.length === 0;
    els.errors.textContent = errors.join(" ");
    if (errors.length) return;
    const label = els.presetName.value.trim().slice(0, 40);
    if (!label) {
      els.presetName.focus();
      toast("Gib der Schnellwahl einen Namen.");
      return;
    }
    const builtIn = P.PRESETS.some((preset) => preset.label.toLocaleLowerCase("de") === label.toLocaleLowerCase("de"));
    if (builtIn) {
      toast("Diesen Namen gibt es schon.");
      els.presetName.focus();
      return;
    }
    const shifts = P.canonicalShifts(draft);
    const existing = state.presets.find((preset) => preset.label.toLocaleLowerCase("de") === label.toLocaleLowerCase("de"));
    if (existing) {
      existing.shifts = shifts;
    } else if (state.presets.length >= 24) {
      toast("Es passen höchstens 24 eigene Schnellwahlen.");
      return;
    } else {
      state.presets.push({ id: crypto.randomUUID(), label, shifts });
    }
    els.presetName.value = "";
    persist(true);
    renderPresets();
    toast("Schnellwahl gespeichert.");
  }

  async function copyWhatsApp() {
    const plan = displayPlan();
    const note = mode === "week" && state.weeks[weekId] ? state.weeks[weekId].note.trim() : "";
    const text = P.formatWhatsApp(plan, {
      title: mode === "standard" ? "Winterplan" : P.formatRange(P.parseDateId(weekId)),
      note,
    });
    try {
      await navigator.clipboard.writeText(text);
      els.copyFallback.hidden = true;
      toast("Text kopiert. Mit Strg+V in WhatsApp einfügen.");
    } catch {
      els.copyText.value = text;
      els.copyFallback.hidden = false;
      els.copyText.focus();
      els.copyText.select();
    }
  }

  function downloadPlan() {
    const payload = { version: 2, standard: state.standard, weeks: state.weeks, presets: state.presets };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stundenplan-altenbach.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function readUpload(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast("Die Datei konnte nicht gelesen werden.");
      return;
    }
    if (!data || (data.version !== 1 && data.version !== 2) || !P.isPlan(data.standard)) {
      toast("Das ist keine gültige Sicherungsdatei.");
      return;
    }
    const weeks = {};
    if (data.weeks && typeof data.weeks === "object") {
      for (const [id, week] of Object.entries(data.weeks)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(id) || !week || !P.isPlan(week.plan)) continue;
        weeks[id] = {
          plan: P.sanitizePlan(week.plan),
          note: typeof week.note === "string" ? week.note.slice(0, 280) : "",
        };
      }
    }
    ask("Den Plan auf diesem Computer durch die Datei ersetzen?", () => {
      state.standard = P.sanitizePlan(data.standard);
      state.weeks = weeks;
      if (Array.isArray(data.presets)) state.presets = P.sanitizePresets(data.presets);
      persist(true);
      render();
      renderPresets();
      toast("Sicherung geladen.");
    });
  }

  function ask(message, onYes) {
    els.confirm.hidden = false;
    els.confirmText.textContent = message;
    els.confirmYes.onclick = () => {
      els.confirm.hidden = true;
      onYes();
    };
    els.confirmYes.focus();
    els.confirm.scrollIntoView({ block: "nearest" });
  }

  function toast(message) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 3200);
  }

  let persistChain = Promise.resolve();

  function persist(announce) {
    if (!password || !state) return;
    const snapshot = {
      standard: state.standard,
      weeks: state.weeks,
      lastWeekId: state.lastWeekId,
      hintDismissed: state.hintDismissed === true,
      presets: state.presets,
    };
    persistChain = persistChain
      .then(async () => {
        const secret = await P.encryptJson({
          standard: snapshot.standard,
          weeks: snapshot.weeks,
          presets: snapshot.presets,
        }, password);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          version: 2,
          lastWeekId: snapshot.lastWeekId,
          hintDismissed: snapshot.hintDismissed,
          secret,
        }));
        if (announce) markSaved();
      })
      .catch(() => {
        toast("Speichern fehlgeschlagen. Der Plan bleibt nur bis zum Schließen des Browsers.");
      });
  }

  function markSaved() {
    els.saved.hidden = false;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      els.saved.hidden = true;
    }, 1600);
  }

  async function loadState() {
    const base = {
      version: 2,
      standard: P.clonePlan(defaultStandard),
      weeks: {},
      presets: [],
      lastWeekId: P.toDateId(P.startOfWeek(new Date())),
      hintDismissed: false,
    };
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || raw.version !== 2) return base;
      base.hintDismissed = raw.hintDismissed === true;
      if (typeof raw.lastWeekId === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastWeekId)) {
        base.lastWeekId = raw.lastWeekId;
      }
      if (!raw.secret) return base;
      const secret = await P.decryptJson(raw.secret, password);
      if (P.isPlan(secret.standard)) base.standard = P.sanitizePlan(secret.standard);
      if (secret.weeks && typeof secret.weeks === "object") {
        for (const [id, week] of Object.entries(secret.weeks)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(id) || !week || !P.isPlan(week.plan)) continue;
          base.weeks[id] = {
            plan: P.sanitizePlan(week.plan),
            note: typeof week.note === "string" ? week.note.slice(0, 280) : "",
          };
        }
      }
      if (Array.isArray(secret.presets)) base.presets = P.sanitizePresets(secret.presets);
    } catch {
      return base;
    }
    return base;
  }

  async function unlock(pw, options) {
    const packed = await P.decryptJson(window.ALTENBACH_VAULT, pw);
    if (!packed || !P.isPlan(packed.standard)) throw new Error("Tresor ungültig");
    defaultStandard = P.sanitizePlan(packed.standard);
    password = pw;
    localStorage.removeItem(LEGACY_KEY);
    state = await loadState();
    weekId = P.toDateId(P.startOfWeek(P.parseDateId(state.lastWeekId)));
    if (options.storeDevice) {
      if (options.remember) localStorage.setItem(PASS_KEY, pw);
      else localStorage.removeItem(PASS_KEY);
    }
    sessionStorage.setItem(SESSION_KEY, pw);
    sessionStorage.removeItem(LOCK_KEY);
    els.lock.hidden = true;
    els.sheet.hidden = false;
    render();
    renderPresets();
  }

  async function onUnlock(event) {
    event.preventDefault();
    els.lockError.hidden = true;
    els.lockSubmit.disabled = true;
    els.lockSubmit.textContent = "Wird geprüft…";
    try {
      await unlock(els.lockPassword.value, {
        storeDevice: true,
        remember: els.lockRemember.checked,
      });
      els.lockPassword.value = "";
    } catch {
      els.lockError.hidden = false;
      els.lockPassword.focus();
      els.lockPassword.select();
    } finally {
      els.lockSubmit.disabled = false;
      els.lockSubmit.textContent = "Öffnen";
    }
  }

  function showGate() {
    els.sheet.hidden = true;
    els.lock.hidden = false;
    document.title = "Stundenplan · Altenbach";
    els.lockPassword.focus();
  }

  function lockApp() {
    if (els.editor.open) els.editor.close();
    password = "";
    state = null;
    defaultStandard = null;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(LOCK_KEY, "1");
    els.rota.replaceChildren();
    els.days.replaceChildren();
    els.note.value = "";
    els.confirm.hidden = true;
    showGate();
  }

  async function boot() {
    if (sessionStorage.getItem(LOCK_KEY) === "1") {
      showGate();
      return;
    }
    const candidate = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(PASS_KEY);
    if (candidate) {
      try {
        await unlock(candidate, { storeDevice: false });
        els.lockRemember.checked = Boolean(localStorage.getItem(PASS_KEY));
        return;
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(PASS_KEY);
      }
    }
    showGate();
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    const list = Array.isArray(children) ? children : children == null ? [] : [children];
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        node.setAttribute(key, value === true ? "" : String(value));
      }
    }
    for (const child of list) {
      node.append(child && child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }
})();
