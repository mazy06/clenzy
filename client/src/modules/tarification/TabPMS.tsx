import React from 'react';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  Separator,
} from '../../components/ui';
import { Devices, Computer, People, AutoAwesome } from '../../icons';
import type { PricingConfig } from '../../services/api/pricingConfigApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';

interface TabPMSProps {
  config: PricingConfig;
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

export default function TabPMS({ config, canEdit, onUpdate, currencySymbol }: TabPMSProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();

  return (
    <div className="pt-3">
      {/* ─── Abonnement PMS ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-info"><Devices size={20} strokeWidth={1.75} /></span>
        <h6 className="text-sm font-semibold">
          {t('tarification.pms.title')}
        </h6>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('tarification.pms.subtitle')}
      </p>

      <div className="grid grid-cols-12 gap-[9px]">
        <div className="col-span-6">
          <Field>
            <FieldLabel htmlFor="pms-monthly">{t('tarification.pms.monthly')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pms-monthly"
                type="number"
                className="tabular-nums"
                value={(config.pmsMonthlyPriceCents / 100).toFixed(0)}
                onChange={(e) => {
                  const euros = parseInt(e.target.value, 10);
                  if (!isNaN(euros)) onUpdate({ pmsMonthlyPriceCents: euros * 100 });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} />/mois</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.pms.monthlyHelp')}</FieldDescription>
          </Field>
        </div>
        <div className="col-span-6">
          <Field>
            <FieldLabel htmlFor="pms-sync">{t('tarification.pms.sync')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pms-sync"
                type="number"
                className="tabular-nums"
                value={(config.pmsSyncPriceCents / 100).toFixed(0)}
                onChange={(e) => {
                  const euros = parseInt(e.target.value, 10);
                  if (!isNaN(euros)) onUpdate({ pmsSyncPriceCents: euros * 100 });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} />/mois</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.pms.syncHelp')}</FieldDescription>
          </Field>
        </div>
      </div>

      <Separator className="my-[15px]" />

      {/* ─── Supplément IA par forfait (campagne X5) ─────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-primary"><AutoAwesome size={20} strokeWidth={1.75} /></span>
        <h6 className="text-sm font-semibold">
          {t('tarification.pms.aiTitle')}
        </h6>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('tarification.pms.aiSubtitle')}
      </p>

      <div className="grid grid-cols-12 gap-[9px]">
        <div className="col-span-4">
          <Field>
            <FieldLabel htmlFor="pms-ai-essentiel">{t('tarification.pms.aiEssentiel')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pms-ai-essentiel"
                type="number"
                className="tabular-nums"
                value={(config.aiSurchargeEssentielCents / 100).toFixed(0)}
                onChange={(e) => {
                  const euros = parseInt(e.target.value, 10);
                  if (!isNaN(euros)) onUpdate({ aiSurchargeEssentielCents: euros * 100 });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} />/mois</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.pms.aiEssentielHelp')}</FieldDescription>
          </Field>
        </div>
        <div className="col-span-4">
          <Field>
            <FieldLabel htmlFor="pms-ai-confort">{t('tarification.pms.aiConfort')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pms-ai-confort"
                type="number"
                className="tabular-nums"
                value={(config.aiSurchargeConfortCents / 100).toFixed(0)}
                onChange={(e) => {
                  const euros = parseInt(e.target.value, 10);
                  if (!isNaN(euros)) onUpdate({ aiSurchargeConfortCents: euros * 100 });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} />/mois</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.pms.aiConfortHelp')}</FieldDescription>
          </Field>
        </div>
        <div className="col-span-4">
          <Field>
            <FieldLabel htmlFor="pms-ai-premium">{t('tarification.pms.aiPremium')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pms-ai-premium"
                type="number"
                className="tabular-nums"
                value={(config.aiSurchargePremiumCents / 100).toFixed(0)}
                onChange={(e) => {
                  const euros = parseInt(e.target.value, 10);
                  if (!isNaN(euros)) onUpdate({ aiSurchargePremiumCents: euros * 100 });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} />/mois</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.pms.aiPremiumHelp')}</FieldDescription>
          </Field>
        </div>
      </div>

      <Separator className="my-[15px]" />

      {/* ─── Tarification par utilisateur ────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-success"><People size={20} strokeWidth={1.75} /></span>
        <h6 className="text-sm font-semibold">
          {t('tarification.pms.perSeatTitle')}
        </h6>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('tarification.pms.perSeatSubtitle')}
      </p>

      <div className="grid grid-cols-12 gap-[9px]">
        <div className="col-span-6">
          <Field>
            <FieldLabel htmlFor="pms-per-seat">{t('tarification.pms.perSeat')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="pms-per-seat"
                type="number"
                className="tabular-nums"
                value={(config.pmsPerSeatPriceCents / 100).toFixed(0)}
                onChange={(e) => {
                  const euros = parseInt(e.target.value, 10);
                  if (!isNaN(euros)) onUpdate({ pmsPerSeatPriceCents: euros * 100 });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} />/mois/utilisateur</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.pms.perSeatHelp')}</FieldDescription>
          </Field>
        </div>
        <div className="col-span-6">
          <Field>
            <FieldLabel htmlFor="pms-free-seats">{t('tarification.pms.freeSeats')}</FieldLabel>
            <Input
              id="pms-free-seats"
              type="number"
              className="tabular-nums"
              value={config.pmsFreeSeats}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10);
                if (!isNaN(num) && num >= 0) onUpdate({ pmsFreeSeats: num });
              }}
              disabled={!canEdit}
            />
            <FieldDescription>{t('tarification.pms.freeSeatsHelp')}</FieldDescription>
          </Field>
        </div>
      </div>

      <Separator className="my-[15px]" />

      {/* ─── Surcharges automatisation ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="inline-flex text-warning"><Computer size={20} strokeWidth={1.75} /></span>
        <h6 className="text-sm font-semibold">
          {t('tarification.automation.title')}
        </h6>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('tarification.automation.subtitle')}
      </p>

      <div className="grid grid-cols-12 gap-[9px]">
        <div className="col-span-6">
          <Field>
            <FieldLabel htmlFor="automation-basic">{t('tarification.automation.basic')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="automation-basic"
                type="number"
                className="tabular-nums"
                value={config.automationBasicSurcharge}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num)) onUpdate({ automationBasicSurcharge: num });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.automation.basicHelp')}</FieldDescription>
          </Field>
        </div>
        <div className="col-span-6">
          <Field>
            <FieldLabel htmlFor="automation-full">{t('tarification.automation.full')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="automation-full"
                type="number"
                className="tabular-nums"
                value={config.automationFullSurcharge}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num)) onUpdate({ automationFullSurcharge: num });
                }}
                disabled={!canEdit}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{t('tarification.automation.fullHelp')}</FieldDescription>
          </Field>
        </div>
      </div>
    </div>
  );
}
