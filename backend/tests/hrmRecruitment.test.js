const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../services/hrm/lifecycle');

const recruiter = { id: 'hr', permissions: ['hrm.recruitment', 'hrm.view_all'] };

function pipelineDb({ jobs = [], unassigned = 0, candidates = [] } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_records j/.test(sql)) return { rows: jobs };
      if (/count\(\*\)::int AS n/.test(sql)) return { rows: [{ n: unassigned }] };
      if (/FROM hrm_records k/.test(sql)) return { rows: candidates };
      return { rows: [] };
    }
  };
}
const job = (id, status = 'Open') => ({ id, title: 'Job ' + id, status, details: {}, candidates: 2, joined: 0 });

test('the pipeline lists open jobs and defaults to the first one', async () => {
  const db = pipelineDb({ jobs: [job('j1'), job('j2')], candidates: [{ id: 'c1', title: 'Asha', status: 'Applicant' }] });
  const result = await lifecycle.recruitmentPipeline(recruiter, {}, db);
  assert.equal(result.selectedJobId, 'j1');
  assert.deepEqual(result.stages.slice(0, 2), ['Applicant', 'Screening']);
  assert.equal(result.candidates.length, 1);
  const candidateQuery = db.calls.find((c) => /FROM hrm_records k/.test(c.sql));
  assert.deepEqual(candidateQuery.params, ['j1']);
});

test('a chosen job is honoured, and an unknown job falls back to the first', async () => {
  const jobs = [job('j1'), job('j2')];
  assert.equal((await lifecycle.recruitmentPipeline(recruiter, { jobId: 'j2' }, pipelineDb({ jobs }))).selectedJobId, 'j2');
  assert.equal((await lifecycle.recruitmentPipeline(recruiter, { jobId: 'nope' }, pipelineDb({ jobs }))).selectedJobId, 'j1');
});

test('candidates without a job are shown under "none" and need no query parameter', async () => {
  const db = pipelineDb({ jobs: [job('j1')], unassigned: 3 });
  const result = await lifecycle.recruitmentPipeline(recruiter, { jobId: 'none' }, db);
  assert.equal(result.selectedJobId, 'none');
  assert.equal(result.unassigned, 3);
  const candidateQuery = db.calls.find((c) => /FROM hrm_records k/.test(c.sql));
  assert.match(candidateQuery.sql, /k\.parent_id IS NULL/);
  assert.deepEqual(candidateQuery.params, []);
});

test('closed jobs are hidden unless asked for, and the board needs recruitment permission', async () => {
  const hidden = pipelineDb();
  await lifecycle.recruitmentPipeline(recruiter, {}, hidden);
  assert.match(hidden.calls[0].sql, /j\.status<>'Closed'/);
  const shown = pipelineDb();
  await lifecycle.recruitmentPipeline(recruiter, { includeClosed: 'true' }, shown);
  assert.doesNotMatch(shown.calls[0].sql, /j\.status<>'Closed'/);
  await assert.rejects(lifecycle.recruitmentPipeline({ id: 'x', permissions: [] }, {}, pipelineDb()), (e) => e.statusCode === 403);
});

function moveTx(candidate) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/FROM hrm_records WHERE id=\$1 AND kind='candidate'/.test(sql)) return { rows: candidate ? [candidate] : [] };
      if (/^UPDATE hrm_records/.test(sql.trim())) return { rows: [{ ...candidate, status: params[1], version: params[2] }] };
      if (/INSERT INTO hrm_audit/.test(sql)) return { rows: [{ id: 'a1' }] };
      return { rows: [] };
    }
  };
}
const candidate = { id: 'c1', kind: 'candidate', status: 'Screening', title: 'Asha', details: { email: 'a@x.com' }, version: 3 };

test('moving a candidate changes only the stage and bumps the version', async () => {
  const tx = moveTx(candidate);
  const saved = await lifecycle.moveCandidate(recruiter, 'c1', { status: 'Technical', version: 3 }, tx);
  assert.equal(saved.status, 'Technical');
  const update = tx.calls.find((c) => /^UPDATE hrm_records/.test(c.sql));
  assert.match(update.sql, /SET status=\$2,version=\$3,updated_at=\$4/);
  assert.ok(!/title|details|parent_id/.test(update.sql), 'details, title and job are untouched');
  assert.ok(tx.calls.some((c) => /INSERT INTO hrm_audit/.test(c.sql)));
});

test('joining only happens through the employee conversion, and joined candidates cannot move', async () => {
  await assert.rejects(lifecycle.moveCandidate(recruiter, 'c1', { status: 'Joined', version: 3 }, moveTx(candidate)), (e) => /Convert to employee/.test(e.message));
  await assert.rejects(
    lifecycle.moveCandidate(recruiter, 'c1', { status: 'Rejected', version: 3 }, moveTx({ ...candidate, status: 'Joined' })),
    (e) => e.statusCode === 409
  );
});

test('a stale version, an unknown stage and a missing candidate are rejected; a same-stage move is a no-op', async () => {
  await assert.rejects(lifecycle.moveCandidate(recruiter, 'c1', { status: 'HR', version: 1 }, moveTx(candidate)), (e) => e.statusCode === 409);
  await assert.rejects(lifecycle.moveCandidate(recruiter, 'c1', { status: 'Hired!', version: 3 }, moveTx(candidate)), (e) => e.statusCode === 400);
  await assert.rejects(lifecycle.moveCandidate(recruiter, 'zz', { status: 'HR', version: 3 }, moveTx(null)), (e) => e.statusCode === 404);
  const tx = moveTx(candidate);
  await lifecycle.moveCandidate(recruiter, 'c1', { status: 'Screening', version: 3 }, tx);
  assert.ok(!tx.calls.some((c) => /^UPDATE hrm_records/.test(c.sql)), 'no write when the stage is unchanged');
});
