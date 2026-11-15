/**
 * Planner v2 (SWEE_PLANNER_V2): free-time windows, durations, travel legs, validation,
 * repair + drop, caps. Gemini is mocked: the fake planner reads the windows from the prompt.
 */
const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  SchemaType: {
    OBJECT: 'object', ARRAY: 'array', STRING: 'string', INTEGER: 'integer',
  },
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(() => ({ generateContent: mockGenerateContent })),
  })),
}));

const config = require('../../src/config');
const { limits } = require('../../src/config/appLimits');
const {
  generatePlan,
  formatPlanPreview,
  sanitizePlanFacts,
  buildTravelLegs,
  buildFreeWindows,
  validateDay,
} = require('../../src/modules/ai/swee.itinerary');

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Windows the planner was asked to fill, read back from the prompt. */
function windowsInPrompt(prompt) {
  return [...prompt.matchAll(/^(\d{4}-\d{2}-\d{2}) \(\w+\): (.+)$/gm)].map(([, date, list]) => ({
    date,
    windows: list.split(', ').map((w) => {
      const [from, to] = w.split('–');
      return { from: toMin(from), to: toMin(to) };
    }),
  }));
}

let placeSeq = 0;
/** A well-behaved model: 90-minute stops with 20 minutes of travel, inside every window. */
function fillWindows(days, { duration = 90, travel = 20 } = {}) {
  const acts = [];
  for (const { date, windows } of days) {
    let first = true;
    for (const w of windows) {
      let t = w.from;
      while (t + (first ? 0 : travel) + duration <= w.to) {
        const start = t + (first ? 0 : travel);
        placeSeq += 1;
        acts.push({
          date,
          time: hhmm(start),
          durationMinutes: duration,
          travelMinutesFromPrevious: first ? 0 : travel,
          travelBy: first ? '' : 'metro',
          title: `Stop ${placeSeq}`,
          locationName: `Place ${placeSeq}`,
        });
        t = start + duration;
        first = false;
      }
    }
  }
  return acts;
}

function reply(activities) {
  return { response: { text: () => JSON.stringify({ activities }) } };
}

function autoPlan(transform = (acts) => acts) {
  mockGenerateContent.mockImplementation(async (prompt) => reply(transform(fillWindows(windowsInPrompt(prompt)), prompt)));
}

/** Every planned activity sits inside one window and never overlaps the previous one + travel. */
function assertValid(plan) {
  const windows = new Map(plan.windows.map((d) => [d.date, d.windows]));
  const byDate = new Map();
  for (const a of plan.activities.filter((x) => x.kind === 'activity')) {
    const start = toMin(a.time);
    const end = start + a.durationMinutes;
    expect((windows.get(a.date) || []).some((w) => start >= w.from && end <= w.to)).toBe(true);
    const prev = byDate.get(a.date);
    if (prev) expect(start).toBeGreaterThanOrEqual(prev + a.travelMinutesFromPrevious);
    byDate.set(a.date, end);
    expect(a.date >= plan.startDate && a.date <= plan.endDate).toBe(true);
  }
  const places = plan.activities.filter((x) => x.kind === 'activity').map((a) => a.locationName.toLowerCase());
  expect(new Set(places).size).toBe(places.length);
}

const DELHI_WORK = {
  destination: 'Delhi',
  startDate: '2026-12-06',
  endDate: '2026-12-19',
  timeZone: 'Asia/Kolkata',
  origin: 'Pune',
  originTimeZone: 'Asia/Kolkata',
  purpose: 'work',
  busy: [{ days: 'weekdays', from: '09:00', to: '17:00' }],
  travel: { mode: 'flight', booked: false, onboardMinutes: 130 },
  adults: 1,
};

