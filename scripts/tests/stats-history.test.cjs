const assert = require('node:assert/strict');
const { test } = require('node:test');
const loadSource = require('./load-source.cjs');
function setup({ count = 1005, oneWorkoutPerSet = false, failLater = false, fractionalRecords = false, distinctExercises = false, unfinished = false, equalWeightRecords = false } = {}) {
    const user = 'owner';
    const now = Date.now();
    const workouts = Array.from({ length: oneWorkoutPerSet ? count : Math.ceil(count / 100) }, (_, i) => ({ id: `w${String(i).padStart(6, '0')}`, user_id: user, start_time: new Date(now - 86400000).toISOString(), end_time: new Date(now - 82800000).toISOString() }));
    const sets = Array.from({ length: count }, (_, i) => ({ id: `s${String(i).padStart(6, '0')}`, exercise_id: i === count - 1 ? 'second' : 'first', weight: i === count - 1 ? 1 : 10, reps: 2, rir: 2, set_type: 'normal', set_number: i % 100 + 1, workout_id: workouts[oneWorkoutPerSet ? i : Math.floor(i / 100)].id, workouts: workouts[oneWorkoutPerSet ? i : Math.floor(i / 100)], exercises: { id: i === count - 1 ? 'second' : 'first', name: i === count - 1 ? 'Second' : 'First', muscle_group: 'chest' } }));
    if (fractionalRecords || equalWeightRecords) {
        sets[0].weight = equalWeightRecords ? 50 : 10.06;
        sets[1].weight = equalWeightRecords ? 50 : 10.09;
        sets[1].workouts = { ...sets[1].workouts, end_time: new Date(now).toISOString() };
    }
    if (distinctExercises) {
        sets.forEach((row, i) => {
            row.exercise_id = `exercise${String(i).padStart(6, '0')}`;
            row.exercises = { id: row.exercise_id, name: `Exercise ${i}`, muscle_group: 'chest' };
        });
    }
    const relations = workouts.map(w => ({ id: `r${w.id}`, exercise_id: 'first', workout_id: w.id, workouts: w, sets: sets.filter(s => s.workout_id === w.id && s.exercise_id === 'first') })).filter(r => r.sets.length > 0);
    const other = { id: 'other-workout', user_id: 'other', start_time: new Date(now - 86400000).toISOString(), end_time: new Date(now - 82800000).toISOString() };
    workouts.push(other);
    sets.push({ ...sets[0], id: 'z-other-set', exercise_id: 'private', workout_id: other.id, workouts: other, weight: 1000, exercises: { id: 'private', name: 'Private', muscle_group: 'chest' } });
    if (unfinished) {
        const draft = { ...workouts[0], id: 'draft', end_time: null };
        sets.push({ ...sets[0], id: 'z-draft-heavy', workout_id: draft.id, workouts: draft, weight: 2000 });
        sets.push({ ...sets[0], id: 'z-draft-only', exercise_id: 'draft-only', exercises: { id: 'draft-only', name: 'Draft only' }, workout_id: draft.id, workouts: draft, weight: 3000 });
    }
    const exercises = [...new Map(sets.map(row => [row.exercise_id, row.exercises])).values()];
    const calls = [];
    function value(row, key) { return key.split('.').reduce((v, k) => v?.[k], row); }
    const supabase = { from(table) {
            const call = { table, filters: [], orders: [], nestedFilters: [], nestedOrders: [], range: [0, 999] };
            function filter(key, predicate) {
                if (key.startsWith('sets.')) call.nestedFilters.push(row => predicate(value(row, key.slice(5))));
                else call.filters.push(row => predicate(value(row, key)));
            }
            const query = {
                select(columns) { call.columns = columns; return query; },
                eq(key, v) { filter(key, value => value === v); return query; },
                not(key, _operator, v) { filter(key, value => value !== v); return query; },
                gt(key, v) { filter(key, value => value > v); if (key === 'id')
                    call.cursor = v; return query; },
                gte(key, v) { call.filters.push(r => value(r, key) >= v); return query; },
                in(key, values) { call.filters.push(r => values.includes(value(r, key))); return query; },
                order(key, { ascending, referencedTable }) { (referencedTable === 'sets' ? call.nestedOrders : call.orders).push({ key: key.replace('workouts(end_time)', 'workouts.end_time'), ascending }); return query; },
                limit(count, { referencedTable } = {}) { if (referencedTable === 'sets') call.nestedLimit = count; return query; },
                range(a, b) { call.range = [a, b]; return query; },
                then(resolve, reject) { calls.push(call); if (failLater && call.cursor)
                    return Promise.resolve({ data: null, error: { message: 'later page unavailable' } }).then(resolve, reject); let rows = (table === 'sets' ? sets : table === 'workouts' ? workouts : table === 'exercises' ? exercises : relations).filter(r => call.filters.every(f => f(r)));
                    if (table === 'exercises') {
                        rows = rows.map(exercise => ({ ...exercise, sets: sets.filter(row => row.exercise_id === exercise.id && call.nestedFilters.every(filter => filter(row))).sort((a, b) => {
                            for (const order of call.nestedOrders) {
                                const av = value(a, order.key), bv = value(b, order.key);
                                if (av !== bv) return (av > bv ? 1 : -1) * (order.ascending ? 1 : -1);
                            }
                            return 0;
                        }).slice(0, call.nestedLimit) })).filter(exercise => exercise.sets.length > 0);
                    }
                    rows.sort((a, b) => { for (const order of call.orders) {
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
    const { stats } = setup({ failLater: true, distinctExercises: true });
    await assert.rejects(stats.getTrackedExercises(), /later page unavailable/);
});

test('tracked exercises do not download a page for each 1000 historical sets', async () => {
    const { stats, calls } = setup({ count: 3001 });
    assert.equal((await stats.getTrackedExercises()).length, 2);
    assert.equal(calls.length, 1);
});

test('trophy reads return the same records without downloading every historical set', async () => {
    const { stats, calls } = setup({ count: 3001 });
    assert.equal((await stats.getAllTimePRs()).length, 2);
    assert.equal(calls.length, 1);
});

test('the exercise catalog itself remains complete beyond 1000 tracked exercises', async () => {
    const { stats } = setup({ count: 1005, distinctExercises: true });
    assert.equal((await stats.getTrackedExercises()).length, 1005);
    assert.equal((await stats.getAllTimePRs()).length, 1005);
});
test('record dates belong to the heaviest raw weight before display rounding', async () => {
    const { stats, now } = setup({ count: 3, fractionalRecords: true });
    const record = (await stats.getAllTimePRs()).find(r => r.exerciseId === 'first');
    assert.equal(record.maxWeight, 10.1);
    assert.equal(record.achievedAt, new Date(now).toISOString());
});

test('equal heaviest weights use the most recent completed workout date', async () => {
    const { stats, now } = setup({ count: 3, oneWorkoutPerSet: true, equalWeightRecords: true });
    const record = (await stats.getAllTimePRs()).find(r => r.exerciseId === 'first');
    assert.equal(record.maxWeight, 50);
    assert.equal(record.achievedAt, new Date(now).toISOString());
});

test('unfinished and foreign sets cannot affect tracked exercises or the best set', async () => {
    const { stats } = setup({ count: 3, unfinished: true });
    assert.equal((await stats.getTrackedExercises()).length, 2);
    const records = await stats.getAllTimePRs();
    assert.equal(records.length, 2);
    assert.equal(records.find(r => r.exerciseId === 'first').maxWeight, 10);
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
