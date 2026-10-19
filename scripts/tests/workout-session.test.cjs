const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { create, act } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

const session = id => id ? { user: { id } } : null;
const exercise = id => ({
  id: `block-${id}`,
  exercise: { id, name: id },
  defaultRestSeconds: 90,
  sets: [],
  notes: `notes-${id}`,
});

async function setup(t, options = {}) {
  const values = new Map();
  let authListener;
  let context;
  let elapsedSeconds;
  const load = createSourceLoader({
    'react-native': {
      Platform: { OS: 'ios' },
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      Animated: { Value: class { setValue() {} stopAnimation() {} } },
      Vibration: { vibrate() {} },
    },
    'expo-haptics': {},
    'expo-keep-awake': { activateKeepAwakeAsync: async () => {}, deactivateKeepAwake: async () => {} },
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async key => { values.delete(key); },
    },
    '@/services/supabase': { supabase: { auth: {
      getSession: options.getSession ?? (async () => ({ data: { session: session('A') } })),
      onAuthStateChange: callback => {
        authListener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      startAutoRefresh() {}, stopAutoRefresh() {},
    } } },
    '@/services/workoutService': { getPreviousExercisePerformance: options.getPerformance ?? (async () => []) },
  }, { Date: options.Date ?? Date });
  const { WorkoutProvider, useWorkoutContext, useWorkoutElapsedSeconds } = load('app/src/context/WorkoutContext.tsx');
  const storage = load('app/src/services/offlineSyncService.ts');
  function Consumer() {
    context = useWorkoutContext();
    options.onRender?.();
    return null;
  }
  function TimerConsumer() {
    elapsedSeconds = useWorkoutElapsedSeconds();
    return null;
  }
  let tree;
  await act(async () => { tree = create(React.createElement(WorkoutProvider, null, React.createElement(Consumer), React.createElement(TimerConsumer))); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return {
    get current() { return { ...context, elapsedSeconds }; },
    storage,
    values,
    changeUser: id => act(async () => authListener('SIGNED_IN', session(id))),
    run: fn => act(async () => fn(context)),
  };
}

test('workout data consumers are not rendered by each clock tick', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let now = Date.UTC(2026, 9, 19, 12);
  let renders = 0;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const app = await setup(t, { Date: Clock, onRender: () => { renders += 1; } });
  await app.run(c => c.setActiveExercisesWithRef([exercise('A')]));
  const before = renders;
  now += 2000;
  await act(async () => t.mock.timers.tick(2000));
  assert.equal(app.current.elapsedSeconds, 2);
  assert.equal(renders, before, 'the clock notified a data-only consumer');
});

test('discarding a paused workout resets pause and its saved elapsed value', async t => {
  const app = await setup(t);
  await app.run(c => c.setActiveExercisesWithRef([exercise('A')]));
  await app.run(c => c.toggleTimerPause());
  assert.equal(app.current.isTimerPaused, true);
  await app.run(c => c.clearExercises());
  await app.run(c => c.setActiveExercisesWithRef([exercise('new')]));
  assert.equal(app.current.isTimerPaused, false);
  assert.equal(app.current.elapsedSeconds, 0);
});

test('changing accounts clears live data and preserves the previous account draft before debounce', async t => {
  const app = await setup(t);
  await app.run(c => { c.setWorkoutName('Workout A'); c.setActiveExercisesWithRef([exercise('A')]); });
  await app.changeUser(null);
  await app.changeUser('B');
  assert.equal(app.current.currentUserId, 'B');
  assert.equal(app.current.activeExercises.length, 0);
  assert.equal(app.current.workoutName, null);
  const previous = await app.storage.loadWorkoutDraft('A');
  assert.equal(previous?.exercises[0]?.notes, 'notes-A');
  assert.equal(await app.storage.loadWorkoutDraft('B'), null);
  await app.changeUser('A');
  assert.equal(app.current.activeExercises[0]?.notes, 'notes-A');
  assert.equal(app.current.didRestoreDraft, true);
});

test('token refresh for the same account retains the active session', async t => {
  const app = await setup(t);
  await app.run(c => c.setActiveExercisesWithRef([exercise('A')]));
  const startedAt = app.current.workoutStartedAtMs;
  await app.changeUser('A');
  assert.equal(app.current.activeExercises[0]?.exercise.id, 'A');
  assert.equal(app.current.workoutStartedAtMs, startedAt);
});

test('save identity survives pause, resume and restoring the same account draft', async t => {
  let now = Date.UTC(2026, 9, 18, 12);
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const app = await setup(t, { Date: Clock });
  await app.run(c => c.setActiveExercisesWithRef([exercise('A')]));
  const sessionStart = app.current.workoutSessionStartedAtMs;
  assert.equal(typeof sessionStart, 'number');
  const timerStart = app.current.workoutStartedAtMs;
  await app.run(c => c.toggleTimerPause());
  now += 60_000;
  await app.run(c => c.toggleTimerPause());
  assert.notEqual(app.current.workoutStartedAtMs, timerStart);
  assert.equal(app.current.workoutSessionStartedAtMs, sessionStart);
  await app.changeUser('B');
  const saved = await app.storage.loadWorkoutDraft('A');
  assert.equal(saved.sessionStartTime, new Date(sessionStart).toISOString());
  await app.changeUser('A');
  assert.equal(app.current.workoutSessionStartedAtMs, sessionStart);
});

test('an old session bootstrap cannot overwrite a newer authentication event', async t => {
  let resolveSession;
  const app = await setup(t, { getSession: () => new Promise(resolve => { resolveSession = resolve; }) });
  await app.changeUser('B');
  await app.run(() => resolveSession({ data: { session: session('A') } }));
  assert.equal(app.current.currentUserId, 'B');
});

test('an exercise request started by another account cannot add to the new workout', async t => {
  let resolvePerformance;
  const app = await setup(t, { getPerformance: () => new Promise(resolve => { resolvePerformance = resolve; }) });
  await app.run(c => c.addExercise({ id: 'A', name: 'Private A' }));
  await app.changeUser('B');
  await app.run(() => resolvePerformance([]));
  assert.equal(app.current.activeExercises.length, 0);
  assert.equal(await app.storage.loadWorkoutDraft('B'), null);
});

test('a cleared completed draft is not recreated when the account changes', async t => {
  const app = await setup(t);
  await app.run(c => c.setActiveExercisesWithRef([exercise('A')]));
  await app.run(c => c.clearDraft());
  await app.changeUser('B');
  assert.equal(await app.storage.loadWorkoutDraft('A'), null);
});
