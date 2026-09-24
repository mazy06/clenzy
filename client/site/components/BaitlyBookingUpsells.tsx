import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  ShoppingBagIcon,
  XIcon,
} from 'lucide-react';
import { useSiteLanguage } from '../lib/siteLanguage';
import {
  BAITLY_BOOKING_UPSELL_MESSAGES,
  type BookingUpsellGroup,
  type BookingUpsellId,
  type BookingUpsellMessages,
} from '../lib/messages/baitlyBookingUpsells';
import balloon from '../assets/photos/balloon.jpg';
import desert from '../assets/photos/excursion.jpg';
import chef from '../assets/services/chef.jpg';
import food from '../assets/photos/food.jpg';
import bedroom from '../assets/photos/bedroom.jpg';
import cleaning from '../assets/services/menage.jpg';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';
import BaitlyDemoPointer from './BaitlyDemoPointer';
import '../baitly-booking-upsells.css';

const OFFERS: {
  id: BookingUpsellId;
  group: BookingUpsellGroup;
  photo: string;
  price: number;
}[] = [
  { id: 'late', group: 'stay', photo: bedroom, price: 45 },
  { id: 'cleaning', group: 'stay', photo: cleaning, price: 60 },
  { id: 'chef', group: 'private', photo: chef, price: 85 },
  { id: 'dinner', group: 'private', photo: food, price: 36 },
  { id: 'balloon', group: 'experiences', photo: balloon, price: 120 },
  { id: 'desert', group: 'experiences', photo: desert, price: 65 },
];
const GROUPS: BookingUpsellGroup[] = ['stay', 'private', 'experiences'];

