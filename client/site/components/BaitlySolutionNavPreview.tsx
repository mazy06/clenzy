import { SiteCurrencySymbol } from './SiteMoney';
import type { CSSProperties } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  CoffeeIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import type { SiteLanguage } from '../lib/siteLanguage';
import { BAITLY_SOLUTION_PREVIEW_MESSAGES } from '../lib/messages/baitlySolutionPreviews';
import { BAITLY_PLANNING_STATUS } from '../data/baitlyPlanningAppearance';
import payzone from '../assets/brands/payzone.svg';
import stripe from '../assets/brands/stripe.svg';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  solutionRiad: riad,
  solutionHost: bedroom,
  solutionOwners: terrace,
} = SITE_PHOTOS;

export type BaitlySolutionPreviewKind =
  | 'concierge'
  | 'host'
  | 'riad'
  | 'saudi'
  | 'morocco'
  | 'france'
  | 'multi-owner';

const ROOM_BOOKINGS = [
  { guest: 'Sofia', offset: 0, length: 60, status: 'checked_in' },
  { guest: 'Adam', offset: 40, length: 60, status: 'confirmed' },
  { guest: 'Nora', offset: 20, length: 60, status: 'pending' },
] as const;
const PROPERTY_PHOTOS = [riad, terrace, bedroom];

