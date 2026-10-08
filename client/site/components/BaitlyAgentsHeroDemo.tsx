import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  Clock3Icon,
  EyeOffIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SendIcon,
  StarIcon,
  XIcon,
} from '../../src/icons/glyphs';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../src/components/ui/dialog';
import AgentIcon from './SiteAgentIcon';
import { AGENT_META } from '../../src/modules/supervision/constants';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import { SITE_ACTION_ARTWORK } from '../data/actionArtwork';
import consumables from '../assets/illustrations/actions/consumables.webp';
import { SITE_PHOTOS } from '../data/baitlyPhotography';
import {
  AGENTS_PAGE_MESSAGES,
  type AgentsPageMessages,
} from '../lib/messages/baitlyAgentsPage';
import type { SiteLanguage } from '../lib/siteLanguage';
import { useSiteCurrency } from '../lib/siteCurrency';
import SiteMoney from './SiteMoney';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';

export type AgentsDemoScenario = 'rev' | 'ops' | 'rep';
type DemoEdits = { percent: number; quantity: number; reply: string };
type DemoDecision = { status: 'approved' | 'ignored'; edits?: DemoEdits };
const SCENARIOS: AgentsDemoScenario[] = ['rev', 'ops', 'rep'];
const PERIODS = [
  { from: '2026-11-05', to: '2026-11-06', nights: 2, percent: 15 },
  { from: '2026-11-12', to: '2026-11-14', nights: 3, percent: 15 },
  { from: '2026-11-24', to: '2026-11-25', nights: 2, percent: 12 },
];
const FLOOR = 680;
export const agentsDemoRate = (percent: number) =>
  Math.max(FLOOR, Math.round(800 * (1 - percent / 100)));
const copyFor = (m: AgentsPageMessages, scenario: AgentsDemoScenario) =>
  scenario === 'rev' ? m.revenue : scenario === 'ops' ? m.stock : m.review;

function Illustration({ scenario }: { scenario: AgentsDemoScenario }) {
  return scenario === 'ops' ? (
    <span
      className="bap-stock-image"
      aria-hidden="true"
      style={{ backgroundImage: `url(${consumables})` }}
    />
  ) : (
    <span className="baitly-action-illustration" aria-hidden="true">
      <img
        src={
          scenario === 'rev'
            ? SITE_ACTION_ARTWORK.pricingOptimization
            : SITE_ACTION_ARTWORK.reviews
        }
        width={72}
        height={72}
        alt=""
      />
    </span>
  );
}

function RevenueFacts({
  m,
  language,
  percent,
}: {
  m: AgentsPageMessages;
  language: SiteLanguage;
  percent?: number;
}) {
  const date = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return (
    <div className="baitly-revenue-preview">
      <div className="baitly-revenue-context">
        <div className="baitly-revenue-context-labels">
          <span>
            {m.revenue.occupancy} <strong>40 %</strong>
          </span>
          <span>{m.revenue.threshold}</span>
        </div>
        <div
          className="baitly-revenue-occupancy"
          role="meter"
          aria-label={m.revenue.occupancy}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={40}
        >
          <span
            className="baitly-revenue-occupancy-fill"
            style={{ width: '40%' }}
          />
          <span
            className="baitly-revenue-threshold"
            style={{ insetInlineStart: '55%' }}
          />
        </div>
        <p className="baitly-revenue-horizon">{m.revenue.horizon}</p>
      </div>
      <div className="baitly-revenue-summary">
        <span>{m.revenue.periods}</span>
        <span>{m.revenue.nights}</span>
      </div>
      <ol className="baitly-revenue-periods" aria-label={m.revenue.nightDates}>
        {PERIODS.map((period) => (
          <li className="baitly-revenue-period" key={period.from}>
            <div className="baitly-revenue-period-copy">
              <div className="baitly-revenue-dates">
                <time dateTime={period.from}>
                  {date.format(new Date(period.from))}
                </time>
                <span aria-hidden="true">→</span>
                <time dateTime={period.to}>
                  {date.format(new Date(period.to))}
                </time>
              </div>
            </div>
            <span className="baitly-revenue-track" aria-hidden="true">
              <span
                className="baitly-revenue-range"
                style={{
                  insetInlineStart: `${((Number(period.from.slice(-2)) - 1) / 30) * 100}%`,
                  width: `${(period.nights / 30) * 100}%`,
                }}
              />
            </span>
            <span className="baitly-revenue-change">
              <bdi dir="ltr">
                −
                {percent === undefined
                  ? period.percent
                  : Math.round((1 - agentsDemoRate(percent) / 800) * 100)}{' '}
                %
              </bdi>
            </span>
          </li>
        ))}
      </ol>
      <div className="bap-floor">
        <span>{m.revenue.floor}</span>
        <strong>
          <SiteMoney value={FLOOR} from="MAD" />
        </strong>
      </div>
    </div>
  );
}

