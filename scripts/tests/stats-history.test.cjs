const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs');
function setup({ count = 1005, oneWorkoutPerSet = false, failLater = false, fractionalRecords = false } = {}) {
    const user = 'owner';
    const now = Date.now();
    const workouts = Array.from({ length: oneWorkoutPerSet ? count : Math.ceil(count / 100) }, (_, i) => ({ id: `w${String(i).padStart(6, '0')}`, user_id: user, start_time: new Date(now - 86400000).toISOString(), end_time: new Date(now - 82800000).toISOString() }));
    const sets = Array.from({ length: count }, (_, i) => ({ id: `s${String(i).padStart(6, '0')}`, exercise_id: i === count - 1 ? 'second' : 'first', weight: i === count - 1 ? 1 : 10, reps: 2, rir: 2, set_type: 'normal', set_number: i % 100 + 1, workout_id: workouts[oneWorkoutPerSet ? i : Math.floor(i / 100)].id, workouts: workouts[oneWorkoutPerSet ? i : Math.floor(i / 100)], exercises: { id: i === count - 1 ? 'second' : 'first', name: i === count - 1 ? 'Second' : 'First', muscle_group: 'chest' } }));
    if (fractionalRecords) {
        sets[0].weight = 10.06;
        sets[1].weight = 10.09;
        sets[1].workouts = { ...sets[1].workouts, end_time: new Date(now).toISOString() };
    }
    const relations = workouts.map(w => ({ id: `r${w.id}`, exercise_id: 'first', workout_id: w.id, workouts: w, sets: sets.filter(s => s.workout_id === w.id && s.exercise_id === 'first') })).filter(r => r.sets.length > 0);
    const other = { id: 'other-workout', user_id: 'other', start_time: new Date(now - 86400000).toISOString(), end_time: new Date(now - 82800000).toISOString() };
    workouts.push(other);
    sets.push({ ...sets[0], id: 'z-other-set', exercise_id: 'private', workout_id: other.id, workouts: other, weight: 1000, exercises: { id: 'private', name: 'Private', muscle_group: 'chest' } });
    const calls = [];
    function value(row, key) { return key.split('.').reduce((v, k) => v?.[k], row); }
    const supabase = { from(table) {
            const call = { table, filters: [], orders: [], range: [0, 999] };
            const query = {
                select(columns) { call.columns = columns; return query; },
                eq(key, v) { call.filters.push(r => value(r, key) === v); return query; },
                not(key, _operator, v) { call.filters.push(r => value(r, key) !== v); return query; },
                gt(key, v) { call.filters.push(r => value(r, key) > v); if (key === 'id')
                    call.cursor = v; return query; },
                gte(key, v) { call.filters.push(r => value(r, key) >= v); return query; },
                in(key, values) { call.filters.push(r => values.includes(value(r, key))); return query; },
                order(key, { ascending }) { call.orders.push({ key, ascending }); return query; },
                range(a, b) { call.range = [a, b]; return query; },
                then(resolve, reject) { calls.push(call); if (failLater && call.cursor)
                    return Promise.resolve({ data: null, error: { message: 'later page unavailable' } }).then(resolve, reject); let rows = (table === 'sets' ? sets : table === 'workouts' ? workouts : relations).filter(r => call.filters.every(f => f(r))); rows.sort((a, b) => { for (const order of call.orders) {
                    const av = value(a, order.key), bv = value(b, order.key);
                    const c = av === bv ? 0 : av > bv ? 1 : -1;
                    if (c)
                        return order.ascending ? c : -c;
                } return 0; }); return Promise.resolve({ data: rows.slice(call.range[0], call.range[1] + 1), error: null }).then(resolve, reject); }
            };
            return query;
        } };
    const stats = loadSource({ '@/services/supabase': { supabase }, '@/services/workoutService': { getAuthenticatedUserOrThrow: async () => ({ id: user }), normalizeSetType: v => v ?? 'normal' } })('app/src/services/statsService.ts');
    return { stats, calls, now };
}
test('tracked exercises include an exercise appearing after the server row cap', async () => {
    const { stats } = setup();
    assert.equal((await stats.getTrackedExercises()).length, 2);
});
test('all-time records include a light exercise after more than 1000 heavier sets', async () => {
    const { stats } = setup();
    assert.equal((await stats.getAllTimePRs()).length, 2);
});

test('record muscle metadata is available without another catalog query', async () => {
    const { stats } = setup();
    const records = await stats.getAllTimePRs();
    assert.ok(records.every(record => record.muscleKey === 'chest'));
});
test('exercise progress and records count every owned set', async () => {
    const { stats } = setup();
    const points = await stats.getExerciseProgress('first');
    assert.equal(points.reduce((n, p) => n + p.volumeTotal, 0), 20080);
    assert.equal((await stats.getExercisePersonalRecords('first')).completedSetCount, 1004);
});
test('different workouts with identical timestamps each contribute their duration', async () => {
    const { stats } = setup();
    const points = await stats.getExerciseProgress('first', 'duration');
    assert.equal(points.reduce((n, p) => n + p.durationMinutes, 0), 660);
});
test('dashboard totals do not silently stop after 1000 sets', async () => {
    const { stats } = setup();
    const points = await stats.getWeeklyDashboardMetrics();
    assert.equal(points.reduce((n, p) => n + p.volumeKg, 0), 20082);
    assert.equal(points.reduce((n, p) => n + p.repsTotal, 0), 2010);
});
test('muscle totals, weekly duration and history include all pages', async () => {
    const { stats } = setup({ count: 1201, oneWorkoutPerSet: true });
    assert.equal((await stats.getWeeklyVolumeByMuscle()).reduce((n, p) => n + p.sets, 0), 1201);
    assert.equal((await stats.getWeeklyTrainingHours()).reduce((n, p) => n + p.workouts, 0), 1201);
    assert.equal((await stats.getExerciseWorkoutHistory('first')).length, 1200);
});
test('a later page failure rejects instead of presenting incomplete statistics', async () => {
    const { stats } = setup({ failLater: true });
    await assert.rejects(stats.getTrackedExercises(), /later page unavailable/);
});
test('record dates belong to the heaviest raw weight before display rounding', async () => {
    const { stats, now } = setup({ count: 3, fractionalRecords: true });
    const record = (await stats.getAllTimePRs()).find(r => r.exerciseId === 'first');
    assert.equal(record.maxWeight, 10.1);
    assert.equal(record.achievedAt, new Date(now).toISOString());
});

test('empty accounts return empty charts and zero records', async () => {
    const { stats } = setup({ count: 0 });
    assert.equal((await stats.getTrackedExercises()).length, 0);
    assert.equal((await stats.getAllTimePRs()).length, 0);
    assert.equal((await stats.getExerciseProgress('first')).length, 0);
    assert.equal((await stats.getExerciseWorkoutHistory('first')).length, 0);
    assert.equal((await stats.getWeeklyDashboardMetrics()).length, 0);
    assert.equal((await stats.getWeeklyVolumeByMuscle()).length, 0);
    assert.equal((await stats.getExercisePersonalRecords('first')).completedSetCount, 0);
});
