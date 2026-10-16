import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyField, BaitlyNotice, BaitlyText } from '@/design-system/components';
import { BaitlySegmented } from '@/design-system/primitives';
import { useBaitlyTheme } from '@/design-system/theme';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { addDemoStepPhoto } from './baitlyDemoWork';
import { workApi } from './api';
import type { MissionStepHandle } from './MissionDiagnostic';

async function uploadSignature(id: number, dataUrl: string) {
  if (id < 0) { addDemoStepPhoto(id, 'signature'); return; }
  const uri = `${FileSystem.cacheDirectory}baitly-signature-${id}-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, dataUrl.replace(/^data:image\/png;base64,/, ''), { encoding: FileSystem.EncodingType.Base64 });
  const form = new FormData();
  form.append('photoType', 'after');
  form.append('photos', { uri, type: 'image/png', name: `baitly-${id}-step-signature-${Date.now()}.png` } as unknown as Blob);
  try { await interventionsApi.uploadPhotos(id, form); } finally { await FileSystem.deleteAsync(uri, { idempotent: true }); }
}

/**
 * Last step of an on-site mission: the client signs on the screen, or the worker declares that no
 * client was present. Saved by the step's main button; only what the server stores counts.
 */
export const MissionSignature = forwardRef<MissionStepHandle, {
  id: number; status?: 'SIGNED' | 'CLIENT_ABSENT' | null; signerName?: string | null; disabled: boolean;
  onDrawing: (drawing: boolean) => void; onReady: (ready: boolean) => void;
}>(function MissionSignature({ id, status, signerName, disabled, onDrawing, onReady }, ref) {
  const { t } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const pad = useRef<SignatureViewRef>(null);
  const pending = useRef<{ resolve: (dataUrl: string) => void; reject: (error: Error) => void } | null>(null);
  const [mode, setMode] = useState<'sign' | 'absent'>(status === 'CLIENT_ABSENT' ? 'absent' : 'sign');
  const [name, setName] = useState(signerName ?? '');
  const [drawn, setDrawn] = useState(false);
  const [editing, setEditing] = useState(!status);
  const ready = !editing || mode === 'absent' || (drawn && !!name.trim());
  useEffect(() => { onReady(ready); }, [ready, onReady]);
  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!editing) return;
      if (mode === 'absent') { await workApi.signature(id, { status: 'CLIENT_ABSENT' }); setEditing(false); return; }
      // The pad hands the image back through onOK: wait for it before sending anything.
      const dataUrl = await new Promise<string>((resolve, reject) => { pending.current = { resolve, reject }; pad.current?.readSignature(); });
      await uploadSignature(id, dataUrl);
      await workApi.signature(id, { status: 'SIGNED', signerName: name.trim() });
      setEditing(false);
    },
  }));

  if (!editing && status) return <View style={styles.root}>
    <BaitlyNotice tone="success">{status === 'SIGNED' ? t('signatureDoneBy', { name: signerName ?? '' }) : t('signatureAbsentDone')}</BaitlyNotice>
    <BaitlyButton variant="ghost" title={t('edit')} disabled={disabled} onPress={() => { setEditing(true); setDrawn(false); }} />
  </View>;

  return <View style={styles.root}>
    <BaitlySegmented value={mode} onChange={setMode} options={[{ value: 'sign', label: t('signatureClientSigns') }, { value: 'absent', label: t('signatureNoClient') }]} />
    {mode === 'sign' ? <>
      <BaitlyField label={t('signatureClientName')} value={name} onChangeText={setName} maxLength={160} autoComplete="name" editable={!disabled} />
      <View style={styles.label}><BaitlyText style={{ fontWeight: '600' }}>{t('signatureHere')}</BaitlyText>
        <BaitlyButton variant="ghost" title={t('signatureClear')} disabled={disabled || !drawn} onPress={() => { pad.current?.clearSignature(); setDrawn(false); }} /></View>
      <View pointerEvents={disabled ? 'none' : 'auto'} style={[styles.pad, { borderColor: c.border, backgroundColor: c.surface }]}>
        <SignatureCanvas ref={pad} autoClear={false} descriptionText="" imageType="image/png"
          onBegin={() => onDrawing(true)} onEnd={() => { onDrawing(false); setDrawn(true); }}
          onOK={dataUrl => { pending.current?.resolve(dataUrl); pending.current = null; }}
          onEmpty={() => { setDrawn(false); pending.current?.reject(new Error('Empty signature')); pending.current = null; }}
          webStyle={`.m-signature-pad{box-shadow:none;border:none;margin:0;height:100%;width:100%}.m-signature-pad--body{border:none}.m-signature-pad--footer{display:none}body,html{margin:0;height:100%}`} />
      </View>
      <BaitlyText muted variant="meta">{t('signatureConsent')}</BaitlyText>
    </> : <BaitlyNotice>{t('signatureAbsentHelp')}</BaitlyNotice>}
  </View>;
});
const styles = StyleSheet.create({
  root: { gap: 14 },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pad: { height: 220, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
});
