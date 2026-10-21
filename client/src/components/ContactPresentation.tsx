import type { ReactNode } from 'react';
import { Mail, Phone, UserRound, Users } from '../icons/glyphs';
import { Avatar, AvatarImage, AvatarFallback } from './ui';
import { useTranslation } from '../hooks/useTranslation';
import { toApiMediaUrl } from '../utils/mediaUrl';
import { getGuestInitials } from './GuestAvatar';
import './contactPresentation.css';

interface ContactPresentationProps {
  name: string;
  label?: string;
  role?: string;
  photoUrl?: string | null;
  email?: string;
  phone?: string;
  team?: boolean;
  pending?: boolean;
  children?: ReactNode;
}

/** Identité et coordonnées communes aux voyageurs et interlocuteurs Baitly. */
export default function ContactPresentation({ name, label, role, photoUrl, email, phone, team, pending, children }: ContactPresentationProps) {
  const { t } = useTranslation();
  const phoneTarget = phone?.replace(/[^+\d]/g, '');
  const FallbackIcon = team ? Users : UserRound;
  return <div className="baitly-contact-presentation" role="group" aria-label={[label, name].filter(Boolean).join(' : ')}>
    <div className="baitly-contact-presentation__identity">
      <Avatar className="baitly-contact-presentation__avatar">
        <AvatarImage src={toApiMediaUrl(photoUrl ?? undefined)} alt="" />
        <AvatarFallback>{pending || !name.trim() ? <FallbackIcon className="size-5" aria-hidden /> : getGuestInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="baitly-contact-presentation__name">
        {label && <p className="baitly-contact-presentation__label">{label}</p>}
        <p className="baitly-contact-presentation__title" dir="auto">{name}</p>
        {role && <p className="baitly-contact-presentation__role" dir="auto">{role}</p>}
      </div>
    </div>
    {(email || phoneTarget) ? <div className="baitly-contact-presentation__coordinates">
      {phone && phoneTarget && <a href={`tel:${phoneTarget}`}><Phone className="size-4" aria-hidden /><span dir="ltr">{phone}</span></a>}
      {email && <a href={`mailto:${email}`}><Mail className="size-4" aria-hidden /><span dir="ltr">{email}</span></a>}
    </div> : !pending && <p className="baitly-contact-presentation__empty">{t('contactPresentation.noContact')}</p>}
    {children}
  </div>;
}
