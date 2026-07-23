import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Button, Calendar, Label, Popover, PopoverContent, PopoverTrigger } from '../ui';

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
  isFrench: boolean;
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
  isFrench,
  label,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const locale = isFrench ? fr : enUS;
  const from = parse(startDate);
  const to = parse(endDate);
  const display =
    from && to
      ? `${format(from, 'd MMM yyyy', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`
      : isFrench
        ? 'Choisir les dates'
        : 'Pick dates';

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
          <Calendar
            mode="range"
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
