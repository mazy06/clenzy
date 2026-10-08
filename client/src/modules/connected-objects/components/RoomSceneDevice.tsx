import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { moveSceneDevice, normalizePlacement, sceneDeviceSprite, sceneSpriteTransform, spriteBounds, type SceneDevicePlacement } from '../roomSceneLayout';
import type { RoomArtwork, RoomDeviceSlot } from '../roomModel';

/** A small physical sprite with a separate, comfortable pointer target. */
export default function RoomSceneDevice({ scene, slot, placement, selected, editing, label, state, controls, onSelect, onChange, children }: {
  scene: RoomArtwork; slot: RoomDeviceSlot; placement: SceneDevicePlacement; selected: boolean; editing: boolean;
  label: string; state: string; controls: string; onSelect: () => void;
  onChange: (placement: SceneDevicePlacement) => void; children?: ReactNode;
}) {
  const drag = useRef<{ id: number; x: number; y: number; placement: SceneDevicePlacement; canvas: DOMRect } | null>(null);
  const [pending, setPending] = useState<SceneDevicePlacement | null>(null);
  const shown = pending ?? placement;
  const sprite = sceneDeviceSprite(slot, shown.pose, scene);
  const bounds = spriteBounds[sprite];
  const finishDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    drag.current = null;
    if (!cancelled) onChange(moveSceneDevice(current.placement, event.clientX - current.x, event.clientY - current.y, current.canvas));
    setPending(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <button type="button" className="bir-hotspot" data-kind={slot} data-state={state} data-editing={editing} data-anchor={shown.anchor}
    style={{ left: `${shown.x}%`, top: `${shown.y}%`, width: `${shown.width}%`, aspectRatio: `${bounds.viewBox[2]} / ${bounds.viewBox[3]}` }}
    aria-pressed={selected} aria-controls={controls} aria-label={label} title={label} onClick={onSelect}
    onPointerDown={event => {
      if (!editing || event.button !== 0) return;
      const canvas = event.currentTarget.closest('.bir-canvas')?.getBoundingClientRect();
      if (!canvas?.width || !canvas.height) return;
      event.preventDefault();
      event.currentTarget.focus();
      onSelect();
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, placement, canvas };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (current && event.pointerId === current.id) setPending(moveSceneDevice(current.placement, event.clientX - current.x, event.clientY - current.y, current.canvas));
    }}
    onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)}
    onLostPointerCapture={() => { drag.current = null; setPending(null); }}
    onKeyDown={event => {
      if (!editing) return;
      if (event.key === 'Escape' && drag.current) { drag.current = null; setPending(null); return; }
      const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!movement) return;
      event.preventDefault();
      const step = event.shiftKey ? 2 : 0.5;
      onChange(normalizePlacement({ ...placement, x: placement.x + movement[0] * step, y: placement.y + movement[1] * step }, placement));
    }}>
    <svg className="bir-hotspot-art" viewBox={bounds.viewBox.join(' ')} aria-hidden="true" focusable="false" style={{ transform: sceneSpriteTransform(shown) }}>
      <image href={`/images/connected-devices/scene/baitly-${sprite}.webp`} width={bounds.width} height={bounds.height} />
    </svg>
    {children}
    <span className="bir-hotspot-indicator" aria-hidden="true" />
  </button>;
}