function StockFacts({
  m,
  quantity = 4,
}: {
  m: AgentsPageMessages;
  quantity?: number;
}) {
  return (
    <div className="baitly-action-description">
      <div className="baitly-description-stock">
        <Illustration scenario="ops" />
        <div>
          <strong>{m.stock.remaining}</strong>
          <span>{m.stock.threshold}</span>
        </div>
        <span className="baitly-description-status">{m.stock.status}</span>
      </div>
      <dl className="baitly-description-facts">
        <div>
          <dt>{m.stock.quantity}</dt>
          <dd>
            {quantity} {m.stock.boxes}
          </dd>
        </div>
        <div>
          <dt>{m.stock.supplier}</dt>
          <dd>{m.stock.supplierName}</dd>
        </div>
      </dl>
      <p className="baitly-description-note">{m.stock.note}</p>
    </div>
  );
}

function ReviewFacts({ m, reply }: { m: AgentsPageMessages; reply?: string }) {
  return (
    <div className="baitly-action-description">
      <div className="baitly-description-review-meta">
        <span className="baitly-description-rating">
          <StarIcon size={15} aria-hidden="true" />
          <strong>5/5</strong>
        </span>
        <span>{m.review.meta}</span>
      </div>
      <blockquote className="baitly-description-quote">
        {m.review.quote}
      </blockquote>
      {!reply && <p>{m.review.note}</p>}
      {reply && (
        <div className="bap-confirmed-detail">
          <strong>{m.review.response}</strong>
          <p>{reply}</p>
        </div>
      )}
    </div>
  );
}

function ActionEditor({
  scenario,
  m,
  language,
  onConfirm,
  focusResult,
}: {
  scenario: AgentsDemoScenario;
  m: AgentsPageMessages;
  language: SiteLanguage;
  onConfirm: (edits: DemoEdits) => void;
  focusResult: () => void;
}) {
  const [percent, setPercent] = useState(15);
  const [quantity, setQuantity] = useState('4');
  const [reply, setReply] = useState('');
  const confirmed = useRef(false);
  const id = useId();
  const copy = copyFor(m, scenario);
  const valid =
    scenario === 'ops'
      ? /^\d+$/.test(quantity) &&
        Number(quantity) >= 1 &&
        Number(quantity) <= 999
      : scenario !== 'rep' || reply.trim().length > 0;
  return (
    <DialogContent
      className="bap-ui bap-dialog baitly-supervision-surface"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      showCloseButton={false}
      onCloseAutoFocus={(event) => {
        if (confirmed.current) {
          event.preventDefault();
          focusResult();
        }
      }}
    >
      <header className="bap-dialog-header">
        <span className="baitly-hitl-agent bap-agent-name">
          <AgentIcon token={AGENT_META[scenario].icon} size={16} />
          {copy.name}
        </span>
        <DialogClose className="bap-icon-button" aria-label={m.close}>
          <XIcon size={18} />
        </DialogClose>
        <div className="baitly-action-illustrated-heading">
          <Illustration scenario={scenario} />
          <div>
            <DialogTitle>{copy.action}</DialogTitle>
            <DialogDescription>{copy.title}</DialogDescription>
          </div>
        </div>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            confirmed.current = true;
            onConfirm({
              percent,
              quantity: Number(quantity),
              reply: reply.trim(),
            });
          }
        }}
      >
        <div className="bap-dialog-body">
          <span className="bap-simulation">{m.simulation}</span>
          {scenario === 'rev' ? (
            <>
              <label className="bap-field" htmlFor={id}>
                {m.revenue.adjustment}
                <strong>
                  <bdi dir="ltr">−{percent} %</bdi>
                </strong>
              </label>
              <input
                id={id}
                type="range"
                min={5}
                max={25}
                step={1}
                value={percent}
                onChange={(event) => setPercent(Number(event.target.value))}
              />
              <dl className="bap-rate-comparison">
                <div>
                  <dt>{m.revenue.before}</dt>
                  <dd>
                    <SiteMoney value={800} from="MAD" />
                  </dd>
                </div>
                <div>
                  <dt>{m.revenue.after}</dt>
                  <dd>
                    <SiteMoney value={agentsDemoRate(percent)} from="MAD" />
                  </dd>
                </div>
              </dl>
              <p>{m.revenue.preview}</p>
              <div className="bap-floor">
                <span>{m.revenue.floor}</span>
                <strong>
                  <SiteMoney value={FLOOR} from="MAD" />
                </strong>
              </div>
            </>
          ) : scenario === 'ops' ? (
            <>
              <label className="bap-field" htmlFor={id}>
                {m.stock.quantityLabel}
              </label>
              <input
                id={id}
                type="number"
                min={1}
                max={999}
                step={1}
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <p>
                {m.stock.supplier} : <strong>{m.stock.supplierName}</strong>
              </p>
              <p>{m.stock.note}</p>
            </>
          ) : (
            <>
              <button
                className="bap-text-button"
                type="button"
                onClick={() => setReply(m.review.draft)}
              >
                {m.review.insert}
              </button>
              <label className="bap-field" htmlFor={id}>
                {m.review.response}
              </label>
              <textarea
                id={id}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={5}
                required
                maxLength={2000}
              />
            </>
          )}
          <p className="bap-editor-hint">{m.confirmHint}</p>
        </div>
        <footer className="baitly-hitl-actions bap-dialog-actions">
          <DialogClose className="baitly-hitl-secondary" type="button">
            {m.cancel}
          </DialogClose>
          <button
            className="baitly-hitl-primary"
            type="submit"
            disabled={!valid}
          >
            <CheckIcon size={15} />
            {m.confirm}
          </button>
        </footer>
      </form>
    </DialogContent>
  );
}

