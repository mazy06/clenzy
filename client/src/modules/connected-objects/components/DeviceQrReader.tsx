import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, Button, Field, FieldDescription, FieldLabel, Input } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { identifyDeviceQr, type DeviceQrHint } from '../deviceOnboardingCatalog';

interface QrDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type QrDetectorConstructor = {
  new (options: { formats: string[] }): QrDetector;
  getSupportedFormats(): Promise<string[]>;
};

/** Camera access is opt-in. Payloads stay in memory and never become navigation or credentials. */
export default function DeviceQrReader({ onHint }: { onHint: (hint: DeviceQrHint) => void }) {
  const { t } = useTranslation();
  const [payload, setPayload] = useState('');
  const [hint, setHint] = useState<DeviceQrHint | null>(null);
  const [camera, setCamera] = useState<'idle' | 'starting' | 'running' | 'unavailable' | 'error'>('idle');
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function stop() {
    session.current += 1;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
  useEffect(() => () => { stop(); }, []);

  function identify(value: string) {
    stop();
    setCamera('idle');
    const result = identifyDeviceQr(value);
    setPayload('');
    setHint(result);
    onHint(result);
  }

  async function start() {
    stop();
    const current = session.current;
    setCamera('starting');
    setHint(null);
    const Detector = (window as unknown as { BarcodeDetector?: QrDetectorConstructor }).BarcodeDetector;
    try {
      if (!Detector || !navigator.mediaDevices?.getUserMedia
        || !(await Detector.getSupportedFormats()).includes('qr_code')) {
        if (current === session.current) setCamera('unavailable');
        return;
      }
      if (current !== session.current) return;
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      if (current !== session.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const element = video.current;
      if (!element) { stop(); return; }
      element.srcObject = media;
      await element.play();
      if (current !== session.current) return;
      setCamera('running');
      const detector = new Detector({ formats: ['qr_code'] });
      const scan = async () => {
        if (current !== session.current) return;
        try {
          const codes = element.readyState >= 2 ? await detector.detect(element) : [];
          if (current !== session.current) return;
          if (codes[0]?.rawValue) { identify(codes[0].rawValue); return; }
          timer.current = setTimeout(() => { void scan(); }, 300);
        } catch {
          if (current === session.current) { stop(); setCamera('error'); }
        }
      };
      void scan();
    } catch {
      if (current === session.current) { stop(); setCamera('error'); }
    }
  }

  return <details className="border-t border-border pt-3" onToggle={event => {
    if (!event.currentTarget.open) { stop(); setCamera('idle'); setPayload(''); setHint(null); }
  }}>
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{t('deviceOnboarding.qr.title')}</summary>
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t('deviceOnboarding.qr.explanation')}</p>
      {hint && <div role="status" aria-live="polite">
        <Alert variant="info"><AlertDescription>{t(`deviceOnboarding.qr.results.${hint}`)}</AlertDescription></Alert>
      </div>}
      <video ref={video} muted playsInline aria-label={t('deviceOnboarding.qr.camera')}
        className={camera === 'running' || camera === 'starting' ? 'w-full max-h-48 rounded-md object-cover' : 'hidden'} />
      {camera === 'running' || camera === 'starting'
        ? <Button variant="outline" onClick={() => { stop(); setCamera('idle'); }}>{t('deviceOnboarding.qr.stop')}</Button>
        : <Button variant="outline" onClick={() => { void start(); }}>{t('deviceOnboarding.qr.scan')}</Button>}
      {(camera === 'unavailable' || camera === 'error') && <p role="status" className="text-xs text-muted-foreground">{t(`deviceOnboarding.qr.${camera}`)}</p>}
      <Field>
        <FieldLabel htmlFor="device-qr-payload">{t('deviceOnboarding.qr.paste')}</FieldLabel>
        <Input id="device-qr-payload" value={payload} maxLength={2048} dir="ltr" autoComplete="off"
          onChange={event => setPayload(event.target.value)} aria-describedby="device-qr-hint" />
        <FieldDescription id="device-qr-hint">{t('deviceOnboarding.qr.privacy')}</FieldDescription>
      </Field>
      <Button variant="outline" disabled={!payload.trim()} onClick={() => identify(payload)}>{t('deviceOnboarding.qr.identify')}</Button>
    </div>
  </details>;
}
