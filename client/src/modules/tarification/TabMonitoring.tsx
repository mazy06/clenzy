import React from 'react';
import { Badge } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Field,
  FieldLabel,
  FieldDescription,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../components/ui';
import { Separator, Switch } from '../../components/ui';
import {
  VolumeUp,
  Handshake,
  Memory,
  CheckCircleOutline,
} from '../../icons';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { Money, CurrencySymbol } from '../../components/Money';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TabMonitoringProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

// ─── Feature list helper ────────────────────────────────────────────────────

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircleOutline size={16} strokeWidth={1.75} /></span>
      <p className="cn-text-body2 text-[0.8125rem]">
        {text}
      </p>
    </div>
  );
}

const centsToEuros = (cents: number) => (cents / 100).toFixed(0);
const eurosToCents = (val: string) => {
  const euros = parseInt(val, 10);
  return isNaN(euros) ? 0 : euros * 100;
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TabMonitoring({ config, canEdit, onUpdate, currencySymbol }: TabMonitoringProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  // ─── Baitly total calculation ─────────────────────────────────────────────
  const clenzyTotalCents =
    (config.monitoringClenzyDevicePriceCents || 0) +
    (config.monitoringClenzyInstallationPriceCents || 0) +
    (config.monitoringClenzyConfigPriceCents || 0) +
    (config.monitoringClenzySupportPriceCents || 0);

  return (
    <div className="pt-3">
      {/* ─── Section title ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="inline-flex text-primary"><VolumeUp size={20} strokeWidth={1.75} /></span>
        <h6 className="cn-text-subtitle1 font-semibold">
          {t('tarification.monitoring.title')}
        </h6>
      </div>
      <p className="cn-text-body2 text-muted-foreground mb-3.5">
        {t('tarification.monitoring.subtitle')}
      </p>

      {/* ─── Two offers side by side ───────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-3">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* MINUT — Abonnement mensuel                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <div
            className={cn(
              'h-full p-[15px] rounded-[16px] border-[1.5px] border-solid bg-[var(--card)]',
              'transition-colors duration-200 motion-reduce:transition-none',
              config.monitoringMinutEnabled
                ? 'border-[var(--mui-primary)] opacity-100'
                : 'border-[var(--line)] opacity-75',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Handshake size={22} strokeWidth={1.75} color='var(--accent)' />
              <h6 className="cn-text-subtitle1 font-bold text-[1rem]">
                {t('tarification.monitoring.minut.title')}
              </h6>
              <Badge variant="default" className="text-[0.6875rem] h-[22px]">{t('tarification.monitoring.minut.badge')}</Badge>
            </div>

            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] mb-3 leading-[1.5]">
              {t('tarification.monitoring.minut.description')}
            </p>

            <Separator className="my-[9px]" />

            {/* Pricing model */}
            <span className="cn-text-overline text-[0.6875rem] font-bold text-muted-foreground tracking-[0.08em]">
              {t('tarification.monitoring.minut.pricingModel')}
            </span>

            <div className="mt-1.5 mb-3">
              {config.monitoringMinutMonthlyPriceCents > 0 ? (
                <Field>
                  <FieldLabel htmlFor="monitoring-minut-monthly-price">
                    {t('tarification.monitoring.minut.monthlyPrice')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="monitoring-minut-monthly-price"
                      type="number"
                      className="tabular-nums"
                      value={centsToEuros(config.monitoringMinutMonthlyPriceCents)}
                      onChange={(e) => onUpdate({ monitoringMinutMonthlyPriceCents: eurosToCents(e.target.value) })}
                      disabled={!canEdit}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText><CurrencySymbol code={currency} />/mois</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              ) : (
                <div className="p-[9px] rounded-[12px] bg-[var(--surface-2)] border border-dashed border-[var(--line)] text-center">
                  <h6 className="cn-text-h6 font-bold text-muted-foreground text-[1.1rem]">
                    {t('tarification.monitoring.minut.onQuote')}
                  </h6>
                  <span className="cn-text-caption text-muted-foreground text-[0.6875rem]">
                    {t('tarification.monitoring.minut.onQuoteHint')}
                  </span>
                </div>
              )}
            </div>

            <Separator className="my-[9px]" />

            {/* Features */}
            <div className="mb-3">
              <FeatureItem text={t('tarification.monitoring.minut.feature1')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature2')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature3')} />
              <FeatureItem text={t('tarification.monitoring.minut.feature4')} />
            </div>

            <Separator className="my-[9px]" />

            {/* Enable switch */}
            <Field orientation="horizontal">
              <span className={cn('inline-flex w-9 shrink-0', config.monitoringMinutEnabled ? 'text-[var(--mui-primary)]' : 'text-[var(--faint)]')}><VolumeUp size={20} strokeWidth={1.75} /></span>
              <FieldLabel htmlFor="monitoring-minut-enabled" className="flex-1 text-[0.875rem] font-semibold">
                {t('tarification.monitoring.enable')}
              </FieldLabel>
              <Switch
                id="monitoring-minut-enabled"
                checked={config.monitoringMinutEnabled}
                onCheckedChange={(checked) => onUpdate({ monitoringMinutEnabled: checked })}
                disabled={!canEdit}
              />
            </Field>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* CLENZY HARDWARE — Coût unique (Tuya OEM)                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <div
            className={cn(
              'h-full p-[15px] rounded-[16px] border-[1.5px] border-solid bg-[var(--card)]',
              'transition-colors duration-200 motion-reduce:transition-none',
              config.monitoringClenzyEnabled
                ? 'border-[var(--ok)] opacity-100'
                : 'border-[var(--line)] opacity-75',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Memory size={22} strokeWidth={1.75} color='var(--ok)' />
              <h6 className="cn-text-subtitle1 font-bold text-[1rem]">
                {t('tarification.monitoring.clenzy.title')}
              </h6>
              <Badge variant="success" className="text-[0.6875rem] h-[22px]">{t('tarification.monitoring.clenzy.badge')}</Badge>
            </div>

            <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] mb-3 leading-[1.5]">
              {t('tarification.monitoring.clenzy.description')}
            </p>

            <Separator className="my-[9px]" />

            {/* Pricing model */}
            <span className="cn-text-overline text-[0.6875rem] font-bold text-muted-foreground tracking-[0.08em]">
              {t('tarification.monitoring.clenzy.pricingModel')}
            </span>

            <div className="grid grid-cols-12 gap-[9px] mt-[3px] mb-1.5">
              <div className="col-span-6">
                <Field>
                  <FieldLabel htmlFor="monitoring-device-price">
                    {t('tarification.monitoring.clenzy.devicePrice')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="monitoring-device-price"
                      type="number"
                      className="tabular-nums"
                      value={centsToEuros(config.monitoringClenzyDevicePriceCents)}
                      onChange={(e) => onUpdate({ monitoringClenzyDevicePriceCents: eurosToCents(e.target.value) })}
                      disabled={!canEdit}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{t('tarification.monitoring.clenzy.devicePriceHelp')}</FieldDescription>
                </Field>
              </div>
              <div className="col-span-6">
                <Field>
                  <FieldLabel htmlFor="monitoring-installation-price">
                    {t('tarification.monitoring.clenzy.installationPrice')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="monitoring-installation-price"
                      type="number"
                      className="tabular-nums"
                      value={centsToEuros(config.monitoringClenzyInstallationPriceCents)}
                      onChange={(e) => onUpdate({ monitoringClenzyInstallationPriceCents: eurosToCents(e.target.value) })}
                      disabled={!canEdit}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{t('tarification.monitoring.clenzy.installationPriceHelp')}</FieldDescription>
                </Field>
              </div>
              <div className="col-span-6">
                <Field>
                  <FieldLabel htmlFor="monitoring-config-price">
                    {t('tarification.monitoring.clenzy.configPrice')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="monitoring-config-price"
                      type="number"
                      className="tabular-nums"
                      value={centsToEuros(config.monitoringClenzyConfigPriceCents)}
                      onChange={(e) => onUpdate({ monitoringClenzyConfigPriceCents: eurosToCents(e.target.value) })}
                      disabled={!canEdit}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{t('tarification.monitoring.clenzy.configPriceHelp')}</FieldDescription>
                </Field>
              </div>
              <div className="col-span-6">
                <Field>
                  <FieldLabel htmlFor="monitoring-support-price">
                    {t('tarification.monitoring.clenzy.supportPrice')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="monitoring-support-price"
                      type="number"
                      className="tabular-nums"
                      value={centsToEuros(config.monitoringClenzySupportPriceCents)}
                      onChange={(e) => onUpdate({ monitoringClenzySupportPriceCents: eurosToCents(e.target.value) })}
                      disabled={!canEdit}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{t('tarification.monitoring.clenzy.supportPriceHelp')}</FieldDescription>
                </Field>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-2 rounded-[1.5px] bg-[success.50] border border-[success.200] mb-2">
              <h6 className="cn-text-subtitle2 font-bold text-[0.875rem]">
                {t('tarification.monitoring.clenzy.total')}
              </h6>
              <h6 className="cn-text-h6 font-extrabold text-[var(--ok)] text-[1.25rem]">
                {clenzyTotalCents > 0 ? <Money value={clenzyTotalCents / 100} decimals={0} /> : <>— <CurrencySymbol code={currency} /></>}
              </h6>
            </div>

            <Separator className="my-[9px]" />

            {/* Features */}
            <div className="mb-3">
              <FeatureItem text={t('tarification.monitoring.clenzy.feature1')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature2')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature3')} />
              <FeatureItem text={t('tarification.monitoring.clenzy.feature4')} />
            </div>

            <Separator className="my-[9px]" />

            {/* Enable switch */}
            <Field orientation="horizontal">
              <span className={cn('inline-flex w-9 shrink-0', config.monitoringClenzyEnabled ? 'text-[#4A9B8E]' : 'text-[var(--faint)]')}><Memory size={20} strokeWidth={1.75} /></span>
              <FieldLabel htmlFor="monitoring-clenzy-enabled" className="flex-1 text-[0.875rem] font-semibold">
                {t('tarification.monitoring.enable')}
              </FieldLabel>
              <Switch
                id="monitoring-clenzy-enabled"
                checked={config.monitoringClenzyEnabled}
                onCheckedChange={(checked) => onUpdate({ monitoringClenzyEnabled: checked })}
                disabled={!canEdit}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
