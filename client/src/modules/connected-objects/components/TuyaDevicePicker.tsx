import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from '../../../icons/glyphs';
import { Spinner } from '../../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  NativeSelect,
  NativeSelectOption,
} from '../../../components/ui';
import { tuyaApi } from '../../../services/api/noiseApi';
import DevicePairingGuide from './DevicePairingGuide';
import { useTranslation } from '../../../hooks/useTranslation';

interface TuyaDevicePickerProps {
  /** Filtre par catégorie Tuya (ex: 'sp' caméra, 'wk' thermostat). Si le filtre ne ramène rien, on montre tout. */
  category?: string;
  selectedId: string;
  onSelect: (deviceId: string) => void;
}

/**
 * Sélecteur d'appareils découverts sur le compte Tuya relié de l'organisation (plug-and-play).
 * Remplace la saisie manuelle d'un device_id : interroge {@code tuyaApi.listDevices()}, filtre par
 * catégorie selon le type d'objet, et renvoie le device_id choisi. Org-scopé côté backend
 * (listOrgDevices). NON VALIDÉ faute de compte Tuya réel.
 */
export default function TuyaDevicePicker({ category, selectedId, onSelect }: TuyaDevicePickerProps) {
  const { t } = useTranslation();
  const { data: devices = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tuya-devices'],
    queryFn: () => tuyaApi.listDevices(),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 py-1.5">
        <Spinner className="size-4" />
        <p className="text-xs text-muted-foreground">{t('connectedObjects.picker.tuyaSearching')}</p>
      </div>
    );
  }
  if (isError) {
    return (
      <Alert variant="warning" className="py-0.5">
        <TriangleAlert />
        <AlertDescription>{t('connectedObjects.picker.tuyaUnlinked')} <strong>{t('connectedObjects.picker.integrationsPath')}</strong>.</AlertDescription>
      </Alert>
    );
  }

  const filtered = category ? devices.filter((d) => d.category === category) : devices;
  const list = filtered.length > 0 ? filtered : devices; // repli : montre tout si le filtre ne ramène rien

  if (list.length === 0) {
    return (
      <div>
        <Alert variant="info" className="py-0.5">
          <Info />
          <AlertDescription>{t('connectedObjects.picker.tuyaEmpty')}</AlertDescription>
        </Alert>
        <DevicePairingGuide onRefresh={() => { void refetch(); }} refreshing={isFetching} />
      </div>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor="tuya-device">Appareil Tuya</FieldLabel>
      <NativeSelect
        id="tuya-device"
        className="w-full"
        required
        value={list.some((d) => d.id === selectedId) ? selectedId : ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {list.map((d) => (
          <NativeSelectOption key={d.id} value={d.id} disabled={d.alreadyAdded}>
            {(d.name || d.id)
              + (d.category ? ` · ${d.category}` : '')
              + (d.online ? '' : ` · ${t('connectedObjects.picker.offline')}`)
              + (d.alreadyAdded ? ` · ${t('connectedObjects.picker.alreadyAdded')}` : '')}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription>{t('connectedObjects.picker.tuyaHint')}</FieldDescription>
    </Field>
  );
}
