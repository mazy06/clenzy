import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button, Label, Popover, PopoverContent, PopoverTrigger } from '../ui';
import { Calendar } from '../ui/calendar';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale, weekStartsOnForLanguage } from '../../utils/localeDate';

/**
 * Baitly — remaster de components/MiniDateRangePicker.tsx (MUI).
 * Même contrat (dates ISO yyyy-MM-dd en entrée/sortie), mais un seul
 * contrôle : bouton + Calendar en plage dans un Popover (pattern du kit).
 */
export interface DateRangePickerProps {
  /** Date de début ISO (yyyy-MM-dd), '' si vide. */
  startDate: string;
  /** Date de fin ISO (yyyy-MM-dd), '' si vide. */
  endDate: string;
  onChangeStart: (d: string) => void;
  onChangeEnd: (d: string) => void;
  label?: string;
}

function parse(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  label,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // La langue vient d'i18next, plus d'un booleen passe par l'appelant : la
  // liste des factures le cablait en dur a `true`, et son selecteur restait
  // francais quelle que soit la langue de l'interface.
  const locale = dateFnsLocale(i18n.language);
  const from = parse(startDate);
  const to = parse(endDate);
  const display =
    from && to
      ? `${format(from, 'd MMM yyyy', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`
      : t('common.pickDates', 'Choisir les dates');

  return (
    <div className="flex flex-col gap-2">
      {label && <Label className="px-1">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-64 justify-between font-normal">
            {display}
            <CalendarIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          {/* `locale` n'etait pas transmise : react-day-picker retombait sur
              `enUS` — initiales de jours en anglais et semaine ouverte au
              dimanche, dans les trois langues. `weekStartsOn` porte la regle
              produit (lundi partout, dimanche en arabe). */}
          <Calendar
            mode="range"
            locale={locale}
            weekStartsOn={weekStartsOnForLanguage(i18n.language)}
            numberOfMonths={2}
            defaultMonth={from}
            selected={{ from, to } as DateRange}
            captionLayout="dropdown"
            onSelect={(range) => {
              onChangeStart(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
              onChangeEnd(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
              if (range?.from && range?.to) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
