const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const plan = require("../plan.js");
const vault = require("../vault.js");

const {
  PEOPLE,
  DAYS,
  clonePlan,
  personHours,
  formatPersonLoad,
  findDayGaps,
  formatGaps,
  formatWhatsApp,
  startOfWeek,
  addDays,
  toDateId,
  formatRange,
  weekRelation,
  validateShifts,
  isPlan,
  sanitizePlan,
  shiftsEqual,
  plansEqual,
  encryptJson,
  decryptJson,
} = plan;

function blankDays() {
  return Object.fromEntries(DAYS.map((day) => [day.id, []]));
}

function samplePlan() {
  const schedule = {};
  for (const person of PEOPLE) schedule[person.id] = blankDays();
  schedule.alex.sun = [{ start: "09:00", end: null }];
  schedule.alex.tue = [{ start: "09:00", end: "12:00" }];
  schedule.miki.mon = [{ start: "11:00", end: "15:00" }];
  schedule.seferina.wed = [{ start: "13:00", end: "22:00" }];
  return schedule;
}

test("Stunden zählen offene Schichten nicht als feste Zeit", () => {
  const schedule = samplePlan();
  assert.equal(personHours(schedule, "alex").open, 1);
  assert.equal(personHours(schedule, "alex").minutes, 180);
  assert.equal(formatPersonLoad(schedule, "alex"), "3 Std. + 1× bis Ende");
  assert.equal(formatPersonLoad(schedule, "seferina"), "9 Std.");
  assert.equal(personHours(schedule, "miki").open, 0);
});

test("eine Lücke gibt es nur, wenn niemand da ist", () => {
  const schedule = samplePlan();
  assert.equal(formatGaps(findDayGaps(schedule, "tue")), "12:00–22:00");
  schedule.seferina.tue = [{ start: "12:00", end: "22:00" }];
  assert.deepEqual(findDayGaps(schedule, "tue"), []);
  assert.deepEqual(findDayGaps(schedule, "sun"), []);
});

test("WhatsApp-Text nennt frei und Ende", () => {
  const text = formatWhatsApp(samplePlan(), { title: "Test" });
  assert.match(text, /Sonntag\nAlex: 09:00–Ende\nMiki: frei\nSeferina: frei/);
  assert.match(text, /Ende = Schlusszeit offen/);
});

test("Woche beginnt am Sonntag, auch über den Monatswechsel", () => {
  const saturday = new Date(2026, 8, 26);
  const sunday = startOfWeek(saturday);
  assert.equal(toDateId(sunday), "2026-09-20");
  assert.equal(saturday.getDay(), 6);
  assert.equal(formatRange(sunday), "20.–26. September 2026");
  assert.equal(weekRelation(sunday, saturday), "Diese Woche");
  assert.equal(weekRelation(addDays(sunday, 7), saturday), "Nächste Woche");
  assert.equal(formatRange(new Date(2026, 8, 27)), "27. September – 3. Oktober 2026");
});

test("ungültige Schichten werden erkannt", () => {
  assert.deepEqual(validateShifts([{ start: "16:00", end: "13:00" }]), ["Das Ende muss nach dem Anfang liegen."]);
  assert.deepEqual(
    validateShifts([
      { start: "10:00", end: "16:00" },
      { start: "15:00", end: "18:00" },
    ]),
    ["Schichten dürfen sich nicht überschneiden."],
  );
  assert.deepEqual(validateShifts([{ start: "10:00", end: null }]), []);

  const schedule = samplePlan();
  const broken = clonePlan(schedule);
  delete broken.seferina;
  assert.equal(isPlan(broken), false);
  assert.equal(isPlan(schedule), true);

  const reversed = clonePlan(schedule);
  reversed.alex.tue = [
    { start: "12:00", end: "15:00" },
    { start: "09:00", end: "12:00" },
  ];
  schedule.alex.tue = [
    { start: "09:00", end: "12:00" },
    { start: "12:00", end: "15:00" },
  ];
  assert.equal(shiftsEqual(reversed.alex.tue, schedule.alex.tue), true);
  assert.equal(plansEqual(sanitizePlan(reversed), schedule), true);
});

test("falsches Passwort öffnet den Tresor nicht", async () => {
  const sealed = await encryptJson({ standard: samplePlan() }, "richtig");
  const opened = await decryptJson(sealed, "richtig");
  assert.equal(isPlan(opened.standard), true);
  await assert.rejects(() => decryptJson(sealed, "falsch"));
});

test("der veröffentlichte Tresor enthält den Plan nicht im Klartext", () => {
  const source = fs.readFileSync(require.resolve("../vault.js"), "utf8");
  assert.equal(vault.v, 1);
  assert.equal(typeof vault.data, "string");
  for (const secret of ["10:00", "18:30", "22:00", "Seferina", "Ende"]) {
    assert.equal(source.includes(secret), false, secret);
  }
});
