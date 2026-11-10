// Settings values partly fixed in code:
// - brand logos are static frontend files and never stored;
// - lead / client / project statuses and lead sources: the built-in lists in config/pipelineFields.js
//   always come first; only values an admin adds are stored, after them.
// No database: the repository is stubbed with the same merge + split the real update() does.
const test = require('node:test');
const assert = require('node:assert/strict');

const settingsModel = require('../models/settings.model');
const { PIPELINE_STATUSES, PIPELINE_SOURCES } = require('../config/pipelineFields');

const repo = settingsModel.settingsRepository;

function storedRow() {
  // How findById hydrates a row: payload keys are spread to the top level and kept under payload.
  const payload = { logos: { primary: 'https://drive.google.com/uc?id=old' }, ui: { density: 'compact' } };
  return {
    id: 'default',
    company: { name: 'Webitof' },
    branding: { primaryColor: '#4361ee' },
    // An older full list: built-in labels (other colours) plus one value an admin had added.
    statuses: { leads: [{ label: 'New', color: '#000000' }, { label: 'Site Visit', color: '#0EA5E9', state: 'open' }] },
    sources: { leads: ['Website', 'Dealer Meet'] },
    ...payload,
    payload
  };
}

function stubRepo(t) {
  const state = { row: storedRow(), written: null };
  t.mock.method(repo, 'findById', async () => state.row);
  t.mock.method(repo, 'upsert', async (data) => {
    // Same as baseModel update(): stored row under the patch, then split into columns + payload.
    const merged = { ...state.row, ...data };
    const split = repo.splitRecord(merged);
    state.written = JSON.parse(JSON.stringify(split));
    state.row = {
      ...merged,
      statuses: JSON.parse(state.written.statuses),
      sources: JSON.parse(state.written.sources),
      payload: state.written.payload
    };
    return state.row;
  });
  return state;
}

test('reads give the built-in lists first, then the stored custom values; never logos', async (t) => {
  stubRepo(t);
  const read = await settingsModel.getSettings();
  const leadLabels = read.statuses.leads.map((item) => item.label);
  assert.deepEqual(leadLabels.slice(0, PIPELINE_STATUSES.leads.length), PIPELINE_STATUSES.leads.map((item) => item.label));
  assert.equal(read.statuses.leads.find((item) => item.label === 'New').color, PIPELINE_STATUSES.leads[0].color, 'built-in wins');
  assert.deepEqual(read.statuses.leads.at(-1), { label: 'Site Visit', color: '#0ea5e9', state: 'open', custom: true });
  assert.deepEqual(read.statuses.clients, PIPELINE_STATUSES.clients);
  assert.deepEqual(read.sources.leads, [...PIPELINE_SOURCES.leads, 'Dealer Meet']);
  assert.deepEqual(read.customSources.leads, ['Dealer Meet']);
  assert.equal(read.logos, undefined);
  assert.equal(read.payload.logos, undefined);

  // A caller editing the returned lists cannot change the built-in ones.
  read.statuses.leads[0].label = 'Hacked';
  assert.equal((await settingsModel.getSettings()).statuses.leads[0].label, 'New');
});

test('saving stores only cleaned custom values; built-ins, duplicates and logos are dropped', async (t) => {
  const state = stubRepo(t);
  const saved = await settingsModel.updateSettings({
    statuses: {
      leads: [
        ...PIPELINE_STATUSES.leads,
        { label: '  Site   Visit ', color: 'red', state: 'maybe', custom: true },
        { label: 'site visit', color: '#111111' },
        { label: '<b>Proposal</b>', color: '#22C55E', state: 'won' },
        { label: '   ' }
      ]
    },
    sources: { leads: ['Website', 'Dealer Meet', 'dealer meet', 'Shop Visit'] },
    logos: { primary: '/x.png' },
    customSources: { leads: ['Ignored'] },
    branding: { primaryColor: '#000000' }
  });

  assert.deepEqual(JSON.parse(state.written.statuses), {
    leads: [
      { label: 'Site Visit', color: '#64748b', state: 'open' },
      { label: 'bProposal/b', color: '#22c55e', state: 'won' }
    ],
    clients: [],
    projects: []
  });
  assert.deepEqual(JSON.parse(state.written.sources), { leads: ['Dealer Meet', 'Shop Visit'] });
  assert.equal(state.written.payload.logos, undefined, 'logos are not written to the payload column');
  assert.equal(state.written.payload.customSources, undefined, 'derived keys are not stored');
  assert.deepEqual(state.written.payload.ui, { density: 'compact' }, 'other payload settings are kept');

  assert.deepEqual(saved.sources.leads, [...PIPELINE_SOURCES.leads, 'Dealer Meet', 'Shop Visit']);
  assert.equal(saved.statuses.leads.length, PIPELINE_STATUSES.leads.length + 2);
  assert.equal(saved.branding.primaryColor, '#000000');
});

test('removing a custom value keeps the built-in ones and the other modules', async (t) => {
  const state = stubRepo(t);
  await settingsModel.updateSettings({ statuses: { clients: [{ label: 'Prospect', color: '#f59e0b' }] } });
  const current = await settingsModel.getSettings();
  // The UI sends the full list of one module without the removed value.
  await settingsModel.updateSettings({ statuses: { leads: current.statuses.leads.filter((item) => item.label !== 'Site Visit') } });
  const stored = JSON.parse(state.written.statuses);
  assert.deepEqual(stored.leads, []);
  assert.deepEqual(stored.clients, [{ label: 'Prospect', color: '#f59e0b' }]);
  const read = await settingsModel.getSettings();
  assert.equal(read.statuses.leads.length, PIPELINE_STATUSES.leads.length);
});

test('project phases drive the active / completed counts, including custom and legacy statuses', () => {
  const { countProjectsByPhase, projectPhase } = require('../config/pipelineFields');
  assert.equal(projectPhase('In Progress'), 'open');
  assert.equal(projectPhase('Handed Over'), 'completed');
  assert.equal(projectPhase('AMC'), 'completed');
  assert.equal(projectPhase('Cancelled'), 'cancelled');
  // Statuses older versions offered outside the list.
  assert.equal(projectPhase('Active'), 'open');
  assert.equal(projectPhase('Archived'), 'completed');
  assert.equal(projectPhase('Something unknown'), 'open');

  const settings = { statuses: { projects: [...PIPELINE_STATUSES.projects, { label: 'Signed Off', phase: 'completed', custom: true }] } };
  const counts = countProjectsByPhase(
    [{ status: 'Design' }, { status: 'Live' }, { status: 'Signed Off' }, { status: 'Cancelled' }, { status: 'Active' }, {}],
    settings
  );
  assert.deepEqual(counts, { open: 3, completed: 2, cancelled: 1 });
});

test('a custom project status keeps its phase when saved', async (t) => {
  const state = stubRepo(t);
  await settingsModel.updateSettings({ statuses: { projects: [{ label: 'Signed Off', color: '#22C55E', phase: 'completed' }, { label: 'Parked', phase: 'weird' }] } });
  assert.deepEqual(JSON.parse(state.written.statuses).projects, [
    { label: 'Signed Off', color: '#22c55e', phase: 'completed' },
    { label: 'Parked', color: '#64748b', phase: 'open' }
  ]);
});
