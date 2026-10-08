import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RoomSceneDevice from './RoomSceneDevice';
import { sceneDevicePlacement } from '../roomSceneLayout';

afterEach(cleanup);
describe('scene dragging', () => {
  it('previews movement during a drag, commits on release and cancels interrupted gestures', () => {
    const onChange = vi.fn();
    const placement = sceneDevicePlacement('living', 'smoke');
    const { container } = render(<div className="bir-canvas"><RoomSceneDevice scene="living" slot="smoke" placement={placement}
      selected editing label="Smoke detector" state="ok" controls="devices" onSelect={vi.fn()} onChange={onChange} /></div>);
    const button = screen.getByRole('button');
    Object.assign(button, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() });
    vi.spyOn(container.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => ({}) });
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      fireEvent(button, event);
    };
    pointer('pointerdown', 100, 100);
    pointer('pointermove', 140, 130);
    expect(button.style.left).toBe(`${placement.x + 10}%`);
    expect(button.style.top).toBe(`${placement.y + 10}%`);
    expect(onChange).not.toHaveBeenCalled();
    pointer('pointerup', 140, 130);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ x: placement.x + 10, y: placement.y + 10 }));
    onChange.mockClear();
    pointer('pointerdown', 100, 100); pointer('pointermove', 180, 190); pointer('pointercancel', 180, 190);
    expect(onChange).not.toHaveBeenCalled();
    expect(button.style.left).toBe(`${placement.x}%`);
  });
});
