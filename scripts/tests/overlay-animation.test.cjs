const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const createSourceLoader = require('./load-source.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;

function setup(platform = 'web') {
  let toast = null;
  let dismissed = 0;
  const sharedValues = [];
  const animations = [];
  const portalNodes = [];
  const body = {
    style: { overscrollBehaviorY: 'auto', overflow: 'visible' },
    children: [],
    appendChild(node) {
      node.parentNode?.removeChild(node);
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      this.children = this.children.filter(child => child !== node);
      node.parentNode = null;
    },
  };
  const document = {
    body,
    documentElement: { style: { overscrollBehaviorY: 'auto' } },
    addEventListener() {},
    removeEventListener() {},
    createElement() {
      const node = { style: {}, attributes: {}, parentNode: null, setAttribute(name, value) { this.attributes[name] = value; } };
      portalNodes.push(node);
      return node;
    },
  };
  const dismissToast = () => { dismissed++; };
  const load = createSourceLoader({
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', TouchableOpacity: 'Button',
      ActivityIndicator: 'Spinner', Modal: 'Modal',
      Platform: { OS: platform, select: values => values[platform] ?? values.default },
      StyleSheet: { create: styles => styles, absoluteFill: {} },
    },
    'react-native-reanimated': {
      __esModule: true,
      default: { View: 'AnimatedView' },
      useSharedValue(initial) {
        return React.useState(() => {
          let current = initial;
          const value = { get: () => current, set: next => { current = next; } };
          sharedValues.push(value);
          return value;
        })[0];
      },
      useAnimatedStyle: fn => fn(),
      withTiming(target, options, complete) {
        animations.push({ target, duration: options.duration, complete });
        return target;
      },
      withSpring: target => target,
      cancelAnimation() {},
      runOnJS: fn => fn,
      Easing: { cubic: 'cubic', quad: 'quad', out: value => value, in: value => value },
    },
    'react-native-gesture-handler': {
      GestureHandlerRootView: 'GestureRoot', GestureDetector: 'GestureDetector',
      Gesture: { Pan: () => {
        const gesture = {};
        for (const name of ['activeOffsetY', 'failOffsetX', 'onUpdate', 'onEnd']) {
          gesture[name] = value => { gesture[`${name}Value`] = value; return gesture; };
        }
        return gesture;
      } },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    'react-dom': { createPortal: (children, target) => React.createElement('Portal', { target }, children) },
    '@/context/ToastContext': { useAppToast: () => ({ toast, dismissToast }) },
  }, { document });
  return {
    load, sharedValues, animations, portalNodes, document,
    setToast(value) { toast = value; },
    get dismissed() { return dismissed; },
  };
}

test('native toast uses the shared-value accessors and keeps swipe dismissal', async t => {
  const fixture = setup('android');
  fixture.setToast({ message: 'Saved', tone: 'info' });
  const { AppToastHost } = fixture.load('app/src/components/common/AppToastHost.tsx');
  let tree;
  await act(async () => { tree = create(React.createElement(AppToastHost)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(fixture.sharedValues[0].get(), 0);
  const gesture = tree.root.findByType('GestureDetector').props.gesture;
  await act(async () => gesture.onEndValue({ translationX: 80, velocityX: 0, translationY: 0, velocityY: 0 }));
  assert.equal(fixture.dismissed, 1);
  fixture.setToast(null);
  await act(async () => tree.update(React.createElement(AppToastHost)));
  assert.equal(fixture.sharedValues[0].get(), 1);
  assert.equal(tree.toJSON(), null);
});

test('web toast reuses its portal and removes it after dismissal or unmount', async t => {
  const fixture = setup();
  const { AppToastHost } = fixture.load('app/src/components/common/AppToastHost.web.tsx');
  let tree;
  await act(async () => { tree = create(React.createElement(AppToastHost)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(fixture.document.body.children.length, 0);
  fixture.setToast({ message: 'First' });
  await act(async () => tree.update(React.createElement(AppToastHost)));
  const node = tree.root.findByType('Portal').props.target;
  assert.equal(fixture.document.body.children[0], node);
  fixture.setToast({ message: 'Second' });
  await act(async () => tree.update(React.createElement(AppToastHost)));
  assert.equal(fixture.portalNodes.length, 1);
  assert.equal(tree.root.findByType('Portal').props.target, node);
  fixture.setToast(null);
  await act(async () => tree.update(React.createElement(AppToastHost)));
  assert.equal(fixture.document.body.children.length, 0);
  fixture.setToast({ message: 'Third' });
  await act(async () => tree.update(React.createElement(AppToastHost)));
  await act(async () => tree.unmount());
  assert.equal(fixture.document.body.children.length, 0);
});

test('web confirmation keeps its fade-out and detaches the portal after closing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = setup();
  const { ConfirmModal } = fixture.load('app/src/components/common/ConfirmModal.web.tsx');
  const props = { visible: true, title: 'Confirm', confirmLabel: 'Save', cancelLabel: 'Cancel', onConfirm() {}, onCancel() {} };
  let tree;
  await act(async () => { tree = create(React.createElement(ConfirmModal, props)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(fixture.document.body.children.length, 1);
  assert.equal(fixture.portalNodes[0].attributes.role, 'dialog');
  await act(async () => tree.update(React.createElement(ConfirmModal, { ...props, visible: false })));
  assert.equal(fixture.document.body.children.length, 1);
  await act(async () => t.mock.timers.tick(140));
  assert.equal(tree.toJSON(), null);
  assert.equal(fixture.document.body.children.length, 0);
});

test('bottom sheet enables input after entry and restores body scrolling after exit', async t => {
  const fixture = setup();
  const { DismissibleBottomSheet } = fixture.load('app/src/components/common/DismissibleBottomSheet.tsx');
  const props = { visible: true, onClose() {}, children: 'Content' };
  let tree;
  await act(async () => { tree = create(React.createElement(DismissibleBottomSheet, props)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  assert.equal(fixture.document.body.style.overflow, 'hidden');
  assert.ok(tree.root.findAllByType('AnimatedView').some(view => view.props.pointerEvents === 'none'));
  const enter = fixture.animations.find(animation => animation.duration === 220 && animation.complete);
  await act(async () => enter.complete(true));
  assert.ok(tree.root.findAllByType('AnimatedView').some(view => view.props.pointerEvents === 'auto'));
  await act(async () => tree.update(React.createElement(DismissibleBottomSheet, { ...props, visible: false })));
  const exit = fixture.animations.find(animation => animation.target === 300 && animation.complete);
  await act(async () => exit.complete(true));
  assert.equal(tree.toJSON(), null);
  assert.equal(fixture.document.body.style.overflow, 'visible');
  assert.equal(fixture.document.documentElement.style.overscrollBehaviorY, 'auto');
});
