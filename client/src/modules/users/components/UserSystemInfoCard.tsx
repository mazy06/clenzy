import React from 'react';
import { Mail as MailIcon, Phone as PhoneIcon } from '../../../icons';
import type { UserDetailsData } from './userDetailsTypes';
import { formatDate } from './userDetailsTypes';
import DetailField from './DetailField';
import DetailSection from './DetailSection';
import { useTranslation } from '../../../hooks/useTranslation';

interface UserSystemInfoCardProps {
  user: UserDetailsData;
}

const UserSystemInfoCard: React.FC<UserSystemInfoCardProps> = ({ user }) => {
  const { t } = useTranslation();
  return (
    <>
      <DetailSection
        title={t('users.form.personalInfo')}
      >
        <DetailField label={t('users.firstName')} value={user.firstName} />
        <DetailField label={t('users.lastName')} value={user.lastName} />
      </DetailSection>

      <DetailSection
        title={t('users.form.contactInfo')}
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
    </>
  );
};

export const UserSystemDates: React.FC<UserSystemInfoCardProps> = ({ user }) => {
  const { t } = useTranslation();
  return (
    <DetailSection
      title={t('users.form.systemInfo')}
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
  );
};

export default UserSystemInfoCard;