export default function BaitlyBookingUpsells() {
  const { language } = useSiteLanguage();
  const m = BAITLY_BOOKING_UPSELL_MESSAGES[language];
  // A visitor's illustrative selection, discarded when the page is left.
  const [group, setGroup] = useState<BookingUpsellGroup>(GROUPS[0]);
  const [selected, setSelected] = useState<BookingUpsellId[]>([]);
  const [beat, setBeat] = useState(0);
  const { visibilityRef, active } = useBaitlyDemoVisibility();
  const nextGroup = GROUPS[(GROUPS.indexOf(group) + 1) % GROUPS.length];
  const pointerSequence = `${group}-${beat}-${selected.join('-')}`;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      const offers = OFFERS.filter((offer) => offer.group === group);
      if (beat < offers.length) {
        const id = offers[beat].id;
        setSelected((current) =>
          current.includes(id) ? current : [...current, id],
        );
        setBeat((current) => current + 1);
      } else {
        setGroup(GROUPS[(GROUPS.indexOf(group) + 1) % GROUPS.length]);
        setSelected([]);
        setBeat(0);
      }
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [active, group, beat, selected]);

  const selectGroup = (id: BookingUpsellGroup) => {
    setGroup(id);
    setBeat(0);
  };
  const money = (value: number) =>
    new Intl.NumberFormat(language, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  const toggle = (id: BookingUpsellId) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  return (
    <section
      className="bb-upsells"
      id="booking-upsells"
      aria-labelledby="bb-upsells-title"
    >
      <div className="site-shell">
        <div className="bb-section-heading">
          <div>
            <p className="bb-eyebrow">{m.eyebrow}</p>
            <h2 id="bb-upsells-title">{m.title}</h2>
          </div>
          <p>{m.intro}</p>
        </div>
        <div
          className="bb-upsell-navigation"
          role="group"
          aria-label={m.choose}
        >
          {GROUPS.map((id) => (
            <button
              type="button"
              key={id}
              className="bb-demo-target"
              aria-pressed={group === id}
              aria-controls="bb-upsell-offers"
              onClick={() => selectGroup(id)}
            >
              {m.groups[id].label}
              <ArrowRightIcon />
              <BaitlyDemoPointer
                show={active && beat === 2 && id === nextGroup}
                sequence={pointerSequence}
              />
            </button>
          ))}
        </div>
        <p className="bb-upsell-description">{m.groups[group].copy}</p>
        <div className="bb-upsell-layout" ref={visibilityRef}>
          <div className="bb-upsell-offers" id="bb-upsell-offers" key={group}>
            {OFFERS.filter((offer) => offer.group === group).map(
              (offer, index) => (
                <article className="bb-upsell-offer" key={offer.id}>
                  <div className="bb-upsell-photo">
                    <img
                      src={offer.photo}
                      alt=""
                      width="600"
                      height="440"
                      loading="lazy"
                    />
                    {selected.includes(offer.id) && (
                      <span>
                        <CheckIcon />
                        {m.added}
                      </span>
                    )}
                  </div>
                  <div className="bb-upsell-offer-body">
                    <h3>{m.offers[offer.id].title}</h3>
                    <p>{m.offers[offer.id].detail}</p>
                    <div>
                      <strong>{money(offer.price)}</strong>
                      <button
                        type="button"
                        className="bb-demo-target"
                        aria-label={`${
                          selected.includes(offer.id) ? m.remove : m.add
                        } : ${m.offers[offer.id].title}`}
                        aria-pressed={selected.includes(offer.id)}
                        onClick={() => toggle(offer.id)}
                      >
                        {selected.includes(offer.id) ? (
                          <CheckIcon />
                        ) : (
                          <PlusIcon />
                        )}
                        {selected.includes(offer.id) ? m.added : m.add}
                        <BaitlyDemoPointer
                          show={
                            active &&
                            beat === index &&
                            !selected.includes(offer.id)
                          }
                          sequence={pointerSequence}
                        />
                      </button>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
          <UpsellSelection
            selected={selected}
            toggle={toggle}
            m={m}
            money={money}
            automatic={active}
          />
        </div>
        <p className="bb-caption">{m.note}</p>
        <div className="bb-upsell-business">
          <div>
            <h3>{m.ownTitle}</h3>
            <p>{m.ownCopy}</p>
          </div>
          <div>
            <h3>{m.partnerTitle}</h3>
            <p>{m.partnerCopy}</p>
          </div>
        </div>
        <div className="bb-upsell-continuation">
          <p>{m.continuation}</p>
          <Link
            to={`/produit/livret-accueil?lang=${language}`}
            className="bb-explore"
          >
            {m.guideLink}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

function UpsellSelection({
  selected,
  toggle,
  m,
  money,
  automatic,
}: {
  selected: BookingUpsellId[];
  toggle: (id: BookingUpsellId) => void;
  m: BookingUpsellMessages;
  money: (value: number) => string;
  automatic: boolean;
}) {
  const offers = selected.map((id) => OFFERS.find((offer) => offer.id === id)!);
  const total = offers.reduce((sum, offer) => sum + offer.price, 0);
  return (
    <aside className="bb-upsell-selection" aria-label={m.selection}>
      <div className="bb-upsell-selection-heading">
        <ShoppingBagIcon />
        <h3>{m.selection}</h3>
        <span>{selected.length}</span>
      </div>
      {offers.length ? (
        <ul>
          {offers.map((offer) => (
            <li key={offer.id}>
              <span>
                {m.offers[offer.id].title}
                <strong>{money(offer.price)}</strong>
              </span>
              <button
                type="button"
                aria-label={`${m.remove} : ${m.offers[offer.id].title}`}
                onClick={() => toggle(offer.id)}
              >
                <XIcon />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bb-upsell-empty">
          <p>{m.empty}</p>
          <span>
            <PlusIcon />
            {m.tryIt}
          </span>
        </div>
      )}
      <div
        className="bb-upsell-total"
        role="status"
        aria-live={automatic ? 'off' : 'polite'}
        aria-atomic="true"
      >
        <span>{m.total}</span>
        <strong key={total}>{money(total)}</strong>
        <p>{m.value}</p>
      </div>
    </aside>
  );
}
