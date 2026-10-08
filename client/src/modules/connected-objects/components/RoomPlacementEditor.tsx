import { FlipHorizontal2, RotateCcw } from 'lucide-react';
import { Button, NativeSelect, NativeSelectOption } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { normalizePlacement, PLACEMENT_LIMITS, sceneDevicePoses, type PlacementNumber, type SceneDevicePlacement, type SceneDevicePose } from '../roomSceneLayout';
import type { RoomDeviceSlot } from '../roomModel';

export default function RoomPlacementEditor({ name, slot, value, disabled, onChange, onReset }: {
  name: string; slot: RoomDeviceSlot; value: SceneDevicePlacement; disabled: boolean;
  onChange: (value: SceneDevicePlacement) => void; onReset: () => void;
}) {
  const { t } = useTranslation();
  const change = (patch: Partial<SceneDevicePlacement>) => onChange(normalizePlacement({ ...value, ...patch }, value));
  const range = (key: PlacementNumber, unit: string, step = 1) => <label className="bir-placement-range" key={key}>
    <span>{t(`connectedRooms.placement.${key}`)}<output>{value[key]}{unit}</output></span>
    <input type="range" min={PLACEMENT_LIMITS[key][0]} max={PLACEMENT_LIMITS[key][1]} step={step} value={value[key]}
      onChange={event => change({ [key]: Number(event.target.value) })} aria-label={t(`connectedRooms.placement.${key}`)} />
  </label>;
  return <fieldset className="bir-placement-editor" disabled={disabled}>
    <legend>{t('connectedRooms.placement.title')}</legend>
    <strong dir="auto">{name}</strong>
    <p>{t('connectedRooms.placement.hint')}</p>
    <label className="bir-placement-pose"><span>{t('connectedRooms.placement.pose')}</span>
      <NativeSelect value={value.pose} onChange={event => change({ pose: event.target.value as SceneDevicePose })} aria-label={t('connectedRooms.placement.pose')}>
        {sceneDevicePoses(slot).map(pose => <NativeSelectOption key={pose} value={pose}>{t(`connectedRooms.placement.${pose}`)}</NativeSelectOption>)}
      </NativeSelect>
    </label>
    <div className="bir-placement-grid">{range('x', '%', 0.1)}{range('y', '%', 0.1)}</div>
    {range('width', '%', 0.1)}{range('rotation', '°')}
    <details><summary>{t('connectedRooms.placement.perspective')}</summary>
      {range('tiltX', '°')}{range('tiltY', '°')}{range('skewY', '°')}
      <Button variant="outline" size="sm" aria-pressed={value.mirrored} onClick={() => change({ mirrored: !value.mirrored })}><FlipHorizontal2 size={15} />{t('connectedRooms.placement.mirror')}</Button>
    </details>
    <Button variant="ghost" size="sm" onClick={onReset}><RotateCcw size={15} />{t('connectedRooms.placement.reset')}</Button>
  </fieldset>;
}