/** Static example data; the motion illustrates coordination, never a live transaction. */
export default function BaitlySolutionNavPreview({
  kind,
  language,
}: {
  kind: BaitlySolutionPreviewKind;
  language: SiteLanguage;
}) {
  const m = BAITLY_SOLUTION_PREVIEW_MESSAGES[language];
  const example = <small className="bns-example">{m.example}</small>;
  let scene;
  switch (kind) {
    case 'concierge':
      scene = (
        <>
          <div className="bns-heading">
            <UsersIcon />
            <strong>{m.portfolio}</strong>
            {example}
          </div>
          <div className="bns-dispatch">
            {m.properties.map((name, i) => (
              <div
                className="bns-dispatch-row"
                key={name}
                style={{ '--bnv-delay': `${i * 180}ms` } as CSSProperties}
              >
                <img src={PROPERTY_PHOTOS[i]} alt="" />
                <span>{name}</span>
                <b className="bns-team">{['ML', 'SK', 'ML'][i]}</b>
                <CheckIcon className="bnv-arrive" />
              </div>
            ))}
          </div>
          <div className="bns-caption">
            <CheckIcon />
            {m.coordinated}
          </div>
        </>
      );
      break;
    case 'host':
      scene = (
        <div className="bns-host-layout">
          <div className="bns-phone">
            <div className="bns-phone-top">
              <span dir="ltr">09:41</span>
              <BaitlyMarkLogo
                variant="mark"
                size={13}
                disableAnimation
                colorMode="inherit"
              />
            </div>
            <span className="bns-phone-date">{m.arrival}</span>
            <div className="bns-message">
              <MessageSquareTextIcon />
              <strong>{m.message}</strong>
              <i />
              <i />
            </div>
            <span className="bns-phone-approve">
              {m.approve}
              <CheckIcon className="bnv-arrive" />
            </span>
          </div>
          <div className="bns-host-copy">
            {example}
            <ShieldCheckIcon />
            <strong>{m.host}</strong>
            <span>{m.assisted}</span>
          </div>
        </div>
      );
      break;
    case 'riad':
      scene = (
        <>
          <div className="bns-heading">
            <img className="bns-property-photo" src={riad} alt="" />
            <strong>{m.properties[0]}</strong>
            {example}
          </div>
          <div className="bns-room-calendar" dir="ltr">
            <div className="bns-room-dates">
              <span />
              {[23, 24, 25, 26, 27].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            {ROOM_BOOKINGS.map((stay, i) => (
              <div className="bns-room-row" key={stay.guest}>
                <span>{m.rooms[i]}</span>
                <div className="bns-room-track">
                  <span
                    className="bns-room-booking"
                    style={
                      {
                        insetInlineStart: `${stay.offset}%`,
                        width: `${stay.length}%`,
                        background:
                          BAITLY_PLANNING_STATUS[stay.status].background,
                        color: BAITLY_PLANNING_STATUS[stay.status].foreground,
                        '--bnv-delay': `${i * 150}ms`,
                      } as CSSProperties
                    }
                  >
                    {stay.guest}
                    <CheckIcon />
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="bns-caption">
            <CoffeeIcon />
            {m.breakfast}
          </div>
        </>
      );
      break;
    case 'saudi':
      scene = (
        <>
          <div className="bns-heading">
            <FileTextIcon />
            <strong>{m.invoice}</strong>
            {example}
          </div>
          <div className="bns-saudi-layout">
            <div className="bns-invoice">
              <small dir="ltr">#BT-2409</small>
              <strong>ZATCA</strong>
              <div className="bns-document-lines">
                <i />
                <i />
                <i />
              </div>
              <span>
                <b>
                  <SiteCurrencySymbol currency="SAR" />
                </b>
                <ShieldCheckIcon className="bnv-arrive" />
              </span>
            </div>
            <div className="bns-compliance-steps">
              <span>
                <small>{m.registry}</small>
                <strong>Shomoos</strong>
                <CheckIcon className="bnv-arrive" />
              </span>
              <span>
                <small>{m.payments}</small>
                <strong>PayTabs</strong>
                <CheckIcon className="bnv-arrive" />
              </span>
            </div>
          </div>
        </>
      );
      break;
    case 'morocco':
      scene = (
        <>
          <div className="bns-heading">
            <FileTextIcon />
            <strong>{m.guestFile}</strong>
            {example}
          </div>
          <div className="bns-guest-file">
            <span className="bns-guest-initials">SF</span>
            <div>
              <strong>{m.guest}</strong>
              <small>{m.dates}</small>
              <span dir="ltr">24.09 → 27.09</span>
            </div>
            <b>DGSN</b>
            <CheckIcon className="bnv-arrive" />
          </div>
          <div className="bns-local-tax">
            <span>
              {m.touristTax}
              <small>{m.localRules}</small>
            </span>
            <b>
              <SiteCurrencySymbol currency="MAD" />
            </b>
            <img src={payzone} alt="" />
          </div>
        </>
      );
      break;
    case 'france':
      scene = (
        <>
          <div className="bns-heading">
            <FileTextIcon />
            <strong>{m.furnished}</strong>
            {example}
          </div>
          <div className="bns-compliance-steps">
            <span>
              <small>{m.registration}</small>
              <strong dir="ltr">75056 000123 4X</strong>
              <CheckIcon className="bnv-arrive" />
            </span>
            <span>
              <small>{m.nightsCap}</small>
              <strong>{m.nightsValue}</strong>
              <CheckIcon className="bnv-arrive" />
            </span>
          </div>
          <div className="bns-local-tax">
            <span>
              {m.touristTax}
              <small>{m.localRules}</small>
            </span>
            <b>
              <SiteCurrencySymbol currency="EUR" />
            </b>
            <img src={stripe} alt="" />
          </div>
        </>
      );
      break;
    case 'multi-owner':
      scene = (
        <>
          <div className="bns-heading">
            <BaitlyMarkLogo
              variant="full"
              size={20}
              disableAnimation
              colorMode="inherit"
            />
            {example}
          </div>
          <p className="bns-owner-title">{m.owners}</p>
          <svg
            className="bns-owner-routing"
            viewBox="0 0 200 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M100 0 V7 Q100 12 95 12 H55 Q50 12 50 17 V24 M100 7 Q100 12 105 12 H145 Q150 12 150 17 V24"
              pathLength="100"
            />
            <path
              className="bns-routing-data"
              d="M100 0 V7 Q100 12 95 12 H55 Q50 12 50 17 V24"
              pathLength="100"
            />
            <path
              className="bns-routing-data"
              d="M100 0 V7 Q100 12 105 12 H145 Q150 12 150 17 V24"
              pathLength="100"
            />
          </svg>
          <div className="bns-owner-columns">
            {m.names.map((name, i) => (
              <div key={name}>
                <span className="bns-owner-person">
                  <b>{['AM', 'YB'][i]}</b>
                  <strong>{name}</strong>
                </span>
                <span>
                  <FileTextIcon />
                  {m.statement}
                </span>
                <span className="bns-owner-payout">
                  <ArrowRightIcon />
                  {m.payout}
                  <CheckIcon className="bnv-arrive" />
                </span>
              </div>
            ))}
          </div>
        </>
      );
      break;
  }
  return (
    <div
      className={`bns-solution bns-${kind}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {scene}
    </div>
  );
}