export default function BaitlyAgentsHeroDemo({
  language,
}: {
  language: SiteLanguage;
}) {
  const m = AGENTS_PAGE_MESSAGES[language];
  const { pause: pauseCurrency } = useSiteCurrency();
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const [scenario, setScenario] = useState<AgentsDemoScenario>('rev');
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [why, setWhy] = useState(false);
  const [open, setOpen] = useState(false);
  const [decisions, setDecisions] = useState<
    Partial<Record<AgentsDemoScenario, DemoDecision>>
  >({});
  const resultRef = useRef<HTMLParagraphElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const copy = copyFor(m, scenario);
  const decision = decisions[scenario];
  const running = active && !paused && !open && !decision && stage < 2;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setStage((value) => Math.min(2, value + 1)),
      2600,
    );
    return () => window.clearTimeout(timer);
  }, [running, stage]);
  useEffect(() => {
    if (decision) resultRef.current?.focus();
  }, [decision]);
  const decide = (value: DemoDecision) => {
    setDecisions((current) => ({ ...current, [scenario]: value }));
    setOpen(false);
    setPaused(true);
    setStage(2);
  };
  const reset = () => {
    setDecisions((current) => ({ ...current, [scenario]: undefined }));
    setWhy(false);
    setStage(0);
    setPaused(false);
  };
  const count = SCENARIOS.filter((key) => !decisions[key]).length;
  return (
    <div className="bap-demo" ref={visibilityRef}>
      <div className="bap-demo-caption">
        <span>{m.demo}</span>
        <button
          className="bap-icon-button"
          aria-label={running ? m.pause : m.play}
          onClick={() => {
            if (running) setPaused(true);
            else {
              setStage(0);
              setPaused(false);
            }
          }}
          disabled={reduced || Boolean(decision)}
        >
          {running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
      </div>
      <div
        className="bap-demo-window bap-ui baitly-supervision-surface"
        onFocusCapture={() => setPaused(true)}
      >
        <div className="bap-property">
          <img src={SITE_PHOTOS.planningRiad} width={46} height={46} alt="" />
          <div>
            <strong>{m.property}</strong>
            <span>{m.location}</span>
          </div>
          <span className="bap-pending-count">
            {count} <span>{m.pending}</span>
          </span>
        </div>
        <div
          className="bap-signal"
          data-running={running || undefined}
          aria-hidden="true"
        >
          <span>
            <BaitlyMarkLogo
              variant="mark"
              colorMode="inherit"
              disableAnimation
            />
          </span>
          <svg viewBox="0 0 240 24" preserveAspectRatio="none">
            <path d="M0 12H240" />
            <path className="bap-data-packet" pathLength="100" d="M0 12H240" />
          </svg>
          <span>
            <AgentIcon token={AGENT_META[scenario].icon} size={21} />
          </span>
        </div>
        <div className="bap-scenario-tabs" role="group" aria-label={m.demo}>
          {SCENARIOS.map((key) => (
            <button
              key={key}
              aria-pressed={scenario === key}
              onClick={() => {
                setScenario(key);
                setWhy(false);
                setStage(2);
                setPaused(true);
              }}
            >
              <AgentIcon token={AGENT_META[key].icon} size={16} />
              <span>{copyFor(m, key).name}</span>
              {decisions[key] &&
                (decisions[key]?.status === 'ignored' ? (
                  <EyeOffIcon size={12} />
                ) : (
                  <CheckIcon size={12} />
                ))}
            </button>
          ))}
        </div>
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (value) pauseCurrency();
          }}
        >
          <article
            className="baitly-hitl-card bap-hitl"
            aria-labelledby={titleId}
          >
            <div className="baitly-hitl-content">
              <div className="bap-card-meta">
                <span className="baitly-hitl-agent bap-agent-name">
                  <AgentIcon token={AGENT_META[scenario].icon} size={16} />
                  {copy.name}
                </span>
                <span className="baitly-hitl-deadline">
                  <Clock3Icon size={12} />
                  {m.expires}
                </span>
              </div>
              <div className="baitly-action-illustrated-heading">
                {scenario !== 'ops' && <Illustration scenario={scenario} />}
                <div className="baitly-action-heading-copy">
                  <h3 id={titleId}>{copy.title}</h3>
                </div>
              </div>
              {scenario === 'rev' ? (
                <RevenueFacts
                  m={m}
                  language={language}
                  percent={decision?.edits?.percent}
                />
              ) : scenario === 'ops' ? (
                <StockFacts m={m} quantity={decision?.edits?.quantity} />
              ) : (
                <ReviewFacts m={m} reply={decision?.edits?.reply} />
              )}
            </div>
            {!decision ? (
              <footer className="baitly-hitl-actions bap-card-actions">
                <DialogTrigger
                  className="baitly-hitl-primary"
                  onClick={() => {
                    setPaused(true);
                    setStage(2);
                  }}
                >
                  <SendIcon size={15} />
                  {copy.action}
                </DialogTrigger>
                <button
                  className="baitly-hitl-secondary"
                  onClick={() => decide({ status: 'ignored' })}
                >
                  <EyeOffIcon size={14} />
                  {m.dismiss}
                </button>
                <button
                  className="baitly-hitl-secondary bap-why"
                  aria-expanded={why}
                  aria-controls={reasonId}
                  onClick={() => {
                    setWhy(!why);
                    setPaused(true);
                  }}
                >
                  <span>{m.why}</span>
                  <ChevronDownIcon size={14} />
                </button>
              </footer>
            ) : (
              <footer className="bap-outcome" data-outcome={decision.status}>
                <p role="status" tabIndex={-1} ref={resultRef}>
                  {decision.status === 'ignored' ? (
                    <EyeOffIcon size={18} />
                  ) : (
                    <CheckIcon size={18} />
                  )}
                  {decision.status === 'approved' ? copy.done : m.ignored}
                </p>
                <button className="bap-text-button" onClick={reset}>
                  <RotateCcwIcon size={14} />
                  {m.reset}
                </button>
              </footer>
            )}
            <p className="baitly-hitl-reasoning" id={reasonId} hidden={!why}>
              {copy.reason}
            </p>
          </article>
          {open && (
            <ActionEditor
              key={scenario}
              scenario={scenario}
              m={m}
              language={language}
              onConfirm={(edits) => decide({ status: 'approved', edits })}
              focusResult={() => resultRef.current?.focus()}
            />
          )}
        </Dialog>
        <div className="bap-demo-stages">
          <ol>
            {m.stages.map((label, index) => (
              <li key={label} data-active={index === stage || undefined}>
                <span>{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <p>{m.stageNotes[stage]}</p>
        </div>
      </div>
      <p className="bap-example">{m.example}</p>
      <div className="bap-demo-journal">
        <span>{m.journal}</span>
        {SCENARIOS.filter((key) => decisions[key]).length ? (
          <ul>
            {SCENARIOS.filter((key) => decisions[key]).map((key) => (
              <li key={key}>
                {decisions[key]?.status === 'ignored' ? (
                  <EyeOffIcon size={14} />
                ) : (
                  <CheckIcon size={14} />
                )}
                <strong>{copyFor(m, key).name}</strong>
                <span>
                  {decisions[key]?.status === 'approved'
                    ? m.approved
                    : m.ignoredLabel}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{m.noActivity}</p>
        )}
      </div>
    </div>
  );
}
