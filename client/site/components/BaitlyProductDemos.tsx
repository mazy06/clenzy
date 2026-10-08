import SiteMoney, {
  SiteCurrencySymbol,
  SiteMoneyText,
  useSiteMoney,
} from './SiteMoney';
import { useSiteCurrency } from '../lib/siteCurrency';
import { useId, useState, type ReactNode } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  CheckCheckIcon,
  CircleCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '../../src/icons/glyphs';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import { BAITLY_PRODUCT_DEMO_MESSAGES } from '../lib/messages/baitlyProductDemos';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';
import type { SiteLanguage } from '../lib/siteLanguage';
import {
  demoNightlyPrices,
  demoOwnerStatement,
  type ProductStoryKind,
} from '../data/baitlyProductStories';
import cleaner from '../assets/people/provider-1.jpg';
import stripe from '../assets/brands/stripe.svg';
import payzone from '../assets/brands/payzone.svg';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  operationsProof: bedroom,
  financeStay: riad,
  devicesDoor: riadFull,
} = SITE_PHOTOS;

type DemoProps = { language: SiteLanguage };

function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="bps-choices" role="group" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === index}
          onClick={() => onChange(index)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function DemoHeader({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="bps-demo-header">
      <BaitlyMarkLogo size={26} disableAnimation colorMode="inherit" />
      <span>{children}</span>
      {icon}
    </div>
  );
}

export function RevenueDemo({ language }: DemoProps) {
  const m = BAITLY_PRODUCT_DEMO_MESSAGES[language].revenue;
  const [scenario, setScenario] = useState(1);
  const [floor, setFloor] = useState(650);
  const id = useId();
  const prices = demoNightlyPrices(scenario, floor);
  const currency = useSiteCurrency();
  const money = useSiteMoney('MAD', language);
  return (
    <div className="bps-demo bps-revenue-demo">
      <DemoHeader icon={<ShieldCheckIcon aria-hidden="true" />}>
        {m.title}
      </DemoHeader>
      <div className="bps-demo-body">
        <p className="bps-control-label">{m.demand}</p>
        <Choices
          label={m.demand}
          options={m.scenarios}
          value={scenario}
          onChange={setScenario}
        />
        <div className="bps-chart" role="group" aria-label={m.chart}>
          {prices.map((price, index) => (
            <div className="bps-chart-column" key={index}>
              <strong>
                <SiteMoney
                  language={language}
                  value={price}
                  from="MAD"
                  symbol={false}
                />
              </strong>
              <div className="bps-bar-track">
                <div
                  className="bps-bar"
                  style={{ transform: `scaleY(${price / 1200})` }}
                />
              </div>
              <span>{m.days[index]}</span>
            </div>
          ))}
        </div>
        <p className="bps-chart-unit">
          <SiteCurrencySymbol currency={currency.currency ?? 'MAD'} /> /{' '}
          {language === 'fr' ? 'nuit' : language === 'en' ? 'night' : 'ليلة'}
        </p>
        <div className="bps-floor">
          <label htmlFor={id}>
            {m.floor}
            <output
              htmlFor={id}
              aria-live={currency.playing ? 'off' : 'polite'}
            >
              {money(floor)}
            </output>
          </label>
          <input
            id={id}
            type="range"
            min="550"
            max="1000"
            step="50"
            value={floor}
            aria-valuetext={money.label(floor)}
            onChange={(event) => {
              currency.pause();
              setFloor(Number(event.target.value));
            }}
          />
          <span className="bps-status">
            <ShieldCheckIcon aria-hidden="true" />
            {m.status}
          </span>
        </div>
        <p className="bps-demo-note">{m.note}</p>
      </div>
    </div>
  );
}

const PAYMENT_EXAMPLES = [
  { currency: 'MAD', price: 850, provider: 'Payzone', logo: payzone },
  { currency: 'SAR', price: 350, provider: 'PayTabs', logo: undefined },
  { currency: 'EUR', price: 95, provider: 'Stripe', logo: stripe },
] as const;

export function FinanceDemo({ language }: DemoProps) {
  const m = BAITLY_PRODUCT_DEMO_MESSAGES[language];
  const f = m.finance;
  const [selectedCountry, setCountry] = useState(0);
  const currency = useSiteCurrency();
  const country = currency.currency
    ? PAYMENT_EXAMPLES.findIndex((item) => item.currency === currency.currency)
    : selectedCountry;
  const [paid, setPaid] = useState(false);
  const sample = PAYMENT_EXAMPLES[country];
  const amount = useSiteMoney(sample.currency, language, sample.currency);
  return (
    <div className="bps-demo bps-finance-demo">
      <DemoHeader icon={<CreditCardIcon aria-hidden="true" />}>
        {f.title}
      </DemoHeader>
      <div className="bps-demo-body">
        <Choices
          label={f.country}
          options={f.countries}
          value={country}
          onChange={(value) => {
            setCountry(value);
            currency.select(PAYMENT_EXAMPLES[value].currency);
            setPaid(false);
          }}
        />
        <div className="bps-booking-summary">
          <img src={riad} alt="" width="72" height="72" />
          <div>
            <strong>{m.property}</strong>
            <span>{f.stay}</span>
          </div>
          <span className="bps-booking-ref" dir="ltr">
            #BT-2409
          </span>
        </div>
        <dl className="bps-money-lines">
          <div>
            <dt>{f.nightly}</dt>
            <dd>
              <bdi>{amount(sample.price)}</bdi>
            </dd>
          </div>
          <div className="bps-money-total">
            <dt>{f.total}</dt>
            <dd>
              <bdi>{amount(sample.price * 3)}</bdi>
            </dd>
          </div>
        </dl>
        <div className="bps-payment-provider">
          <span>{f.method}</span>
          {sample.logo ? (
            <img
              src={sample.logo}
              alt={sample.provider}
              width="78"
              height="24"
            />
          ) : (
            <bdi>{sample.provider}</bdi>
          )}
        </div>
        <div className="bps-payment-result" aria-live="polite">
          {paid ? (
            <div className="bps-success bps-enter">
              <CircleCheckIcon aria-hidden="true" />
              <div>
                <strong>{f.done}</strong>
                <span>{f.receipt}</span>
              </div>
            </div>
          ) : (
            <button
              className="bps-demo-action"
              type="button"
              onClick={() => {
                currency.pause();
                setPaid(true);
              }}
            >
              <LockKeyholeIcon aria-hidden="true" />
              {f.action}
              <ArrowRightIcon aria-hidden="true" />
            </button>
          )}
        </div>
        <ol className="bps-payment-steps">
          {f.steps.map((step, index) => (
            <li key={step} data-done={paid || index === 0}>
              <CheckIcon aria-hidden="true" />
              {step}
            </li>
          ))}
        </ol>
        <p className="bps-demo-note">{f.note}</p>
      </div>
    </div>
  );
}

export function OperationsDemo({ language }: DemoProps) {
  const m = BAITLY_PRODUCT_DEMO_MESSAGES[language];
  const o = m.operations;
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [approved, setApproved] = useState(false);
  const count = checks.filter(Boolean).length;
  return (
    <div className="bps-demo bps-operations-demo">
      <DemoHeader icon={<CheckCheckIcon aria-hidden="true" />}>
        {o.title}
      </DemoHeader>
      <div className="bps-mission-cover">
        <img src={bedroom} alt={o.evidence} width="560" height="190" />
        <span>
          {m.property}
          <small>{o.time}</small>
        </span>
      </div>
      <div className="bps-demo-body">
        <div className="bps-mission-owner">
          <img src={cleaner} alt="" width="36" height="36" />
          <span>{o.team}</span>
          <strong aria-label={`${o.progress} : ${count} / 3`}>
            {count} / 3
          </strong>
        </div>
        <div className="bps-checklist">
          {o.tasks.map((task, index) => (
            <label key={task}>
              <input
                type="checkbox"
                checked={checks[index]}
                disabled={approved}
                onChange={() =>
                  setChecks((current) =>
                    current.map((value, i) => (i === index ? !value : value)),
                  )
                }
              />
              <span>{task}</span>
              {index === 2 && (
                <img src={bedroom} alt="" width="42" height="32" />
              )}
            </label>
          ))}
        </div>
        <div aria-live="polite">
          {approved ? (
            <div className="bps-success bps-enter">
              <CircleCheckIcon aria-hidden="true" />
              <strong>{o.done}</strong>
              <button
                type="button"
                className="bps-inline-button"
                onClick={() => {
                  setChecks([false, false, false]);
                  setApproved(false);
                }}
              >
                {m.reset}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="bps-demo-action"
              disabled={count < 3}
              onClick={() => setApproved(true)}
            >
              {o.action}
              <CheckIcon aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="bps-demo-note">{o.note}</p>
      </div>
    </div>
  );
}

export function DevicesDemo({ language }: DemoProps) {
  const m = BAITLY_PRODUCT_DEMO_MESSAGES[language];
  const d = m.devices;
  const [phase, setPhase] = useState(1);
  return (
    <div className="bps-demo bps-devices-demo">
      <DemoHeader icon={<KeyRoundIcon aria-hidden="true" />}>
        {d.title}
      </DemoHeader>
      <div className="bps-demo-body">
        <Choices
          label={d.phase}
          options={d.phases}
          value={phase}
          onChange={setPhase}
        />
        <div className="bps-access-scene">
          <img
            className="bps-door-photo"
            src={riadFull}
            alt=""
            width="480"
            height="280"
          />
          <div className="bps-access-pass" data-active={phase === 1}>
            <span className="bps-pass-property">
              {m.property}
              <KeyRoundIcon aria-hidden="true" />
            </span>
            <span>{d.door}</span>
            <p className="bps-access-code" dir="ltr">
              428 716
            </p>
            <span className="bps-pass-label">{d.key}</span>
            <div className="bps-access-status" role="status" key={phase}>
              <span />
              {d.states[phase]}
            </div>
          </div>
        </div>
        <div className="bps-access-dates">
          <span>{d.arrival}</span>
          <span>{d.departure}</span>
        </div>
        <p className="bps-demo-note">{d.note}</p>
      </div>
    </div>
  );
}

export function OwnersDemo({ language }: DemoProps) {
  const m = BAITLY_PRODUCT_DEMO_MESSAGES[language];
  const o = m.owners;
  const [month, setMonth] = useState(2);
  const statement = demoOwnerStatement(month);
  return (
    <div className="bps-demo bps-owners-demo">
      <DemoHeader icon={<FileTextIcon aria-hidden="true" />}>
        {o.title}
      </DemoHeader>
      <div className="bps-demo-body">
        <Choices
          label={o.month}
          options={o.months}
          value={month}
          onChange={setMonth}
        />
        <div className="bps-statement">
          <div className="bps-statement-property">
            <div>
              <p>{o.document}</p>
              <h3>{m.property}</h3>
              <span>{m.location}</span>
            </div>
            <img src={SITE_PHOTOS.ownersStay} alt="" width="84" height="84" />
          </div>
          <dl className="bps-money-lines">
            <div>
              <dt>{o.gross}</dt>
              <dd>
                <bdi>
                  <SiteMoney
                    language={language}
                    value={statement.gross}
                    from="MAD"
                  />
                </bdi>
              </dd>
            </div>
            <div>
              <dt>{o.commission}</dt>
              <dd>
                <bdi>
                  −
                  <SiteMoney
                    language={language}
                    value={statement.commission}
                    from="MAD"
                  />
                </bdi>
              </dd>
            </div>
            <div>
              <dt>{o.expenses}</dt>
              <dd>
                <bdi>
                  −
                  <SiteMoney
                    language={language}
                    value={statement.expenses}
                    from="MAD"
                  />
                </bdi>
              </dd>
            </div>
            <div className="bps-statement-net" key={month}>
              <dt>{o.net}</dt>
              <dd className="bps-enter">
                <bdi>
                  <SiteMoney
                    language={language}
                    value={statement.net}
                    from="MAD"
                  />
                </bdi>
              </dd>
            </div>
          </dl>
          <div className="bps-statement-seal">
            <CheckIcon aria-hidden="true" />
            <span>Baitly</span>
          </div>
        </div>
        <p className="bps-demo-note">{o.note}</p>
      </div>
    </div>
  );
}

export function AgentsDemo({ language }: DemoProps) {
  const m = MOCKUP_MESSAGES[language].demo;
  const [selected, setSelected] = useState(0);
  const [approved, setApproved] = useState(false);
  const scenario = m.scenarios[selected];
  return (
    <div className="bps-demo bps-agents-demo">
      <DemoHeader icon={<SparklesIcon aria-hidden="true" />}>
        {m.brand}
      </DemoHeader>
      <div className="bps-demo-body">
        <Choices
          label={m.chooseAria}
          options={m.scenarios.map((item) => item.name)}
          value={selected}
          onChange={(value) => {
            setSelected(value);
            setApproved(false);
          }}
        />
        <div className="bps-agent-proposal" key={selected}>
          <div className="bps-agent-signal">
            <span className="bps-agent-orbit">
              <SparklesIcon aria-hidden="true" />
            </span>
            <div>
              <strong>
                {m.agentPrefix} {scenario.name}
              </strong>
              <span>
                {m.propertyName} · {m.propertyCity}
              </span>
            </div>
          </div>
          <h3>{scenario.title}</h3>
          <p>
            <SiteMoneyText language={language}>{scenario.copy}</SiteMoneyText>
          </p>
          <div className="bps-agent-change">
            <span>
              <SiteMoneyText language={language}>
                {m.steps[selected].before}
              </SiteMoneyText>
            </span>
            <ArrowRightIcon aria-hidden="true" />
            <strong>
              <SiteMoneyText language={language}>
                {m.steps[selected].after}
              </SiteMoneyText>
            </strong>
          </div>
          <p className="bps-agent-reason">
            <ShieldCheckIcon aria-hidden="true" />
            <SiteMoneyText language={language}>{scenario.detail}</SiteMoneyText>
          </p>
        </div>
        <div className="bps-agent-decision" aria-live="polite">
          {approved ? (
            <div className="bps-success bps-enter">
              <CircleCheckIcon aria-hidden="true" />
              <strong>{scenario.done}</strong>
            </div>
          ) : (
            <button
              type="button"
              className="bps-demo-action"
              onClick={() => setApproved(true)}
            >
              {scenario.action}
              <CheckIcon aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="bps-demo-note">
          <SiteMoneyText language={language}>{scenario.note}</SiteMoneyText>
        </p>
      </div>
    </div>
  );
}

const DEMOS = {
  agents: AgentsDemo,
  revenue: RevenueDemo,
  finance: FinanceDemo,
  operations: OperationsDemo,
  devices: DevicesDemo,
  owners: OwnersDemo,
};

export default function BaitlyProductDemo({
  kind,
  language,
}: DemoProps & { kind: ProductStoryKind }) {
  const Demo = DEMOS[kind];
  return <Demo language={language} />;
}
