(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AltenbachPlan = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PEOPLE = [
    { id: "alex", name: "Alex" },
    { id: "miki", name: "Miki" },
    { id: "seferina", name: "Seferina" },
  ];

  const DAYS = [
    { id: "mon", label: "Montag", short: "Mo" },
    { id: "tue", label: "Dienstag", short: "Di" },
    { id: "wed", label: "Mittwoch", short: "Mi" },
    { id: "thu", label: "Donnerstag", short: "Do" },
    { id: "fri", label: "Freitag", short: "Fr" },
    { id: "sat", label: "Samstag", short: "Sa" },
    { id: "sun", label: "Sonntag", short: "So" },
  ];

  const MONTHS = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  // Between these times the kitchen should have someone on the floor.
  const SERVICE_START = 10 * 60;
  const SERVICE_END = 22 * 60;
  // Timeline draws one extra hour so a 22:00 end is not flush with the edge.
  const SCALE_START = 10 * 60;
  const SCALE_END = 23 * 60;

  const PRESETS = [
    { label: "Frei", shifts: [] },
    { label: "10–Ende", shifts: [{ start: "10:00", end: null }] },
    {
      label: "10–13 & 16–22",
      shifts: [
        { start: "10:00", end: "13:00" },
        { start: "16:00", end: "22:00" },
      ],
    },
    { label: "10–16", shifts: [{ start: "10:00", end: "16:00" }] },
    {
      label: "10–16 & 18:30–22",
      shifts: [
        { start: "10:00", end: "16:00" },
        { start: "18:30", end: "22:00" },
      ],
    },
    {
      label: "10–16 & 18–22",
      shifts: [
        { start: "10:00", end: "16:00" },
        { start: "18:00", end: "22:00" },
      ],
    },
    { label: "13–22", shifts: [{ start: "13:00", end: "22:00" }] },
    {
      label: "10–13 & 16–18:30",
      shifts: [
        { start: "10:00", end: "13:00" },
        { start: "16:00", end: "18:30" },
      ],
    },
  ];

  const VAULT_ITERATIONS = 200000;

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function deriveKey(password, salt, iterations) {
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function encryptJson(value, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt, VAULT_ITERATIONS);
    const plain = new TextEncoder().encode(JSON.stringify(value));
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
    return {
      v: 1,
      iterations: VAULT_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(cipher),
    };
  }

  async function decryptJson(vault, password) {
    if (!vault || vault.v !== 1 || !vault.salt || !vault.iv || !vault.data) {
      throw new Error("Tresor ungültig");
    }
    const key = await deriveKey(password, base64ToBytes(vault.salt), vault.iterations || VAULT_ITERATIONS);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(vault.iv) },
      key,
      base64ToBytes(vault.data),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function isTime(value) {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function toMinutes(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function formatMinutes(mins) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function clonePlan(plan) {
    return JSON.parse(JSON.stringify(plan));
  }

  function canonicalShifts(shifts) {
    return [...shifts]
      .map((shift) => ({
        start: shift.start,
        end: shift.end == null ? null : shift.end,
      }))
      .sort((a, b) => {
        const byStart = toMinutes(a.start) - toMinutes(b.start);
        if (byStart !== 0) return byStart;
        const aEnd = a.end == null ? 9999 : toMinutes(a.end);
        const bEnd = b.end == null ? 9999 : toMinutes(b.end);
        return aEnd - bEnd;
      });
  }

  function sanitizePlan(plan) {
    const next = {};
    for (const person of PEOPLE) {
      next[person.id] = {};
      for (const day of DAYS) {
        next[person.id][day.id] = canonicalShifts(plan[person.id][day.id]);
      }
    }
    return next;
  }

  function isPlan(plan) {
    if (!plan || typeof plan !== "object") return false;
    for (const person of PEOPLE) {
      const days = plan[person.id];
      if (!days || typeof days !== "object") return false;
      for (const day of DAYS) {
        const shifts = days[day.id];
        if (!Array.isArray(shifts)) return false;
        for (const shift of shifts) {
          if (!shift || !isTime(shift.start)) return false;
          if (shift.end != null && !isTime(shift.end)) return false;
        }
      }
    }
    return true;
  }

  function shiftsEqual(a, b) {
    return JSON.stringify(canonicalShifts(a)) === JSON.stringify(canonicalShifts(b));
  }

  function plansEqual(a, b) {
    return JSON.stringify(sanitizePlan(a)) === JSON.stringify(sanitizePlan(b));
  }

  function formatShift(shift) {
    if (shift.end == null) return `${shift.start}–Ende`;
    return `${shift.start}–${shift.end}`;
  }

  function formatShiftList(shifts) {
    if (!shifts.length) return "frei";
    return shifts.map(formatShift).join(" · ");
  }

  function validateShifts(shifts) {
    const errors = [];
    if (!Array.isArray(shifts)) return ["Ungültige Schichten."];
    for (const shift of shifts) {
      if (!isTime(shift.start)) {
        errors.push("Eine Startzeit fehlt oder ist ungültig.");
      } else if (shift.end != null && !isTime(shift.end)) {
        errors.push("Eine Endzeit ist ungültig.");
      } else if (shift.end != null && toMinutes(shift.end) <= toMinutes(shift.start)) {
        errors.push("Das Ende muss nach dem Anfang liegen.");
      }
    }
    if (errors.length) return [...new Set(errors)];
    const sorted = canonicalShifts(shifts);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const previousEnd = previous.end == null ? Infinity : toMinutes(previous.end);
      if (toMinutes(sorted[index].start) < previousEnd) {
        errors.push("Schichten dürfen sich nicht überschneiden.");
        break;
      }
    }
    return errors;
  }

  function personHours(plan, personId) {
    let minutes = 0;
    let open = 0;
    for (const day of DAYS) {
      for (const shift of plan[personId][day.id]) {
        if (shift.end == null) {
          open += 1;
        } else {
          minutes += toMinutes(shift.end) - toMinutes(shift.start);
        }
      }
    }
    return { minutes, open };
  }

  function formatDuration(mins) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours === 0) return `${minutes} Min.`;
    if (minutes === 0) return `${hours} Std.`;
    return `${hours} Std. ${minutes} Min.`;
  }

  function formatPersonLoad(plan, personId) {
    const { minutes, open } = personHours(plan, personId);
    if (minutes === 0 && open === 0) return "frei";
    const parts = [];
    if (minutes > 0) parts.push(formatDuration(minutes));
    if (open === 1) parts.push("1× bis Ende");
    if (open > 1) parts.push(`${open}× bis Ende`);
    return parts.join(" + ");
  }

  function findDayGaps(plan, dayId) {
    const covered = [];
    for (const person of PEOPLE) {
      for (const shift of plan[person.id][dayId]) {
        if (!isTime(shift.start)) continue;
        const start = toMinutes(shift.start);
        const end = shift.end == null ? SERVICE_END : toMinutes(shift.end);
        const from = Math.max(start, SERVICE_START);
        const to = Math.min(end, SERVICE_END);
        if (to > from) covered.push([from, to]);
      }
    }
    covered.sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cursor = SERVICE_START;
    for (const [start, end] of covered) {
      if (start > cursor) gaps.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < SERVICE_END) gaps.push([cursor, SERVICE_END]);
    return gaps.map(([start, end]) => ({ start, end }));
  }

  function formatGaps(gaps) {
    return gaps
      .map((gap) => `${formatMinutes(gap.start)}–${formatMinutes(gap.end)}`)
      .join(", ");
  }

  function startOfWeek(date) {
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = monday.getDay();
    const offset = weekday === 0 ? 6 : weekday - 1;
    monday.setDate(monday.getDate() - offset);
    return monday;
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function toDateId(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function parseDateId(id) {
    const [year, month, day] = id.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatRange(weekStart) {
    const weekEnd = addDays(weekStart, 6);
    if (weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear()) {
      return `${weekStart.getDate()}.–${weekEnd.getDate()}. ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
    }
    const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
    const start = `${weekStart.getDate()}. ${MONTHS[weekStart.getMonth()]}`;
    const end = `${weekEnd.getDate()}. ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
    return sameYear ? `${start} – ${end}` : `${start} ${weekStart.getFullYear()} – ${end}`;
  }

  function weekRelation(weekStart, today) {
    const diffDays = Math.round((startOfWeek(weekStart) - startOfWeek(today)) / 86400000);
    if (diffDays === 0) return "Diese Woche";
    if (diffDays === 7) return "Nächste Woche";
    if (diffDays === -7) return "Letzte Woche";
    if (diffDays > 0) return "Kommende Woche";
    return "Vergangene Woche";
  }

  function formatWhatsApp(plan, options = {}) {
    const lines = ["Stundenplan Küche Altenbach", options.title || "Winterplan", ""];
    if (options.note) {
      lines.push(options.note, "");
    }
    for (const day of DAYS) {
      lines.push(day.label);
      for (const person of PEOPLE) {
        const shifts = plan[person.id][day.id];
        const text = shifts.length ? shifts.map(formatShift).join(", ") : "frei";
        lines.push(`${person.name}: ${text}`);
      }
      lines.push("");
    }
    lines.push("Ende = Schlusszeit offen");
    return lines.join("\n");
  }

  function suggestNextShift(shifts) {
    if (!shifts.length) return { start: "10:00", end: "13:00" };
    const last = shifts[shifts.length - 1];
    if (last.end === "13:00") return { start: "16:00", end: "22:00" };
    if (last.end === "16:00") return { start: "18:30", end: "22:00" };
    return { start: "16:00", end: "22:00" };
  }

  function scalePercent(minutes) {
    const span = SCALE_END - SCALE_START;
    const raw = ((minutes - SCALE_START) / span) * 100;
    return Math.min(100, Math.max(0, raw));
  }

  return {
    PEOPLE,
    DAYS,
    MONTHS,
    PRESETS,
    SERVICE_START,
    SERVICE_END,
    SCALE_START,
    SCALE_END,
    isTime,
    toMinutes,
    formatMinutes,
    clonePlan,
    canonicalShifts,
    sanitizePlan,
    isPlan,
    shiftsEqual,
    plansEqual,
    formatShift,
    formatShiftList,
    validateShifts,
    personHours,
    formatDuration,
    formatPersonLoad,
    findDayGaps,
    formatGaps,
    startOfWeek,
    addDays,
    toDateId,
    parseDateId,
    formatRange,
    weekRelation,
    formatWhatsApp,
    suggestNextShift,
    scalePercent,
    encryptJson,
    decryptJson,
  };
});
