import { CircleCheck, Clock, CircleAlert, Info, CircleMinus } from '../../icons/glyphs';
import type { StatusTone } from '../../components/StatusChip';

/** Un état bancaire lisible par son icône et son libellé, sans pastille décorative. */
export default function ReservationFinancialState({ label, tone }: { label: string; tone: StatusTone }) {
  const Icon = tone === 'ok' ? CircleCheck : tone === 'warn' ? Clock : tone === 'err' ? CircleAlert : tone === 'info' ? Info : CircleMinus;
  return <p className="rsv-financial-state" data-tone={tone}><Icon aria-hidden /><span>{label}</span></p>;
}