describe('Planner v2', () => {
  const originalKey = config.gemini.apiKey;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    config.gemini.apiKey = 'test-key';
    placeSeq = 0;
  });

  afterAll(() => { config.gemini.apiKey = originalKey; });

  describe('free-time windows', () => {
    it('holiday day is roughly 09:00–21:00', () => {
      const [day] = buildFreeWindows(['2026-12-10']);
      expect(day.windows).toEqual([{ from: 540, to: 1260 }]);
    });

    it('work trip: weekday evenings 18:00–22:00 only, weekends free all day', () => {
      const busy = sanitizePlanFacts(DELHI_WORK).busy;
      const [mon, sat] = buildFreeWindows(['2026-12-07', '2026-12-12'], { busy });
      expect(mon.windows).toEqual([{ from: 18 * 60, to: 22 * 60 }]);
      expect(sat.windows).toEqual([{ from: 540, to: 1260 }]);
    });

    it('a busy block on a specific date leaves time around it', () => {
      const busy = sanitizePlanFacts({ busy: [{ days: ['2026-12-12'], from: '13:00', to: '17:00' }] }).busy;
      const [sat] = buildFreeWindows(['2026-12-12'], { busy });
      expect(sat.windows).toEqual([{ from: 540, to: 720 }, { from: 1080, to: 1320 }]);
    });
  });

  describe('travel legs', () => {
    it('unbooked domestic flight: door-to-door legs on the first and last day', () => {
      const legs = buildTravelLegs(sanitizePlanFacts(DELHI_WORK), 'Asia/Kolkata');
      expect(legs.legs).toHaveLength(2);
      const [out, back] = legs.legs;
      expect(out).toMatchObject({
        kind: 'travel', date: '2026-12-06', time: '06:00', title: 'Flight Pune → Delhi',
      });
      // 2 h 10 in the air + 2 h before + 45 min after
      expect(out.durationMinutes).toBe(130 + 120 + 45);
      expect(out.description).toBe('about 5 h door to door');
      expect(back).toMatchObject({ kind: 'travel', date: '2026-12-19', title: 'Flight Delhi → Pune' });
      expect(legs.arrival).toEqual({ date: '2026-12-06', minute: toMin('10:55') + 30 });
    });

    it('booked times are used as given', () => {
      const facts = sanitizePlanFacts({
        ...DELHI_WORK,
        travel: {
          mode: 'flight',
          booked: true,
          outbound: { departDate: '2026-12-06', departTime: '14:00', arriveTime: '16:15' },
          return: { departDate: '2026-12-19', departTime: '20:30', arriveTime: '22:40' },
        },
      });
      const { legs, arrival, leaveBy } = buildTravelLegs(facts, 'Asia/Kolkata');
      expect(legs[0].time).toBe('12:00'); // leave 2 h before the 14:00 flight
      expect(arrival).toEqual({ date: '2026-12-06', minute: toMin('17:00') + 30 });
      expect(legs[1].time).toBe('18:30');
      expect(leaveBy).toEqual({ date: '2026-12-19', minute: toMin('18:30') - 30 });
    });

    it('a booked arrival earlier than departure with no date is the next day', () => {
      const facts = sanitizePlanFacts({
        ...DELHI_WORK,
        startDate: '2026-12-07',
        travel: {
          mode: 'flight', booked: true, onboardMinutes: 480,
          outbound: { departDate: '2026-12-06', departTime: '22:00', arriveTime: '06:00' },
        },
      });
      const { legs, arrival } = buildTravelLegs(facts, 'Asia/Kolkata');
      expect(legs[0]).toMatchObject({ date: '2026-12-06', time: '20:00', durationMinutes: 120 + 480 + 45 });
      expect(arrival).toEqual({ date: '2026-12-07', minute: toMin('06:45') + 30 });
    });

    it('overnight train starts the evening before arrival and extends the trip start', () => {
      const facts = sanitizePlanFacts({
        destination: 'Mumbai', startDate: '2027-01-10', endDate: '2027-01-12', origin: 'Delhi',
        travel: { mode: 'train', onboardMinutes: 960 },
      });
      const { legs, startDate, arrival } = buildTravelLegs(facts, 'Asia/Kolkata');
      expect(legs[0]).toMatchObject({ date: '2027-01-09', time: '20:30', title: 'Train Delhi → Mumbai' });
      expect(startDate).toBe('2027-01-09');
      expect(arrival.date).toBe('2027-01-10');
    });

    it('international legs carry both local times', () => {
      const facts = sanitizePlanFacts({
        destination: 'London', startDate: '2027-05-10', endDate: '2027-05-16', timeZone: 'Europe/London',
        origin: 'Mumbai', originTimeZone: 'Asia/Kolkata', international: true,
        travel: {
          mode: 'flight', booked: true,
          outbound: { departDate: '2027-05-10', departTime: '02:00', arriveDate: '2027-05-10', arriveTime: '07:30' },
        },
      });
      const { legs } = buildTravelLegs(facts, 'Europe/London');
      expect(legs[0].description).toContain('Departs Mumbai 02:00 (IST), arrives London 07:30 (BST)');
      expect(legs[0].date).toBe('2027-05-09'); // leaves home 00:00 IST = 19:30 the previous evening in London
    });

    it('no origin or travel mode → no legs (nearby trip)', () => {
      const { legs, arrival } = buildTravelLegs(sanitizePlanFacts({ destination: 'Lonavala', startDate: '2026-12-10', endDate: '2026-12-11' }), 'Asia/Kolkata');
      expect(legs).toEqual([]);
      expect(arrival).toBeNull();
    });
  });

  describe('validateDay', () => {
    const windows = [{ from: 1080, to: 1320 }];

    it('accepts a clean evening and writes the duration/travel note', () => {
      const res = validateDay('2026-12-07', windows, [
        { time: '18:00', durationMinutes: 90, travelMinutesFromPrevious: 0, title: 'Dinner', locationName: 'Connaught Place' },
        { time: '19:50', durationMinutes: 60, travelMinutesFromPrevious: 20, travelBy: 'metro', title: 'Walk', locationName: 'Khan Market' },
      ], new Set());
      expect(res.errors).toBe(0);
      expect(res.activities[1]).toMatchObject({ kind: 'activity', durationMinutes: 60, description: 'about 1 h · 20 min by metro from the previous stop' });
    });

    it('drops a repeated place on its own without invalidating the day', () => {
      const res = validateDay('2026-12-07', windows, [
        { time: '18:00', durationMinutes: 60, title: 'Fort', locationName: 'Red Fort' },
        { time: '19:30', durationMinutes: 60, title: 'Dinner', locationName: "Karim's" },
        { time: '21:00', durationMinutes: 30, title: 'Walk', locationName: "Karim's" },
      ], new Set(['red fort']));
      expect(res.errors).toBe(0);
      expect(res.repeats).toBe(2);
      expect(res.activities.map((a) => a.title)).toEqual(['Dinner']);
    });

    it.each([
      ['outside the window', [{ time: '10:00', durationMinutes: 60, title: 'A', locationName: 'A' }]],
      ['running past the window', [{ time: '21:30', durationMinutes: 60, title: 'A', locationName: 'A' }]],
      ['overlapping incl. travel', [
        { time: '18:00', durationMinutes: 90, title: 'A', locationName: 'A' },
        { time: '19:40', durationMinutes: 30, travelMinutesFromPrevious: 20, title: 'B', locationName: 'B' },
      ]],
      ['malformed', [{ time: 'evening', durationMinutes: 60, title: 'A', locationName: 'A' }]],
    ])('flags an activity %s', (_label, raw) => {
      expect(validateDay('2026-12-07', windows, raw, new Set(['red fort'])).errors).toBeGreaterThan(0);
    });
  });

  describe('generatePlan', () => {
    it('Delhi 14-day work trip: legs first/last day, nothing 09:00–17:00 on weekdays', async () => {
      autoPlan();
      const plan = await generatePlan(sanitizePlanFacts(DELHI_WORK));
      assertValid(plan);
      expect(plan.activities[0]).toMatchObject({ kind: 'travel', date: '2026-12-06' });
      expect(plan.activities[plan.activities.length - 1]).toMatchObject({ kind: 'travel', date: '2026-12-19' });
      const weekdayClash = plan.activities.filter((a) => {
        if (a.kind !== 'activity') return false;
        const wd = new Date(`${a.date}T12:00:00Z`).getUTCDay();
        const s = toMin(a.time);
        return wd >= 1 && wd <= 5 && s < 17 * 60 && s + a.durationMinutes > 9 * 60;
      });
      expect(weekdayClash).toEqual([]);
      // Arrival day: nothing before arrival + transfer; departure day: nothing after leave-by.
      const leg0End = toMin(plan.activities[0].time) + plan.activities[0].durationMinutes;
      expect(plan.activities.filter((a) => a.date === '2026-12-06' && a.kind === 'activity')
        .every((a) => toMin(a.time) >= leg0End)).toBe(true);
      const last = plan.activities[plan.activities.length - 1];
      expect(plan.activities.filter((a) => a.date === '2026-12-19' && a.kind === 'activity')
        .every((a) => toMin(a.time) + a.durationMinutes <= toMin(last.time))).toBe(true);
    });

    it('repairs invalid days once and drops days that are still invalid', async () => {
      mockGenerateContent.mockImplementation(async (prompt) => {
        const days = windowsInPrompt(prompt);
        const acts = fillWindows(days);
        if (/broke the rules/.test(prompt)) {
          // The repair fixes the 11th but the 12th comes back outside its window again.
          return reply(acts.map((a) => (a.date === '2026-12-12' ? { ...a, time: '06:00' } : a)));
        }
        return reply(acts.map((a) => (a.date === '2026-12-11' || a.date === '2026-12-12' ? { ...a, time: '05:00' } : a)));
      });
      const plan = await generatePlan(sanitizePlanFacts({
        destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-13', timeZone: 'Asia/Kolkata',
      }));
      assertValid(plan);
      expect(plan.repaired).toBe(1);
      expect(plan.droppedDates).toEqual(['2026-12-12']);
      expect(plan.activities.some((a) => a.date === '2026-12-12')).toBe(false);
      expect(plan.activities.some((a) => a.date === '2026-12-11')).toBe(true);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('a free day the model skipped goes to the repair pass', async () => {
      mockGenerateContent.mockImplementation(async (prompt) => {
        const acts = fillWindows(windowsInPrompt(prompt));
        return reply(/broke the rules/.test(prompt) ? acts : acts.filter((a) => a.date !== '2026-12-11'));
      });
      const plan = await generatePlan(sanitizePlanFacts({
        destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-11', timeZone: 'Asia/Kolkata',
      }));
      expect(plan.repaired).toBe(1);
      expect(plan.activities.some((a) => a.date === '2026-12-11')).toBe(true);
    });

    it('never saves an activity outside the trip dates the model invents', async () => {
      autoPlan((acts) => [...acts, { ...acts[0], date: '2027-01-30', locationName: 'Elsewhere' }]);
      const plan = await generatePlan(sanitizePlanFacts({
        destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-11', timeZone: 'Asia/Kolkata',
      }));
      expect(plan.activities.every((a) => a.date >= '2026-12-10' && a.date <= '2026-12-11')).toBe(true);
    });

    it('refine: only the requested dates are planned', async () => {
      autoPlan();
      const plan = await generatePlan(sanitizePlanFacts({
        destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-14', timeZone: 'Asia/Kolkata',
      }), { dates: ['2026-12-12'] });
      expect(plan.plannedDates).toEqual(['2026-12-12']);
      expect(new Set(plan.activities.map((a) => a.date))).toEqual(new Set(['2026-12-12']));
    });

    it('caps days and activities from appLimits', async () => {
      autoPlan();
      const plan = await generatePlan(sanitizePlanFacts({
        destination: 'Japan', startDate: '2027-04-01', endDate: '2027-05-20', timeZone: 'Asia/Tokyo',
      }));
      expect(plan.truncated).toBe(true);
      expect(plan.plannedDates).toHaveLength(limits.itineraryMaxDays);
      expect(plan.activities.length).toBeLessThanOrEqual(limits.itineraryMaxActivities);
    });

    it('a tight time budget skips the repair pass and drops the invalid days (re-plan in /ai/execute)', async () => {
      autoPlan((acts) => acts.map((a) => (a.date === '2026-12-11' ? { ...a, time: '05:00' } : a)));
      const plan = await generatePlan(sanitizePlanFacts({
        destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-11', timeZone: 'Asia/Kolkata',
      }), { budgetMs: 5000 });
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(plan.droppedDates).toEqual(['2026-12-11']);
      expect(plan.repaired).toBe(0);
    });

    it('throws when every planner call fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('boom'));
      await expect(generatePlan(sanitizePlanFacts({
        destination: 'Goa', startDate: '2026-12-10', endDate: '2026-12-11',
      }))).rejects.toThrow('Itinerary generation failed');
    });

    it('returns an empty plan without dates (no model call)', async () => {
      const plan = await generatePlan(sanitizePlanFacts({ destination: 'Goa' }));
      expect(plan.activities).toEqual([]);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  describe('formatPlanPreview', () => {
    const acts = [
      { date: '2026-12-12', time: '09:00', title: 'Qutub Minar', description: 'about 2 h', kind: 'activity' },
      { date: '2026-12-12', time: '12:00', title: 'Lunch in Mehrauli', description: 'about 1 h · 20 min by cab from the previous stop', kind: 'activity' },
    ];

    it('short trips: bold day heading and one bullet per stop with its note', () => {
      const text = formatPlanPreview({ startDate: '2026-12-12', endDate: '2026-12-14', activities: acts }, 'Delhi');
      expect(text).toBe('**Sat 12 Dec**\n- 09:00 Qutub Minar · about 2 h\n- 12:00 Lunch in Mehrauli · about 1 h · 20 min by cab from the previous stop');
    });

    it('trips over 7 days: one compact line per day', () => {
      const text = formatPlanPreview({ startDate: '2026-12-06', endDate: '2026-12-19', activities: acts }, 'Delhi');
      expect(text).toBe('**Sat 12 Dec** — 09:00 Qutub Minar · 12:00 Lunch in Mehrauli');
    });

    it('names the place when the title does not', () => {
      const text = formatPlanPreview({
        startDate: '2026-12-12',
        endDate: '2026-12-12',
        activities: [
          { date: '2026-12-12', time: '18:00', title: 'Houseboat cruise', locationName: 'Vembanad Lake, Alleppey', kind: 'activity' },
          { date: '2026-12-12', time: '20:30', title: 'Dinner at Fort Kochi', locationName: 'Fort Kochi', kind: 'activity' },
        ],
      }, 'Kerala');
      expect(text).toBe('**Sat 12 Dec**\n- 18:00 Houseboat cruise (Vembanad Lake)\n- 20:30 Dinner at Fort Kochi');
    });

    it('international trips end with a one-line visa reminder', () => {
      const text = formatPlanPreview({ startDate: '2027-05-10', endDate: '2027-05-12', activities: acts, international: true }, 'London, UK');
      expect(text.split('\n').pop()).toBe('Please check the visa requirements for London, UK before you travel.');
    });
  });
});
