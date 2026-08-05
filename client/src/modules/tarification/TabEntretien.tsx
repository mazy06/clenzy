import React, { useCallback, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import {
  Euro,
  AutoAwesome,
  Bolt,
  CleaningServices,
  Home,
  People,
  Speed,
  SquareFoot,
} from '../../icons';
import type { PricingConfig, ForfaitConfig, CommissionConfig, PrestationOption, SurchargeOption } from '../../services/api/pricingConfigApi';
import type { Team } from '../../services/api/teamsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import ForfaitAccordionSection from './ForfaitAccordionSection';
import CommissionSection from './CommissionSection';

interface TabEntretienProps {
  config: PricingConfig;
  teams: Team[];
  canEdit: boolean;
  onUpdate: (partial: Partial<PricingConfig>) => void;
  currencySymbol: string;
}

const FORFAIT_ICONS = [
  <span className="inline-flex text-primary"><AutoAwesome key="s" size={20} strokeWidth={1.75} /></span>,
  <span className="inline-flex text-warning"><Bolt key="e" size={20} strokeWidth={1.75} /></span>,
  <span className="inline-flex text-info"><CleaningServices key="d" size={20} strokeWidth={1.75} /></span>,
];

// Peau d'un panneau : le primitif du kit ne pose qu'un filet bas entre items,
// la version MUI etait une surface encadree. On la reconstitue une seule fois.
const PANEL_CLASS = 'rounded-md border border-solid border-border bg-card px-3';

export default function TabEntretien({ config, teams, canEdit, onUpdate, currencySymbol }: TabEntretienProps) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [expandedSection, setExpandedSection] = useState<string | false>('basePrices');

  const updateNumericField = (field: keyof PricingConfig, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    onUpdate({ [field]: num });
  };

  const updateCoeff = (group: 'propertyTypeCoeffs' | 'propertyCountCoeffs' | 'guestCapacityCoeffs' | 'frequencyCoeffs', key: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onUpdate({ [group]: { ...config[group], [key]: num } });
  };

  const updateSurfaceTier = (index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const tiers = [...config.surfaceTiers];
    tiers[index] = { ...tiers[index], coeff: num };
    onUpdate({ surfaceTiers: tiers });
  };

  const updateForfait = useCallback((index: number, updated: ForfaitConfig) => {
    const forfaits = [...(config.forfaitConfigs || [])];
    forfaits[index] = updated;
    onUpdate({ forfaitConfigs: forfaits });
  }, [config.forfaitConfigs, onUpdate]);

  const handleAddPrestation = useCallback((prestation: PrestationOption) => {
    const current = config.availablePrestations || [];
    if (current.some((p) => p.key === prestation.key)) return;
    onUpdate({ availablePrestations: [...current, prestation] });
  }, [config.availablePrestations, onUpdate]);

  const handleAddSurcharge = useCallback((surcharge: SurchargeOption) => {
    const current = config.availableSurcharges || [];
    if (current.some((s) => s.key === surcharge.key)) return;
    onUpdate({ availableSurcharges: [...current, surcharge] });
  }, [config.availableSurcharges, onUpdate]);

  const commission = (config.commissionConfigs || []).find((c) => c.category === 'entretien');

  const handleCommissionChange = useCallback((updated: CommissionConfig) => {
    const configs = [...(config.commissionConfigs || [])];
    const idx = configs.findIndex((c) => c.category === 'entretien');
    if (idx >= 0) {
      configs[idx] = updated;
    } else {
      configs.push(updated);
    }
    onUpdate({ commissionConfigs: configs });
  }, [config.commissionConfigs, onUpdate]);

  return (
    <div className="flex flex-col gap-1.5 pt-1.5">
      {/* Les panneaux MUI etaient des accordeons independants rendus exclusifs
          par `expandedSection` : un seul Accordion `type="single"` porte
          desormais cette exclusivite nativement. */}
      <Accordion
        type="single"
        collapsible
        value={expandedSection === false ? '' : expandedSection}
        onValueChange={(next) => setExpandedSection(next === '' ? false : next)}
        className="flex flex-col gap-1.5"
      >
        {/* ─── Prix de base ───────────────────────────────────────────── */}
        <AccordionItem value="basePrices" className={PANEL_CLASS}>
          <AccordionTrigger>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-primary"><Euro size={20} strokeWidth={1.75} /></span>
              <div className="text-start">
                <h6 className="text-sm font-semibold">{t('tarification.basePrices.title')}</h6>
                <p className="text-xs text-muted-foreground">{t('tarification.basePrices.subtitle')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-6">
              <Field>
                <FieldLabel htmlFor="base-price-essentiel">{t('tarification.basePrices.essentiel')}</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="base-price-essentiel" type="number" className="tabular-nums" value={config.basePriceEssentiel} onChange={(e) => updateNumericField('basePriceEssentiel', e.target.value)} disabled={!canEdit} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            <div className="col-span-6">
              <Field>
                <FieldLabel htmlFor="base-price-confort">{t('tarification.basePrices.confort')}</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="base-price-confort" type="number" className="tabular-nums" value={config.basePriceConfort} onChange={(e) => updateNumericField('basePriceConfort', e.target.value)} disabled={!canEdit} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            <div className="col-span-6">
              <Field>
                <FieldLabel htmlFor="base-price-premium">{t('tarification.basePrices.premium')}</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="base-price-premium" type="number" className="tabular-nums" value={config.basePricePremium} onChange={(e) => updateNumericField('basePricePremium', e.target.value)} disabled={!canEdit} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            <div className="col-span-6">
              <Field>
                <FieldLabel htmlFor="base-price-min">{t('tarification.basePrices.minPrice')}</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="base-price-min" type="number" className="tabular-nums" value={config.minPrice} onChange={(e) => updateNumericField('minPrice', e.target.value)} disabled={!canEdit} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>{t('tarification.basePrices.minPriceHelp')}</FieldDescription>
              </Field>
            </div>
          </div>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Forfaits nettoyage ─────────────────────────────────────── */}
        {(config.forfaitConfigs || []).map((forfait, index) => (
          <AccordionItem key={forfait.key} value={`forfait-${forfait.key}`} className={PANEL_CLASS}>
            <AccordionTrigger>
              <div className="flex items-center gap-1.5">
                {FORFAIT_ICONS[index] || FORFAIT_ICONS[0]}
                <div className="text-start">
                  <h6 className="text-sm font-semibold">
                    {t(`tarification.forfaits.${forfait.key}.title`, `Forfait ${forfait.label}`)}
                  </h6>
                  <p className="text-xs text-muted-foreground">
                    {t(`tarification.forfaits.${forfait.key}.subtitle`, `Configuration du forfait ${forfait.label.toLowerCase()}`)}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ForfaitAccordionSection
                forfait={forfait}
                teams={teams}
                canEdit={canEdit}
                onChange={(updated) => updateForfait(index, updated)}
                availablePrestations={config.availablePrestations || []}
                availableSurcharges={config.availableSurcharges || []}
                onAddPrestation={handleAddPrestation}
                onAddSurcharge={handleAddSurcharge}
                currencySymbol={currencySymbol}
              />
            </AccordionContent>
          </AccordionItem>
        ))}

        {/* ─── Coefficients type de logement ──────────────────────────── */}
        <AccordionItem value="propertyType" className={PANEL_CLASS}>
          <AccordionTrigger>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-info"><Home size={20} strokeWidth={1.75} /></span>
              <div className="text-start">
                <h6 className="text-sm font-semibold">{t('tarification.propertyType.title')}</h6>
                <p className="text-xs text-muted-foreground">{t('tarification.propertyType.subtitle')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          {/* Le primitif Table pose deja son propre conteneur overflow-x-auto :
              un TableContainer supplementaire n'ajouterait qu'un div en double. */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tarification.tableHeaders.type')}</TableHead>
                <TableHead className="text-end">{t('tarification.tableHeaders.coefficient')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(config.propertyTypeCoeffs).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{t(`tarification.propertyType.${key}`) || key}</TableCell>
                  <TableCell className="text-end w-[120px]">
                    {/* Champ sans libelle visible : la premiere colonne porte le
                        libelle, l'aria-label le rend au lecteur d'ecran. */}
                    <Input id={`coeff-property-type-${key}`} aria-label={t(`tarification.propertyType.${key}`) || key} type="number" step={0.05} min={0.1} max={5.0} className="w-[100px] text-end tabular-nums" value={value} onChange={(e) => updateCoeff('propertyTypeCoeffs', key, e.target.value)} disabled={!canEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Coefficients nombre de logements ───────────────────────── */}
        <AccordionItem value="propertyCount" className={PANEL_CLASS}>
          <AccordionTrigger>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-success"><Home size={20} strokeWidth={1.75} /></span>
              <div className="text-start">
                <h6 className="text-sm font-semibold">{t('tarification.propertyCount.title')}</h6>
                <p className="text-xs text-muted-foreground">{t('tarification.propertyCount.subtitle')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tarification.tableHeaders.count')}</TableHead>
                <TableHead className="text-end">{t('tarification.tableHeaders.coefficient')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(config.propertyCountCoeffs).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{t(`tarification.propertyCount.${key}`) || key}</TableCell>
                  <TableCell className="text-end w-[120px]">
                    <Input id={`coeff-property-count-${key}`} aria-label={t(`tarification.propertyCount.${key}`) || key} type="number" step={0.05} min={0.1} max={5.0} className="w-[100px] text-end tabular-nums" value={value} onChange={(e) => updateCoeff('propertyCountCoeffs', key, e.target.value)} disabled={!canEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Coefficients capacité voyageurs ─────────────────────────── */}
        <AccordionItem value="guestCapacity" className={PANEL_CLASS}>
          <AccordionTrigger>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-primary"><People size={20} strokeWidth={1.75} /></span>
              <div className="text-start">
                <h6 className="text-sm font-semibold">{t('tarification.guestCapacity.title')}</h6>
                <p className="text-xs text-muted-foreground">{t('tarification.guestCapacity.subtitle')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tarification.tableHeaders.capacity')}</TableHead>
                <TableHead className="text-end">{t('tarification.tableHeaders.coefficient')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(config.guestCapacityCoeffs).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{t(`tarification.guestCapacity.${key}`) || key}</TableCell>
                  <TableCell className="text-end w-[120px]">
                    <Input id={`coeff-guest-capacity-${key}`} aria-label={t(`tarification.guestCapacity.${key}`) || key} type="number" step={0.05} min={0.1} max={5.0} className="w-[100px] text-end tabular-nums" value={value} onChange={(e) => updateCoeff('guestCapacityCoeffs', key, e.target.value)} disabled={!canEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Coefficients fréquence ──────────────────────────────────── */}
        <AccordionItem value="frequency" className={PANEL_CLASS}>
          <AccordionTrigger>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-warning"><Speed size={20} strokeWidth={1.75} /></span>
              <div className="text-start">
                <h6 className="text-sm font-semibold">{t('tarification.frequency.title')}</h6>
                <p className="text-xs text-muted-foreground">{t('tarification.frequency.subtitle')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tarification.tableHeaders.frequency')}</TableHead>
                <TableHead className="text-end">{t('tarification.tableHeaders.coefficient')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(config.frequencyCoeffs).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell>{t(`tarification.frequency.${key}`) || key}</TableCell>
                  <TableCell className="text-end w-[120px]">
                    <Input id={`coeff-frequency-${key}`} aria-label={t(`tarification.frequency.${key}`) || key} type="number" step={0.05} min={0.1} max={5.0} className="w-[100px] text-end tabular-nums" value={value} onChange={(e) => updateCoeff('frequencyCoeffs', key, e.target.value)} disabled={!canEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </AccordionContent>
        </AccordionItem>

        {/* ─── Paliers surface ─────────────────────────────────────────── */}
        <AccordionItem value="surfaceTiers" className={PANEL_CLASS}>
          <AccordionTrigger>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex text-destructive"><SquareFoot size={20} strokeWidth={1.75} /></span>
              <div className="text-start">
                <h6 className="text-sm font-semibold">{t('tarification.surface.title')}</h6>
                <p className="text-xs text-muted-foreground">{t('tarification.surface.subtitle')}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tarification.tableHeaders.tier')}</TableHead>
                <TableHead className="text-center">{t('tarification.tableHeaders.maxThreshold')}</TableHead>
                <TableHead className="text-end">{t('tarification.tableHeaders.coefficient')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.surfaceTiers.map((tier, index) => (
                <TableRow key={tier.label}>
                  <TableCell>
                    <StatusChip label={tier.label} tone={index === config.surfaceTiers.length - 1 ? 'err' : 'neutral'} />
                  </TableCell>
                  <TableCell className="text-center">{tier.maxSurface !== null ? `${tier.maxSurface} m²` : '—'}</TableCell>
                  <TableCell className="text-end w-[120px]">
                    {/* Pas d'id ici : le libelle du palier ("0-50 m²") ferait un
                        id invalide, et aucun FieldLabel ne le vise. */}
                    <Input aria-label={tier.label} type="number" step={0.05} min={0.1} max={5.0} className="w-[100px] text-end tabular-nums" value={tier.coeff} onChange={(e) => updateSurfaceTier(index, e.target.value)} disabled={!canEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ─── Commission entretien ────────────────────────────────────── */}
      {commission && (
        <div className="px-1.5">
          <CommissionSection
            commission={commission}
            canEdit={canEdit}
            onChange={handleCommissionChange}
          />
        </div>
      )}
    </div>
  );
}
