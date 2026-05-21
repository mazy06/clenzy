import React from 'react';
import { Box } from '@mui/material';
import { Person, Mail as MailIcon, Phone as PhoneIcon, Schedule } from '../../../icons';
import type { UserDetailsData } from './userDetailsTypes';
import { formatDate } from './userDetailsTypes';
import DetailField from './DetailField';
import DetailSection from './DetailSection';

interface UserSystemInfoCardProps {
  user: UserDetailsData;
}

/**
 * Renders three sections of user metadata as standalone DetailSection cards.
 * Each section has a distinct accent color to avoid the "identical card grid" pattern
 * (Impeccable absolute ban).
 */
const UserSystemInfoCard: React.FC<UserSystemInfoCardProps> = ({ user }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {/* Personnel — primary slate */}
    <DetailSection
      title="Informations personnelles"
      accentColor="#6B8A9A"
      icon={<Person size={14} strokeWidth={1.75} />}
    >
      <DetailField label="Prénom" value={user.firstName} />
      <DetailField label="Nom" value={user.lastName} />
    </DetailSection>

    {/* Contact — accent teal */}
    <DetailSection
      title="Informations de contact"
      accentColor="#4A9B8E"
      icon={<MailIcon size={14} strokeWidth={1.75} />}
    >
      <DetailField
        label="Email"
        value={user.email}
        href={user.email ? `mailto:${user.email}` : undefined}
        icon={<MailIcon size={12} strokeWidth={1.75} />}
      />
      <DetailField
        label="Téléphone"
        value={user.phoneNumber || undefined}
        copyValue={user.phoneNumber}
        href={user.phoneNumber ? `tel:${user.phoneNumber}` : undefined}
        icon={<PhoneIcon size={12} strokeWidth={1.75} />}
        monospace
      />
    </DetailSection>

    {/* Système — neutral muted */}
    <DetailSection
      title="Informations système"
      accentColor="#7BA3C2"
      icon={<Schedule size={14} strokeWidth={1.75} />}
    >
      <DetailField
        label="Créé le"
        value={formatDate(user.createdAt)}
        monospace
        tone="muted"
      />
      {user.updatedAt && (
        <DetailField
          label="Modifié le"
          value={formatDate(user.updatedAt)}
          monospace
          tone="muted"
        />
      )}
      {user.lastLoginAt && (
        <DetailField
          label="Dernière connexion"
          value={formatDate(user.lastLoginAt)}
          monospace
          tone="muted"
        />
      )}
    </DetailSection>
  </Box>
);

export default UserSystemInfoCard;
