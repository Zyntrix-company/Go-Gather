require('../setup');

const FLAGS = {
  TRIP_TIMEZONES: 'tripTimezones',
  SWEE_PLANNER_V2: 'sweePlannerV2',
  PROFILE_TRAVEL_PREFS: 'profileTravelPrefs',
};

const loadConfig = () => {
  let config;
  jest.isolateModules(() => { config = require('../../src/config'); });
  return config;
};

describe('feature flags', () => {
  const saved = {};
  beforeEach(() => {
    for (const env of Object.keys(FLAGS)) { saved[env] = process.env[env]; delete process.env[env]; }
  });
  afterEach(() => {
    for (const env of Object.keys(FLAGS)) {
      if (saved[env] === undefined) delete process.env[env]; else process.env[env] = saved[env];
    }
  });

  it('every flag defaults off when unset', () => {
    const { featureFlags } = loadConfig();
    for (const key of Object.values(FLAGS)) expect(featureFlags[key]).toBe(false);
  });

  it.each(Object.entries(FLAGS))('%s=on turns %s on; anything else keeps it off', (env, key) => {
    process.env[env] = 'on';
    expect(loadConfig().featureFlags[key]).toBe(true);
    for (const v of ['off', 'true', '1', 'ON', '']) {
      process.env[env] = v;
      expect(loadConfig().featureFlags[key]).toBe(false);
    }
  });
});
