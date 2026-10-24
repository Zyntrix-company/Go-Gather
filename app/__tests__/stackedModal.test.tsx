/**
 * StackedModal: on iOS only the first modal (or one nested in a native modal) is native;
 * a modal opened beside one that is showing is drawn in a FullWindowOverlay instead.
 */
import React from 'react';
import { Modal, Platform, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-screens', () => {
  const { View } = require('react-native');
  return { FullWindowOverlay: (props: any) => <View testID="full-window-overlay" {...props} /> };
});

import StackedModal from '../src/components/common/StackedModal';

function layers(root: ReactTestRenderer.ReactTestRenderer) {
  const nativeShown = root.root.findAllByType(Modal).filter(m => m.props.visible).length;
  const overlays = root.root.findAll(n => typeof n.type !== 'string' && n.props.testID === 'full-window-overlay').length;
  return { nativeShown, overlays };
}

function Screen({ a, b, nested }: { a: boolean; b: boolean; nested?: boolean }) {
  return (
    <>
      <StackedModal visible={a} transparent>
        <Text>A</Text>
        {nested && <StackedModal visible={b} transparent><Text>nested</Text></StackedModal>}
      </StackedModal>
      {!nested && <StackedModal visible={b} transparent><Text>B</Text></StackedModal>}
    </>
  );
}

const originalOS = Platform.OS;
function setOS(os: string) {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
}
afterAll(() => setOS(originalOS));

describe('StackedModal on iOS', () => {
  beforeAll(() => setOS('ios'));

  it('shows a lone modal natively', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b={false} />); });
    expect(layers(root)).toEqual({ nativeShown: 1, overlays: 0 });
    ReactTestRenderer.act(() => root.unmount());
  });

  it('draws a sibling opened over an open modal as an overlay', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b={false} />); });
    ReactTestRenderer.act(() => root.update(<Screen a b />));
    expect(layers(root).nativeShown).toBe(1);
    expect(layers(root).overlays).toBeGreaterThan(0);
    ReactTestRenderer.act(() => root.unmount());
  });

  it('keeps a modal nested inside a native modal native', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b={false} nested />); });
    ReactTestRenderer.act(() => root.update(<Screen a b nested />));
    expect(layers(root)).toEqual({ nativeShown: 2, overlays: 0 });
    ReactTestRenderer.act(() => root.unmount());
  });

  it('draws a modal opened while another is still closing as an overlay', () => {
    jest.useFakeTimers();
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b={false} />); });
    // Same tap closes A and opens B: A is still animating out on iOS.
    ReactTestRenderer.act(() => root.update(<Screen a={false} b />));
    expect(layers(root).overlays).toBe(1);
    ReactTestRenderer.act(() => root.update(<Screen a={false} b={false} />));
    ReactTestRenderer.act(() => { jest.runAllTimers(); });
    ReactTestRenderer.act(() => root.unmount());
    jest.useRealTimers();
  });

  it('frees the slot once iOS reports the modal dismissed', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b={false} />); });
    ReactTestRenderer.act(() => root.update(<Screen a={false} b={false} />));
    ReactTestRenderer.act(() => { root.root.findAllByType(Modal)[0].props.onDismiss(); });
    ReactTestRenderer.act(() => root.update(<Screen a={false} b />));
    expect(layers(root)).toEqual({ nativeShown: 1, overlays: 0 });
    ReactTestRenderer.act(() => root.unmount());
  });

  it('frees the slot when a pageSheet is swiped away while still marked visible', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b={false} />); });
    ReactTestRenderer.act(() => { root.root.findAllByType(Modal)[0].props.onDismiss(); });
    ReactTestRenderer.act(() => root.update(<Screen a={false} b={false} />));
    ReactTestRenderer.act(() => root.update(<Screen a={false} b />));
    expect(layers(root)).toEqual({ nativeShown: 1, overlays: 0 });
    ReactTestRenderer.act(() => root.unmount());
  });

  it('frees the slot on unmount so the next lone modal is native again', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b />); });
    ReactTestRenderer.act(() => root.unmount());
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a={false} b />); });
    expect(layers(root)).toEqual({ nativeShown: 1, overlays: 0 });
    ReactTestRenderer.act(() => root.unmount());
  });
});

describe('StackedModal on Android', () => {
  beforeAll(() => setOS('android'));

  it('always renders plain native modals', () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { root = ReactTestRenderer.create(<Screen a b />); });
    expect(layers(root)).toEqual({ nativeShown: 2, overlays: 0 });
    ReactTestRenderer.act(() => root.unmount());
  });
});
