import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBaitlyTextWidth } from '../hooks/useBaitlyTextWidth';

function Label({ text }: { text: string }) {
  const { ref, width } = useBaitlyTextWidth(text, 'fr');
  return <><span ref={ref}>{text}</span><output aria-label={text}>{width}</output></>;
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('mesure partagée du planning Baitly', () => {
  it('partage un observateur, actualise les largeurs et libère chaque élément', () => {
    let emit: ResizeObserverCallback;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    const observer = vi.fn(function (callback: ResizeObserverCallback) {
      emit = callback;
      return { observe, unobserve, disconnect };
    });
    vi.stubGlobal('ResizeObserver', observer);
    let width = 42;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width }) as DOMRect);
    const { unmount } = render(<><Label text="Alice" /><Label text="Bob" /></>);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Alice')).toHaveTextContent('42');
    width = 65;
    act(() => { emit([{ target: screen.getByText('Alice') }] as ResizeObserverEntry[], {} as ResizeObserver); });
    expect(screen.getByLabelText('Alice')).toHaveTextContent('65');
    expect(screen.getByLabelText('Bob')).toHaveTextContent('42');
    unmount();
    expect(unobserve).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
