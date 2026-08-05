import React, { useCallback, useState } from 'react';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import { Badge, Button } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  AutoAwesome,
  Group,
  Add,
  Delete,
} from '../../icons';
import type { ForfaitConfig, SurfaceBasePrice, PrestationOption, SurchargeOption } from '../../services/api/pricingConfigApi';
import type { Team } from '../../services/api/teamsApi';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';

// ─── Constants ────────────────────────────────────────────────────────────────

/** All cleaning intervention type keys (system enum — stays hardcoded) */
const ALL_CLEANING_SERVICE_TYPE_KEYS = [
  'CLEANING',
  'EXPRESS_CLEANING',
  'DEEP_CLEANING',
  'WINDOW_CLEANING',
  'FLOOR_CLEANING',
  'KITCHEN_CLEANING',
  'BATHROOM_CLEANING',
] as const;

/** Surtitre d'une section du forfait — recette « overline » de Baitly UI. */
const SECTION_TITLE_CLASS = 'text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-[4.5px]';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ForfaitAccordionSectionProps {
  forfait: ForfaitConfig;
  teams: Team[];
  canEdit: boolean;
  onChange: (updated: ForfaitConfig) => void;
  availablePrestations: PrestationOption[];
  availableSurcharges: SurchargeOption[];
  onAddPrestation: (prestation: PrestationOption) => void;
  onAddSurcharge: (surcharge: SurchargeOption) => void;
  currencySymbol: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ForfaitAccordionSection: React.FC<ForfaitAccordionSectionProps> = React.memo(
  ({ forfait, teams, canEdit, onChange, availablePrestations, availableSurcharges, onAddPrestation, onAddSurcharge, currencySymbol }) => {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    // Un accordeon par forfait peut etre monte plusieurs fois dans la page :
    // les id des champs doivent donc etre derives d un prefixe unique.
    const uid = React.useId();

    // ─── Add prestation dialog ─────────────────────────────────────────
    const [addPrestationOpen, setAddPrestationOpen] = useState(false);
    const [newPrestationKey, setNewPrestationKey] = useState('');
    const [newPrestationLabel, setNewPrestationLabel] = useState('');

    // ─── Add surcharge dialog ──────────────────────────────────────────
    const [addSurchargeOpen, setAddSurchargeOpen] = useState(false);
    const [newSurchargeKey, setNewSurchargeKey] = useState('');
    const [newSurchargeLabel, setNewSurchargeLabel] = useState('');

    // ─── Toggle helpers ───────────────────────────────────────────────

    const toggleServiceType = useCallback((value: string) => {
      if (!canEdit) return;
      const current = forfait.serviceTypes || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...forfait, serviceTypes: next });
    }, [forfait, canEdit, onChange]);

    const togglePrestation = useCallback((key: string, column: 'included' | 'extra') => {
      if (!canEdit) return;
      const included = [...(forfait.includedPrestations || [])];
      const extra = [...(forfait.extraPrestations || [])];

      const idxInc = included.indexOf(key);
      const idxExt = extra.indexOf(key);
      if (idxInc >= 0) included.splice(idxInc, 1);
      if (idxExt >= 0) extra.splice(idxExt, 1);

      if (column === 'included' && idxInc < 0) {
        included.push(key);
      } else if (column === 'extra' && idxExt < 0) {
        extra.push(key);
      }

      onChange({ ...forfait, includedPrestations: included, extraPrestations: extra });
    }, [forfait, canEdit, onChange]);

    const toggleTeam = useCallback((teamId: number) => {
      if (!canEdit) return;
      const current = forfait.eligibleTeamIds || [];
      const next = current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId];
      onChange({ ...forfait, eligibleTeamIds: next });
    }, [forfait, canEdit, onChange]);

    // ─── Surcharge & surface handlers ─────────────────────────────────

    const updateSurcharge = useCallback((key: string, value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      onChange({
        ...forfait,
        surcharges: { ...(forfait.surcharges || {}), [key]: num },
      });
    }, [forfait, onChange]);

    const updateSurfaceBasePrice = useCallback((index: number, field: 'maxSurface' | 'base', value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) && field !== 'maxSurface') return;
      const prices = [...(forfait.surfaceBasePrices || [])];
      if (field === 'maxSurface') {
        prices[index] = { ...prices[index], maxSurface: value === '' ? null : num };
      } else {
        prices[index] = { ...prices[index], base: num };
      }
      onChange({ ...forfait, surfaceBasePrices: prices });
    }, [forfait, onChange]);

    const addSurfaceTier = useCallback(() => {
      const prices = [...(forfait.surfaceBasePrices || [])];
      prices.push({ maxSurface: null, base: 0 });
      onChange({ ...forfait, surfaceBasePrices: prices });
    }, [forfait, onChange]);

    const removeSurfaceTier = useCallback((index: number) => {
      const prices = [...(forfait.surfaceBasePrices || [])];
      prices.splice(index, 1);
      onChange({ ...forfait, surfaceBasePrices: prices });
    }, [forfait, onChange]);

    const updateCoeff = useCallback((field: 'coeffMin' | 'coeffMax', value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return;
      onChange({ ...forfait, [field]: num });
    }, [forfait, onChange]);

    // ─── Add prestation handler ───────────────────────────────────────
    const handleAddPrestation = useCallback(() => {
      if (!newPrestationKey.trim() || !newPrestationLabel.trim()) return;
      onAddPrestation({ key: newPrestationKey.trim(), label: newPrestationLabel.trim() });
      setNewPrestationKey('');
      setNewPrestationLabel('');
      setAddPrestationOpen(false);
    }, [newPrestationKey, newPrestationLabel, onAddPrestation]);

    // ─── Add surcharge handler ────────────────────────────────────────
    const handleAddSurcharge = useCallback(() => {
      if (!newSurchargeKey.trim() || !newSurchargeLabel.trim()) return;
      onAddSurcharge({ key: newSurchargeKey.trim(), label: newSurchargeLabel.trim(), unit: currencySymbol });
      setNewSurchargeKey('');
      setNewSurchargeLabel('');
      setAddSurchargeOpen(false);
    }, [newSurchargeKey, newSurchargeLabel, onAddSurcharge, currencySymbol]);

    const includedPrestationSet = new Set(forfait.includedPrestations || []);
    const extraPrestationSet = new Set(forfait.extraPrestations || []);
    const eligibleTeamIdSet = new Set(forfait.eligibleTeamIds || []);

    return (
      <div className="flex flex-col gap-3.5">
        {/* ─── Coefficients ─────────────────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>{t('tarification.forfaitSection.priceCoefficients')}</p>
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-6">
              <Field>
                <FieldLabel htmlFor={`${uid}-coeff-min`}>{t('tarification.forfaitSection.coeffMin')}</FieldLabel>
                <Input
                  id={`${uid}-coeff-min`}
                  type="number"
                  className="w-full"
                  value={forfait.coeffMin}
                  onChange={(e) => updateCoeff('coeffMin', e.target.value)}
                  disabled={!canEdit}
                  step={0.05}
                  min={0.1}
                  max={5.0}
                />
              </Field>
            </div>
            <div className="col-span-6">
              <Field>
                <FieldLabel htmlFor={`${uid}-coeff-max`}>{t('tarification.forfaitSection.coeffMax')}</FieldLabel>
                <Input
                  id={`${uid}-coeff-max`}
                  type="number"
                  className="w-full"
                  value={forfait.coeffMax}
                  onChange={(e) => updateCoeff('coeffMax', e.target.value)}
                  disabled={!canEdit}
                  step={0.05}
                  min={0.1}
                  max={5.0}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ─── Types de service associés ────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>{t('tarification.forfaitSection.serviceTypes')}</p>
          <div className="flex gap-1 flex-wrap">
            {ALL_CLEANING_SERVICE_TYPE_KEYS.map((stKey) => {
              const isSelected = (forfait.serviceTypes || []).includes(stKey);
              return (
                <StatusChip
                  key={stKey}
                  outlined
                  selected={isSelected}
                  pressed={isSelected}
                  tone="accent"
                  icon={<AutoAwesome size={14} strokeWidth={1.75} />}
                  label={t(`tarification.forfaitSection.cleaningTypes.${stKey}`)}
                  onClick={canEdit ? () => toggleServiceType(stKey) : undefined}
                  className={cn("h-[30px] text-xs", !canEdit && "opacity-60")}
                />
              );
            })}
          </div>
        </div>

        {/* ─── Prestations incluses / en supplément ─────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>{t('tarification.forfaitSection.prestations')}</p>
          <div className="flex gap-4">
            {/* Incluses */}
            <div className="flex-1">
              <p className="text-2xs font-semibold text-success-ink mb-0.5">
                {t('tarification.forfaitSection.includedInPrice')}
              </p>
              <div className="flex gap-0.5 flex-wrap">
                {availablePrestations.map((p) => {
                  const isIncluded = includedPrestationSet.has(p.key);
                  return (
                    <StatusChip
                      key={p.key}
                      outlined
                      selected={isIncluded}
                      pressed={isIncluded}
                      tone="ok"
                      label={t(`tarification.forfaitSection.prestationTypes.${p.key}`, p.label)}
                      onClick={canEdit ? () => togglePrestation(p.key, 'included') : undefined}
                      className={cn("h-[30px] text-xs", !canEdit && "opacity-60")}
                    />
                  );
                })}
              </div>
            </div>
            {/* En supplément */}
            <div className="flex-1">
              <p className="text-2xs font-semibold text-warning-ink mb-0.5">
                {t('tarification.forfaitSection.extraCharge')}
              </p>
              <div className="flex gap-0.5 flex-wrap">
                {availablePrestations.map((p) => {
                  const isExtra = extraPrestationSet.has(p.key);
                  return (
                    <StatusChip
                      key={p.key}
                      outlined
                      selected={isExtra}
                      pressed={isExtra}
                      tone="warn"
                      label={t(`tarification.forfaitSection.prestationTypes.${p.key}`, p.label)}
                      onClick={canEdit ? () => togglePrestation(p.key, 'extra') : undefined}
                      className={cn("h-[30px] text-xs", !canEdit && "opacity-60")}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Add prestation button */}
          {canEdit && (
            <div className="mt-1.5">
              <Button variant="outline" size="sm" onClick={() => setAddPrestationOpen(true)}>
                <Add />
                {t('tarification.addPrestation')}
              </Button>
            </div>
          )}
        </div>

        {/* ─── Équipes éligibles ────────────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>
            {t('tarification.forfaitSection.eligibleTeams')}
            <span className="text-2xs font-normal text-muted-foreground opacity-60 ms-1.5">
              {t('tarification.forfaitSection.eligibleTeamsHint')}
            </span>
          </p>
          <div className="flex gap-1 flex-wrap">
            {teams.length === 0 ? (
              <p className="text-xs text-muted-foreground opacity-60 italic">
                {t('tarification.forfaitSection.noTeamsAvailable')}
              </p>
            ) : (
              teams.map((team) => {
                const isSelected = eligibleTeamIdSet.has(team.id);
                return (
                  <StatusChip
                    key={team.id}
                    outlined
                    selected={isSelected}
                    pressed={isSelected}
                    tone="accent"
                    icon={<Group size={14} strokeWidth={1.75} />}
                    label={`${team.name} (${team.memberCount})`}
                    onClick={canEdit ? () => toggleTeam(team.id) : undefined}
                    className={cn("h-[30px] text-xs", !canEdit && "opacity-60")}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ─── Tarification par surface ─────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>{t('tarification.forfaitSection.surfacePricing')}</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t('tarification.forfaitSection.maxThreshold')}</TableHead>
                  <TableHead className="text-end text-xs">{t('tarification.forfaitSection.basePrice')}</TableHead>
                  {canEdit && <TableHead className="w-[48px] text-center" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(forfait.surfaceBasePrices || []).map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {tier.maxSurface !== null ? (
                        // Pas de FieldLabel : l en-tete de colonne porte deja le libelle,
                        // l aria-label rend le champ nommable pour un lecteur d ecran.
                        <InputGroup className="w-[100px]">
                          <InputGroupInput
                            type="number"
                            aria-label={t('tarification.forfaitSection.maxThreshold')}
                            className="text-end tabular-nums"
                            value={tier.maxSurface}
                            onChange={(e) => updateSurfaceBasePrice(index, 'maxSurface', e.target.value)}
                            disabled={!canEdit}
                            min={1}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>m²</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                      ) : (
                        <Badge variant="secondary" className="h-[24px]">{t('tarification.forfaitSection.unlimited')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <InputGroup className="w-[100px]">
                        <InputGroupInput
                          type="number"
                          aria-label={t('tarification.forfaitSection.basePrice')}
                          className="text-end tabular-nums"
                          value={tier.base}
                          onChange={(e) => updateSurfaceBasePrice(index, 'base', e.target.value)}
                          disabled={!canEdit}
                          min={0}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText><CurrencySymbol code={currency} /></InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('common.delete', 'Supprimer')}
                          onClick={() => removeSurfaceTier(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive-soft"
                        >
                          <Delete size={16} strokeWidth={1.75} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {canEdit && (
            <div className="mt-1.5">
              {/* Meme action « ajouter » que les deux boutons freres de la section :
                  meme primitive, le pointille disant seulement « rangee a creer ». */}
              <Button variant="outline" size="sm" className="border-dashed" onClick={addSurfaceTier}>
                <Add />
                {t('tarification.forfaitSection.addTier')}
              </Button>
            </div>
          )}
        </div>

        {/* ─── Surcharges ───────────────────────────────────────────────── */}
        <div>
          <p className={SECTION_TITLE_CLASS}>{t('tarification.forfaitSection.surcharges')}</p>
          <div className="grid grid-cols-12 gap-1.5">
            {availableSurcharges.map((s) => (
              <div className="col-span-6 min-[600px]:col-span-4" key={s.key}>
                <Field>
                  <FieldLabel htmlFor={`${uid}-surcharge-${s.key}`}>
                    {t(`tarification.forfaitSection.surcharge_${s.key}`, s.label)}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={`${uid}-surcharge-${s.key}`}
                      type="number"
                      className="tabular-nums"
                      value={(forfait.surcharges || {})[s.key] ?? 0}
                      onChange={(e) => updateSurcharge(s.key, e.target.value)}
                      disabled={!canEdit}
                      step={1}
                      min={0}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{s.unit}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            ))}
          </div>
          {/* Add surcharge button */}
          {canEdit && (
            <div className="mt-1.5">
              <Button variant="outline" size="sm" onClick={() => setAddSurchargeOpen(true)}>
                <Add />
                {t('tarification.addSurcharge')}
              </Button>
            </div>
          )}
        </div>

        {/* ─── Add prestation dialog ───────────────────────────────────── */}
        <Dialog open={addPrestationOpen} onOpenChange={(next) => { if (!next) setAddPrestationOpen(false); }}>
          <DialogContent className="max-w-[444px]">
            <DialogHeader>
              <DialogTitle>{t('tarification.addPrestation')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor={`${uid}-new-prestation-key`}>{t('tarification.newItem.key')}</FieldLabel>
              <Input
                id={`${uid}-new-prestation-key`}
                className="w-full"
                value={newPrestationKey}
                onChange={(e) => setNewPrestationKey(e.target.value)}
                autoFocus
              />
              <FieldDescription>{t('tarification.newItem.keyHelp')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uid}-new-prestation-label`}>{t('tarification.newItem.label')}</FieldLabel>
              <Input
                id={`${uid}-new-prestation-label`}
                className="w-full"
                value={newPrestationLabel}
                onChange={(e) => setNewPrestationLabel(e.target.value)}
              />
            </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddPrestationOpen(false)}>{t('tarification.cancel')}</Button>
              <Button onClick={handleAddPrestation} disabled={!newPrestationKey.trim() || !newPrestationLabel.trim()}>
                {t('tarification.add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Add surcharge dialog ────────────────────────────────────── */}
        <Dialog open={addSurchargeOpen} onOpenChange={(next) => { if (!next) setAddSurchargeOpen(false); }}>
          <DialogContent className="max-w-[444px]">
            <DialogHeader>
              <DialogTitle>{t('tarification.addSurcharge')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor={`${uid}-new-surcharge-key`}>{t('tarification.newItem.key')}</FieldLabel>
              <Input
                id={`${uid}-new-surcharge-key`}
                className="w-full"
                value={newSurchargeKey}
                onChange={(e) => setNewSurchargeKey(e.target.value)}
                autoFocus
              />
              <FieldDescription>{t('tarification.newItem.keyHelp')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uid}-new-surcharge-label`}>{t('tarification.newItem.label')}</FieldLabel>
              <Input
                id={`${uid}-new-surcharge-label`}
                className="w-full"
                value={newSurchargeLabel}
                onChange={(e) => setNewSurchargeLabel(e.target.value)}
              />
            </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddSurchargeOpen(false)}>{t('tarification.cancel')}</Button>
              <Button onClick={handleAddSurcharge} disabled={!newSurchargeKey.trim() || !newSurchargeLabel.trim()}>
                {t('tarification.add')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

ForfaitAccordionSection.displayName = 'ForfaitAccordionSection';

export default ForfaitAccordionSection;
