import React from 'react';
import { Typography, Grid } from '@mui/material';
import type { UserDetailsData } from './userDetailsTypes';
import { formatDate } from './userDetailsTypes';

interface UserSystemInfoCardProps {
  user: UserDetailsData;
}

const UserSystemInfoCard: React.FC<UserSystemInfoCardProps> = ({ user }) => (
  <>
    {/* Informations personnelles */}
    <Grid item xs={12}>
      <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
        Informations personnelles
      </Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" color="text.secondary">Prenom</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>{user.firstName}</Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" color="text.secondary">Nom</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>{user.lastName}</Typography>
    </Grid>

    {/* Informations de contact */}
    <Grid item xs={12}>
      <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
        Informations de contact
      </Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" color="text.secondary">Email</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>{user.email}</Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" color="text.secondary">Telephone</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        {user.phoneNumber || 'Non renseigne'}
      </Typography>
    </Grid>

    {/* Metadonnees */}
    <Grid item xs={12}>
      <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
        Informations systeme
      </Typography>
    </Grid>
    <Grid item xs={12} md={6}>
      <Typography variant="subtitle2" color="text.secondary">Cree le</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>{formatDate(user.createdAt)}</Typography>
    </Grid>
    {user.updatedAt && (
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" color="text.secondary">Modifie le</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>{formatDate(user.updatedAt)}</Typography>
      </Grid>
    )}
    {user.lastLoginAt && (
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" color="text.secondary">Derniere connexion</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>{formatDate(user.lastLoginAt)}</Typography>
      </Grid>
    )}
  </>
);

export default UserSystemInfoCard;
