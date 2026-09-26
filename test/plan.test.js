const test = require("node:test");
const assert = require("node:assert/strict");
const plan = require("../plan.js");

const {
  PEOPLE,
  DAYS,
  DEFAULT_STANDARD,
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
} = plan;

test("Donnerstag ist die Grundanpassung, Seferina bleibt", () => {
  assert.deepEqual(DEFAULT_STANDARD.alex.thu, [
    { start: "10:00", end: "13:00" },
    { start: "16:00", end: "18:30" },
  ]);
  assert.deepEqual(DEFAULT_STANDARD.miki.thu, [
    { start: "10:00", end: "16:00" },
    { start: "18:30", end: "22:00" },
  ]);
  assert.deepEqual(DEFAULT_STANDARD.seferina.thu, [{ start: "13:00", end: "22:00" }]);
  assert.deepEqual(DEFAULT_STANDARD.seferina.thu, DEFAULT_STANDARD.seferina.wed);
});

test("offene Schichten und freie Tage", () => {
  assert.deepEqual(DEFAULT_STANDARD.alex.sun, [{ start: "10:00", end: null }]);
  assert.deepEqual(DEFAULT_STANDARD.miki.sun, []);
  assert.deepEqual(DEFAULT_STANDARD.seferina.sun, []);
  assert.deepEqual(DEFAULT_STANDARD.alex.mon, []);
  assert.deepEqual(DEFAULT_STANDARD.miki.mon, [{ start: "10:00", end: null }]);
  assert.deepEqual(DEFAULT_STANDARD.seferina.mon, []);
  assert.deepEqual(DEFAULT_STANDARD.seferina.tue, []);
  assert.deepEqual(DEFAULT_STANDARD.miki.wed, [{ start: "10:00", end: "16:00" }]);
});

test("Freitag und Samstag sind gleich, Dienstagabend beginnt später", () => {
  for (const person of PEOPLE) {
    assert.deepEqual(DEFAULT_STANDARD[person.id].fri, DEFAULT_STANDARD[person.id].sat);
  }
  assert.equal(DEFAULT_STANDARD.miki.tue[1].start, "18:30");
  assert.equal(DEFAULT_STANDARD.miki.fri[1].start, "18:00");
  assert.equal(DEFAULT_STANDARD.alex.fri[1].end, "22:00");
});

test("Wochenstunden zählen Ende nicht als feste Zeit", () => {
  assert.equal(personHours(DEFAULT_STANDARD, "alex").minutes, 2490);
  assert.equal(personHours(DEFAULT_STANDARD, "alex").open, 1);
  assert.equal(formatPersonLoad(DEFAULT_STANDARD, "alex"), "41 Std. 30 Min. + 1× bis Ende");
  assert.equal(personHours(DEFAULT_STANDARD, "miki").minutes, 2700);
  assert.equal(personHours(DEFAULT_STANDARD, "miki").open, 1);
  assert.equal(formatPersonLoad(DEFAULT_STANDARD, "miki"), "45 Std. + 1× bis Ende");
  assert.equal(personHours(DEFAULT_STANDARD, "seferina").minutes, 2160);
  assert.equal(formatPersonLoad(DEFAULT_STANDARD, "seferina"), "36 Std.");
});

test("der Standard hat zwischen 10 und 22 Uhr keine Lücke", () => {
  for (const day of DAYS) {
    assert.deepEqual(findDayGaps(DEFAULT_STANDARD, day.id), [], day.label);
  }
});

test("Lücken nur wenn wirklich niemand da ist", () => {
  const custom = clonePlan(DEFAULT_STANDARD);
  custom.alex.tue = [{ start: "10:00", end: "13:00" }];
  custom.miki.tue = [];
  custom.seferina.tue = [];
  assert.equal(formatGaps(findDayGaps(custom, "tue")), "13:00–22:00");

  custom.seferina.tue = [{ start: "13:00", end: "22:00" }];
  assert.deepEqual(findDayGaps(custom, "tue"), []);
});

test("offene Schicht deckt den Tag bis 22 Uhr", () => {
  assert.deepEqual(findDayGaps(DEFAULT_STANDARD, "sun"), []);
  assert.deepEqual(findDayGaps(DEFAULT_STANDARD, "mon"), []);
});

test("WhatsApp-Text nennt den angepassten Donnerstag", () => {
  const text = formatWhatsApp(DEFAULT_STANDARD, { title: "Winterplan" });
  const thursday = text.split("Donnerstag\n")[1].split("\n\n")[0];
  assert.equal(
    thursday,
    ["Alex: 10:00–13:00, 16:00–18:30", "Miki: 10:00–16:00, 18:30–22:00", "Seferina: 13:00–22:00"].join("\n"),
  );
  assert.match(text, /Sonntag\nAlex: 10:00–Ende\nMiki: frei\nSeferina: frei/);
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

test("ungültige Schichten werden erkannt, der Plan bleibt prüfbar", () => {
  assert.deepEqual(
    validateShifts([
      { start: "16:00", end: "13:00" },
    ]),
    ["Das Ende muss nach dem Anfang liegen."],
  );
  assert.deepEqual(
    validateShifts([
      { start: "10:00", end: "16:00" },
      { start: "15:00", end: "18:00" },
    ]),
    ["Schichten dürfen sich nicht überschneiden."],
  );
  assert.deepEqual(validateShifts([{ start: "10:00", end: null }]), []);

  const broken = clonePlan(DEFAULT_STANDARD);
  delete broken.seferina;
  assert.equal(isPlan(broken), false);
  assert.equal(isPlan(DEFAULT_STANDARD), true);

  const reversed = clonePlan(DEFAULT_STANDARD);
  reversed.alex.thu = [
    { start: "16:00", end: "18:30" },
    { start: "10:00", end: "13:00" },
  ];
  assert.equal(shiftsEqual(reversed.alex.thu, DEFAULT_STANDARD.alex.thu), true);
  assert.equal(plansEqual(sanitizePlan(reversed), DEFAULT_STANDARD), true);
});
