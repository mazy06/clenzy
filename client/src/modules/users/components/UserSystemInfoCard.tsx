import React from 'react';
import { Person, Mail as MailIcon, Phone as PhoneIcon, Schedule } from '../../../icons';
import type { UserDetailsData } from './userDetailsTypes';
import { formatDate } from './userDetailsTypes';
import DetailField from './DetailField';
import DetailSection from './DetailSection';
import { useTranslation } from '../../../hooks/useTranslation';

interface UserSystemInfoCardProps {
  user: UserDetailsData;
}

/**
 * Renders three sections of user metadata as standalone DetailSection cards.
 * Each section has a distinct accent color to avoid the "identical card grid" pattern
 * (Impeccable absolute ban).
 */
const UserSystemInfoCard: React.FC<UserSystemInfoCardProps> = ({ user }) => {
  const { t } = useTranslation();
  return (
  <div className="flex flex-col gap-2">
    {/* Personnel — primary slate */}
    <DetailSection
      title={t('users.form.personalInfo')}
      accentColor="#6B8A9A"
      icon={<Person size={14} strokeWidth={1.75} />}
    >
      <DetailField label={t('users.firstName')} value={user.firstName} />
      <DetailField label={t('users.lastName')} value={user.lastName} />
    </DetailSection>

    {/* Contact — accent teal */}
    <DetailSection
      title={t('users.form.contactInfo')}
      accentColor="#4A9B8E"
      icon={<MailIcon size={14} strokeWidth={1.75} />}
    >
      <DetailField
        label={t('users.email')}
        value={user.email}
        href={user.email ? `mailto:${user.email}` : undefined}
        icon={<MailIcon size={12} strokeWidth={1.75} />}
      />
      <DetailField
        label={t('common.phone')}
        value={user.phoneNumber || undefined}
        copyValue={user.phoneNumber}
        href={user.phoneNumber ? `tel:${user.phoneNumber}` : undefined}
        icon={<PhoneIcon size={12} strokeWidth={1.75} />}
        monospace
      />
    </DetailSection>

    {/* Système — neutral muted */}
    <DetailSection
      title={t('users.form.systemInfo')}
      accentColor="#7BA3C2"
      icon={<Schedule size={14} strokeWidth={1.75} />}
    >
      <DetailField
        label={t('users.form.createdAt')}
        value={formatDate(user.createdAt)}
        monospace
        tone="muted"
      />
      {user.updatedAt && (
        <DetailField
          label={t('users.form.updatedAt')}
          value={formatDate(user.updatedAt)}
          monospace
          tone="muted"
        />
      )}
      {user.lastLoginAt && (
        <DetailField
          label={t('users.form.lastLogin')}
          value={formatDate(user.lastLoginAt)}
          monospace
          tone="muted"
        />
      )}
    </DetailSection>
  </div>
  );
};

export default UserSystemInfoCard;
