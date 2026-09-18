import { useId } from 'react';
import { Input, Label, Slider } from '../../components/ui';
import ServicePriceComparison, { ServicePriceDifference } from './ServicePriceComparison';
import { useTranslation } from '../../hooks/useTranslation';

/** Ajustement ponctuel du prix de la mission ; ne modifie jamais le tarif publié. */
export default function ServicePriceSlider({ suggested, amount, currency, onChange, onCurrencyChange, disabled }: {
  suggested?: { amount: number; currency: string } | null;
  amount: string; currency: string; onChange: (value: string) => void; disabled?: boolean;
  onCurrencyChange: (value: string) => void;
}) {
  const { t, currentLanguage, isArabic } = useTranslation();
  const id=useId();
  const format=(value:number,unit:string)=>/^[A-Z]{3}$/.test(unit)?new Intl.NumberFormat(currentLanguage,{style:'currency',currency:unit}).format(value):String(value);
  const value=Number(amount);
  const valid=amount!=='' && Number.isFinite(value) && value>=0 && value<=1_000_000;
  // Le champ exact permet de dépasser la plage de confort de la jauge.
  const max=Math.min(1_000_000,Math.max(100,Math.ceil((suggested?.currency===currency?suggested.amount:100)*2),valid?value:0));
  return <div className="space-y-3">
    <ServicePriceComparison proposedLabel={t('requestCommercial.suggestedPrice')}
      proposed={suggested?format(suggested.amount,suggested.currency):t('requestCommercial.noEstimate')}
      providerLabel={<Label htmlFor={id}>{t('requestCommercial.myProposal')}</Label>}
      difference={valid && suggested?.currency===currency ? <ServicePriceDifference amount={value-suggested.amount} currency={currency} /> : undefined}
      provider={<div className="flex items-center justify-end gap-2"><Input id={id} type="number" min="0" max="1000000" step="0.01" value={amount} disabled={disabled}
          onChange={event=>onChange(event.target.value)} className="h-8 text-end tabular-nums" aria-invalid={!valid}/>
          <Input aria-label={t('assignmentFlow.currency')} value={currency} maxLength={3} pattern="[A-Z]{3}" disabled={disabled}
            onChange={event=>onCurrencyChange(event.target.value.toUpperCase())} className="h-8 w-16 shrink-0 text-xs" /></div>} />
    <Slider min={0} max={max} step={1} value={[valid?value:0]} disabled={disabled} dir={isArabic?'rtl':'ltr'}
      onValueChange={values=>onChange(String(values[0]))} thumbLabel={t('requestCommercial.adjustPrice')}
      thumbValueText={format(valid?value:0,currency)} className="h-6 cursor-pointer" />
    <div className="flex justify-between text-xs tabular-nums text-muted-foreground"><span>{format(0,currency)}</span><span>{format(max,currency)}</span></div>
  </div>;
}
