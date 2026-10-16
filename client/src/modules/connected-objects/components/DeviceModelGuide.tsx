import { Alert, AlertDescription, Button, Field, FieldDescription, FieldLabel, NativeSelect, NativeSelectOption } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DeviceKind } from '../types';
import { onboardingModels } from '../deviceOnboardingCatalog';

interface Props {
  kind: DeviceKind;
  provider: string;
  modelId: string;
  onChange: (modelId: string) => void;
}

export default function DeviceModelGuide({ kind, provider, modelId, onChange }: Props) {
  const { t } = useTranslation();
  const models = onboardingModels(kind, provider);
  const selected = models.find(model => model.id === modelId);
  return <>
    <Field>
      <FieldLabel htmlFor="wizard-model">{t('deviceOnboarding.model')}</FieldLabel>
      <NativeSelect id="wizard-model" value={modelId} onChange={event => onChange(event.target.value)}>
        <NativeSelectOption value="">{t('deviceOnboarding.chooseModel')}</NativeSelectOption>
        {models.map(model => <NativeSelectOption key={model.id} value={model.id}>{model.label}</NativeSelectOption>)}
        <NativeSelectOption value="unknown">{t('deviceOnboarding.unknownModel')}</NativeSelectOption>
      </NativeSelect>
      <FieldDescription>{t('deviceOnboarding.modelHint')}</FieldDescription>
    </Field>
    {selected ? <section aria-label={t('deviceOnboarding.guideTitle')} className="flex flex-col gap-3">
      <p className="text-sm font-medium">{t('deviceOnboarding.remoteWifi')}</p>
      <p className="text-xs text-muted-foreground">{t('deviceOnboarding.cloudPath', { brand: provider === 'MINUT' ? 'Minut' : 'Nuki' })}</p>
      <ol className="list-decimal space-y-2 ps-5 text-sm">
        {[1, 2, 3].map(step => <li key={step}>{t(`deviceOnboarding.guides.${selected.guide}.${step}`)}</li>)}
      </ol>
      <p className="text-xs text-muted-foreground">{t('deviceOnboarding.documentedOnly')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild><a href="/settings?tab=integrations" target="_blank" rel="noopener noreferrer">{t('deviceOnboarding.manageConnection')}</a></Button>
        <Button variant="ghost" size="sm" asChild><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{t('deviceOnboarding.manufacturerGuide')}</a></Button>
      </div>
    </section> : (modelId === 'unknown' || models.length === 0) ? <Alert variant="info"><AlertDescription>{t(provider === 'TUYA' ? 'deviceOnboarding.tuyaUnverified' : 'deviceOnboarding.unverified')}</AlertDescription></Alert> : null}
  </>;
}
