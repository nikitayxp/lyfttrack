const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

async function mountHeader(t, props) {
  const load = createSourceLoader({
    'react-native': {
      ActivityIndicator: 'ActivityIndicator',
      Platform: { select: variants => variants.default },
      Pressable: 'Pressable',
      StyleSheet: { create: styles => styles, hairlineWidth: 1 },
      Text: 'Text',
      View: 'View',
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({
      t: (key, options) => key === 'workout.sessionSetProgress'
        ? [options.completed, options.count].join('/')
        : key,
    }) },
    '@/context/WorkoutContext': { useWorkoutElapsedSeconds: () => 3665 },
  });
  const { ActiveWorkoutHeader } = load('app/src/components/workout/ActiveWorkoutHeader.tsx');
  let tree;
  await act(async () => {
    tree = create(React.createElement(ActiveWorkoutHeader, {
      title: 'Upper body',
      exercises: [],
      isTimerPaused: false,
      isSubmitting: false,
      isDiscarding: false,
      onMinimize() {},
      onDiscard() {},
      onToggleTimer() {},
      onFinish() {},
      ...props,
    }));
  });
  t.after(async () => { await act(async () => tree.unmount()); });
  return tree.root;
}

test('the active session shows its name, elapsed time and progress from actual sets', async t => {
  const header = await mountHeader(t, {
    exercises: [
      { id: 'bench', sets: [{ completed: true }, { completed: false }] },
      { id: 'row', sets: [{ completed: true }] },
    ],
  });
  const title = header.findByProps({ accessibilityRole: 'header' });
  assert.equal(title.props.children, 'Upper body');
  assert.ok(header.findAllByType('Text').some(node => node.props.children === '01:01:05'));
  const progress = header.findByProps({ accessibilityRole: 'progressbar' });
  assert.equal(progress.props.accessibilityLabel, '2/3');
  assert.equal(progress.props['aria-valuenow'], 2);
  assert.equal(progress.props['aria-valuemax'], 3);
  assert.equal(progress.props['aria-valuetext'], '2/3');
});

test('the waiting session omits empty progress and keeps recovery actions available', async t => {
  const calls = [];
  const header = await mountHeader(t, {
    isTimerPaused: true,
    onMinimize: () => calls.push('minimize'),
    onToggleTimer: () => calls.push('resume'),
    onDiscard: () => calls.push('discard'),
    onFinish: () => calls.push('finish'),
  });
  assert.equal(header.findAllByProps({ accessibilityRole: 'progressbar' }).length, 0);
  for (const label of [
    'workout.minimizeA11y',
    'workout.resumeTimer',
    'workout.discardA11y',
    'workout.finish',
  ]) {
    const button = header.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label);
    assert.ok(button);
    await act(async () => button.props.onPress());
  }
  assert.deepEqual(calls, ['minimize', 'resume', 'discard', 'finish']);
});
