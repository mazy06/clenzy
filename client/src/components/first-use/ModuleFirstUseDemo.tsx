import { useState } from 'react';
import { CalendarDays, Check, CheckCheck, FileText, Mail, Send, Wrench } from 'lucide-react';
import { Button } from '../ui';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { DemoKind } from './catalog';

const ROWS = [0, 1, 2] as const;

/** Exemples isolés : aucun client API, aucune écriture de données métier. */
export default function ModuleFirstUseDemo({ kind, prefix, scene, onSelect }: {
  kind: DemoKind;
  prefix: string;
  scene: number;
  onSelect: (scene: number) => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const [simulatedScene, setSimulatedScene] = useState<number | null>(null);
  const simulated = kind === 'messages' ? simulatedScene === scene : simulatedScene !== null;
  const [comparison, setComparison] = useState(false);
  const number = (value: number) => value.toLocaleString(currentLanguage);
  const money = (value: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  const label = (row: number) => t(`${prefix}.labels.${row}`);
  const isReportDocument = kind === 'document' && (prefix.endsWith('.reports') || prefix.endsWith('.custom'));
  const documentValues = prefix.endsWith('.billing.reports')
    ? [t('moduleFirstUse.demo.period'), money(48), 'CSV']
    : [t('moduleFirstUse.demo.owner'), t('moduleFirstUse.demo.sectionReady'), 'PDF'];
  const simulate = () => { setSimulatedScene(simulated ? null : scene); onSelect(kind === 'messages' ? scene : 2); };
  const names = [t('moduleFirstUse.demo.property'), t('moduleFirstUse.demo.secondProperty'), t('moduleFirstUse.demo.thirdProperty')];

  const selectRows = <div className="mu-demo-list">
    {ROWS.map((row) => <button key={row} type="button" className="mu-demo-row" aria-pressed={scene === row} onClick={() => onSelect(row)}>
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>{kind === 'reservation' ? <CalendarDays className="size-4" /> : <Wrench className="size-4" />}</span>
      <span className="min-w-0 flex-1"><span className="block font-medium">{names[row]}</span><span className="mt-1 block text-xs text-muted-foreground">{label(row)}</span></span>
      <span className="text-xs tabular-nums text-muted-foreground">{row === 0 ? '10:00' : row === 1 ? '14:00' : '16:00'}</span>
    </button>)}
  </div>;

  return <div className="mu-demo-body rounded-xl border border-border bg-card p-3 sm:p-4" data-kind={kind}>
    <div className="mb-4 flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
      {kind === 'messages' ? <Mail className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
      <span className="min-w-0 flex-1 font-medium text-foreground">{t(`${prefix}.steps.${scene}.title`)}</span>
      <span className="shrink-0 tabular-nums">{number(scene + 1)} / {number(3)}</span>
    </div>

    {(kind === 'reservation' || kind === 'tasks') && <>
      {selectRows}
      <div key={scene} className="mu-reveal mt-4 rounded-lg bg-muted p-3 text-xs">
        <div className="flex items-center justify-between gap-2"><strong className="font-medium">{names[scene]}</strong><span className="mu-demo-status">{t(`moduleFirstUse.demo.${simulated ? 'done' : 'toPrepare'}`)}</span></div>
        <p className="mb-0 mt-2 leading-relaxed text-muted-foreground">{t(`moduleFirstUse.demo.${kind === 'reservation' ? 'stay' : prefix.endsWith('.issues') ? 'issue' : 'task'}`)}</p>
      </div>
    </>}

    {kind === 'calendar' && <>
      <div className="grid grid-cols-3 gap-2">
        {ROWS.map((day) => <button key={day} type="button" className="mu-calendar-day" aria-pressed={scene === day} onClick={() => onSelect(day)}>
          <span className="block pb-4 text-xs text-muted-foreground">{t('moduleFirstUse.demo.day', { count: day + 1 })}</span>
          <span className={cn('mu-calendar-task', scene === day && 'mu-calendar-task-active')}><Wrench className="mb-2 size-4" aria-hidden /><span className="block tabular-nums">{day === 0 ? '10:00' : day === 1 ? '14:00' : '16:00'}</span><span className="mt-1 block">{label(day)}</span></span>
        </button>)}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t('moduleFirstUse.demo.task')}</p>
    </>}

    {kind === 'messages' && <>
      <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={t('moduleFirstUse.demo.channels')}>
        {ROWS.map((row) => <button key={row} className="mu-choice" type="button" aria-pressed={scene === row} onClick={() => { setSimulatedScene(null); onSelect(row); }}>{label(row)}</button>)}
      </div>
      {scene === 2 ? <div className="mu-reveal rounded-lg bg-muted p-4 text-sm">
        <span className="text-xs text-muted-foreground">{t('moduleFirstUse.demo.formType')}</span>
        <h4 className="mb-2 mt-3 font-medium">{t('moduleFirstUse.demo.formTitle')}</h4>
        <p className="m-0 leading-relaxed text-muted-foreground">{t('moduleFirstUse.demo.formBody')}</p>
        {simulated && <p className="mb-0 mt-4 font-medium">{t('moduleFirstUse.demo.formDone')}</p>}
      </div> : <div key={scene} className="mu-reveal flex flex-col gap-3 text-sm">
        <p className="m-0 max-w-[90%] self-start rounded-lg bg-muted p-3">{t(`moduleFirstUse.demo.${scene === 1 ? 'teamIn' : 'messageIn'}`)}</p>
        <p className="m-0 max-w-[90%] self-end rounded-lg bg-primary-soft p-3">{t(`moduleFirstUse.demo.${scene === 1 ? 'teamOut' : 'messageOut'}`)}<CheckCheck className="ms-auto mt-2 size-4 text-muted-foreground" aria-hidden /></p>
        {simulated && <p className="mu-reveal m-0 max-w-[90%] self-end rounded-lg bg-primary-soft p-3">{t(`moduleFirstUse.demo.${scene === 1 ? 'teamSent' : 'messageSent'}`)}</p>}
      </div>}
    </>}

    {(kind === 'quote' || kind === 'contract' || kind === 'document') && <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><span className="text-xs font-medium tracking-wide text-muted-foreground">BAITLY</span><p className="mb-0 mt-1 text-sm font-medium">{names[0]}</p></div>
        <span className="mu-demo-status">{t(`moduleFirstUse.demo.${simulated ? 'done' : 'draft'}`)}</span>
      </div>
      <dl className="m-0 text-sm">
        {ROWS.map((row) => <div key={row} className="mu-document-line" data-active={scene === row}>
          <dt className="min-w-0">{label(row)}</dt>
          <dd className="m-0 shrink-0 font-medium tabular-nums">{kind === 'contract' ? [t('moduleFirstUse.demo.owner'), '20 %', t('moduleFirstUse.demo.signature')][row] : isReportDocument ? documentValues[row] : [money(240), money(48), money(288)][row]}</dd>
        </div>)}
      </dl>
      {kind === 'contract' && <div className="mt-5 border-b border-border pb-2 text-sm italic text-muted-foreground">{simulated ? t('moduleFirstUse.demo.signed') : t('moduleFirstUse.demo.awaitingSignature')}</div>}
      {kind !== 'contract' && !isReportDocument && <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm"><span>{t('moduleFirstUse.demo.total')}</span><strong className="tabular-nums">{money(288)}</strong></div>}
      {isReportDocument && <div className="mt-5 space-y-2" aria-hidden>{[100, 80, 95, 60].map((width) => <div key={width} className="h-1.5 rounded bg-muted" style={{ inlineSize: `${width}%` }} />)}</div>}
    </>}

    {kind === 'ledger' && <>
      <div className="mu-demo-list">
        {ROWS.map((row) => <button key={row} type="button" className="mu-demo-row" aria-pressed={scene === row} onClick={() => onSelect(row)}>
          <span className="min-w-0 flex-1"><span className="block font-medium">{label(row)}</span><span className="mt-1 block text-xs text-muted-foreground">{names[row]}</span></span>
          <span className="shrink-0 font-medium tabular-nums">{money([480, 360, 240][row])}</span>
        </button>)}
      </div>
      <div key={scene} className="mu-reveal mt-5 flex items-center gap-2 rounded-lg bg-muted p-3 text-xs"><Check className="size-4 shrink-0" aria-hidden />{t(`moduleFirstUse.demo.${simulated ? 'reconciled' : 'ledgerHint'}`)}</div>
    </>}

    {(kind === 'chart' || kind === 'occupancy') && <>
      <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={t('moduleFirstUse.demo.indicators')}>
        {ROWS.map((row) => <button key={row} type="button" className="mu-choice" aria-pressed={scene === row} onClick={() => onSelect(row)}>{label(row)}</button>)}
      </div>
      {kind === 'occupancy' ? <>
        <div className="grid grid-cols-7 gap-1" aria-label={t('moduleFirstUse.demo.occupied', { count: comparison ? 21 : 15 })}>
          {Array.from({ length: 28 }, (_, day) => <span key={day} className={cn('flex aspect-square items-center justify-center rounded text-xs tabular-nums', day < (comparison ? 21 : 15) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{number(day + 1)}</span>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('moduleFirstUse.demo.occupied', { count: comparison ? 21 : 15 })}</p>
      </> : <div className="mu-chart" role="img" aria-label={t('moduleFirstUse.demo.chartDescription')}>
        {[36, 52, 46, 68, 60, 80].map((value, index) => <div key={index} className="mu-chart-column">
          <span className="mb-2 text-xs tabular-nums text-muted-foreground">{number(value + (comparison ? 8 : 0) + scene * 3)}</span>
          <div className="mu-chart-track"><span className="mu-chart-bar" style={{ transform: `scaleY(${(value + (comparison ? 8 : 0) + scene * 3) / 100})` }} /></div>
          <span className="mt-2 text-xs tabular-nums text-muted-foreground">{number(index + 1)}</span>
        </div>)}
      </div>}
      {kind === 'chart' && <p className="mb-0 mt-2 text-xs text-muted-foreground">{t('moduleFirstUse.demo.unit')}</p>}
      <Button className="mt-4 w-full whitespace-normal" variant="outline" onClick={() => { setComparison((value) => !value); onSelect(1); }} aria-pressed={comparison}>{t(`moduleFirstUse.demo.${comparison ? 'referencePeriod' : 'comparePeriod'}`)}</Button>
    </>}

    {kind !== 'chart' && kind !== 'occupancy' && <Button variant="outline" className="mt-5 w-full whitespace-normal" onClick={simulate}>
      {simulated ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
      {t(`moduleFirstUse.demo.${simulated ? 'reset' : kind === 'messages' && scene !== 2 ? 'send' : kind === 'contract' ? 'sign' : 'advance'}`)}
    </Button>}
    <p className="mb-0 mt-3 min-h-8 text-xs leading-relaxed text-muted-foreground" role="status">{simulated ? t('moduleFirstUse.demo.simulated') : t('moduleFirstUse.demo.interact')}</p>
  </div>;
}
