import { useId, useState } from 'react';
import { Alert, AlertDescription, Button, Field, FieldDescription, FieldLabel, Input } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BaitlyProvisioning } from '../../../services/api/baitlyIotApi';

/**
 * Shown once, right after a physical device is registered. The secret lives only in this
 * component's props: never in a query cache, storage or log. A new one can be generated later.
 */
export default function BaitlyProvisioningSecrets({ provisioning }: { provisioning: BaitlyProvisioning }) {
  const { t } = useTranslation();
  const id = useId();
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field); setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  const rows: Array<{ field: string; value: string; secret?: boolean; hint?: string }> = [
    { field: 'deviceId', value: provisioning.externalDeviceId },
    { field: 'secret', value: provisioning.token, secret: true, hint: t('baitlyIot.provisioned.secretHint') },
    { field: 'mqttIdentity', value: provisioning.mqttIdentity, hint: t('baitlyIot.provisioned.mqttHint') },
    ...(provisioning.ingestionUrl ? [{ field: 'ingestionUrl', value: provisioning.ingestionUrl }] : []),
  ];
  return <section className="flex min-w-0 flex-col gap-3" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className="text-sm font-semibold text-balance">{t('baitlyIot.provisioned.title')}</h3>
    <Alert><AlertDescription>{t('baitlyIot.provisioned.hint')}</AlertDescription></Alert>
    {rows.map(row => <Field key={row.field}>
      <FieldLabel htmlFor={`${id}-${row.field}`}>{t(`baitlyIot.provisioned.${row.field}`)}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <Input id={`${id}-${row.field}`} readOnly dir="ltr" autoComplete="off" className="min-w-0 flex-1 font-mono text-xs"
          type={row.secret ? 'password' : 'text'} value={row.value} />
        <Button size="sm" variant="outline" onClick={() => { void copy(row.field, row.value); }}>
          {t(copied === row.field ? 'baitlyIot.provisioned.copied' : 'baitlyIot.provisioned.copy')}
        </Button>
      </div>
      {row.hint && <FieldDescription>{row.hint}</FieldDescription>}
    </Field>)}
    <p role="status" className="sr-only">{copied ? t('baitlyIot.provisioned.copied') : ''}</p>
    {failed && <Alert variant="destructive"><AlertDescription>{t('baitlyIot.provisioned.copyFailed')}</AlertDescription></Alert>}
  </section>;
}
