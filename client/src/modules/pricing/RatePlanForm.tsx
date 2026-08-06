import React, { useState, useEffect } from 'react';
import { Spinner } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from '../../components/ui';
import { Close as CloseIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { CurrencySymbol } from '../../components/Money';
import MiniDateRangePicker from '../../components/MiniDateRangePicker';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Style Constants ────────────────────────────────────────────────────────

/** Densité de la carte : la surface vient de `Card`, le rythme d'ici. */
const PANEL_CLASS = 'gap-0 py-0 p-[9px]';

const PLAN_TYPES = ['BASE', 'SEASONAL', 'PROMOTIONAL', 'LAST_MINUTE'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface RatePlanFormProps {
  propertyId: number;
  editingPlan?: RatePlan | null;
  onSave: (data: CreateRatePlanData) => Promise<unknown>;
  onCancel: () => void;
  loading: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const RatePlanForm: React.FC<RatePlanFormProps> = ({
  propertyId,
  editingPlan,
  onSave,
  onCancel,
  loading,
}) => {
  const { t, isFrench } = useTranslation();

  const { currency: activeCurrency } = useCurrency();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('BASE');
  const [nightlyPrice, setNightlyPrice] = useState<string>('');
  const [priority, setPriority] = useState<string>('1');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Reset form when editingPlan changes
  useEffect(() => {
    if (editingPlan) {
      setName(editingPlan.name);
      setType(editingPlan.type);
      setNightlyPrice(String(editingPlan.nightlyPrice));
      setPriority(String(editingPlan.priority));
      setStartDate(editingPlan.startDate ?? '');
      setEndDate(editingPlan.endDate ?? '');
      setDaysOfWeek(editingPlan.daysOfWeek ?? []);
      setIsActive(editingPlan.isActive);
    } else {
      setName('');
      setType('BASE');
      setNightlyPrice('');
      setPriority('1');
      setStartDate('');
      setEndDate('');
      setDaysOfWeek([]);
      setIsActive(true);
    }
  }, [editingPlan]);

  const dayLabels = isFrench
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSave = async () => {
    const data: CreateRatePlanData = {
      propertyId,
      name,
      type,
      nightlyPrice: parseFloat(nightlyPrice),
      currency: activeCurrency,
      priority: parseInt(priority, 10),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      isActive,
    };
    await onSave(data);
  };

  const isValid = name.trim() !== '' && nightlyPrice !== '' && !isNaN(parseFloat(nightlyPrice));

  return (
    <Card className={PANEL_CLASS}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <p className="text-2xs font-semibold uppercase tracking-wide text-faint">
          {editingPlan ? t('dynamicPricing.ratePlan.edit') : t('dynamicPricing.ratePlan.create')}
        </p>
        {editingPlan && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            aria-label={t('common.cancel')}
          >
            <CloseIcon size={16} strokeWidth={1.75} />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* Name */}
        <Field>
          <FieldLabel htmlFor="rate-plan-name">{t('dynamicPricing.ratePlan.name')}</FieldLabel>
          <Input
            id="rate-plan-name"
            className="w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        {/* Type */}
        <Field>
          <FieldLabel htmlFor="rate-plan-type">{t('common.type')}</FieldLabel>
          <NativeSelect
            id="rate-plan-type"
            className="w-full"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {PLAN_TYPES.map((pt) => (
              <NativeSelectOption key={pt} value={pt}>
                {t(`dynamicPricing.ratePlan.types.${pt}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {/* Price + Currency + Priority row */}
        <div className="flex gap-1.5">
          <Field className="flex-1 min-w-0">
            <FieldLabel htmlFor="rate-plan-nightly-price">
              {t('dynamicPricing.ratePlan.nightlyPrice')}
            </FieldLabel>
            <Input
              id="rate-plan-nightly-price"
              className="w-full"
              type="number"
              value={nightlyPrice}
              onChange={(e) => setNightlyPrice(e.target.value)}
              min={0}
              step={1}
            />
          </Field>
          <Field className="w-[90px] shrink-0">
            <FieldLabel htmlFor="rate-plan-currency">{t('common.currency', 'Devise')}</FieldLabel>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <span className="text-xs font-semibold text-muted-foreground">
                  <CurrencySymbol code={activeCurrency} />
                </span>
              </InputGroupAddon>
              <InputGroupInput id="rate-plan-currency" value={activeCurrency} disabled />
            </InputGroup>
          </Field>
          <Field className="w-[100px] shrink-0">
            <FieldLabel htmlFor="rate-plan-priority">
              {t('dynamicPricing.ratePlan.priority')}
            </FieldLabel>
            <Input
              id="rate-plan-priority"
              className="w-full"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              min={0}
              step={1}
            />
          </Field>
        </div>

        {/* Date range — shared mini calendar */}
        <div>
          <span className="text-2xs text-muted-foreground mb-0.5 block">
            {t('dynamicPricing.ratePlan.dateRange')}
          </span>
          <MiniDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChangeStart={setStartDate}
            onChangeEnd={setEndDate}
            isFrench={isFrench}
          />
        </div>

        {/* Days of week */}
        <div>
          <span className="text-2xs text-muted-foreground mb-0.5 block">
            {t('dynamicPricing.ratePlan.daysOfWeek')}
          </span>
          {/* Bascules : de vrais `button`, donc atteignables au clavier et
              annonces comme pressees — l'ancien `div` ne l'etait pas. */}
          <div className="flex gap-[3px]">
            {(() => {
              const daysOfWeekSet = new Set(daysOfWeek);
              return dayLabels.map((label, idx) => {
              const dayValue = idx + 1;
              const selected = daysOfWeekSet.has(dayValue);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(dayValue)}
                  aria-pressed={selected}
                  className={cn(
                    'flex-1 text-center py-[3px] rounded-md cursor-pointer border border-solid',
                    'transition-[border-color,background-color] duration-150 ease-out-quart motion-reduce:transition-none',
                    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    selected
                      ? 'border-primary bg-primary-soft'
                      : 'border-field-line bg-field hover:border-faint',
                  )}
                >
                  <span className={cn('text-[0.5625rem]', selected ? 'font-semibold text-primary' : 'font-medium text-muted-foreground')}>
                    {label}
                  </span>
                </button>
              );
              });
            })()}
          </div>
        </div>

        {/* Active toggle */}
        <Field orientation="horizontal" className="w-fit">
          <Switch
            id="rate-plan-active"
            size="sm"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <FieldLabel htmlFor="rate-plan-active" className="text-xs font-normal">
            {isActive ? t('dynamicPricing.ratePlan.active') : t('dynamicPricing.ratePlan.inactive')}
          </FieldLabel>
        </Field>

        {/* Actions */}
        <div className="flex gap-1.5 justify-end">
          {editingPlan && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={loading}
              className="text-xs"
            >
              {t('common.cancel')}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || !isValid}
            className="text-xs"
          >
            {loading && <Spinner className="size-3.5" />}
            {editingPlan ? t('common.save') : t('dynamicPricing.ratePlan.create')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default RatePlanForm;
