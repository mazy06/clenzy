import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
} from '@mui/material';
import { Person, Email, CalendarToday } from '@mui/icons-material';
import type { UserDetailsData, RoleInfo, StatusInfo } from './userDetailsTypes';
import { getRoleInfo, getStatusInfo, formatDate } from './userDetailsTypes';

interface UserProfileCardProps {
  user: UserDetailsData;
  roles: RoleInfo[];
  statuses: StatusInfo[];
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, roles, statuses }) => {
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2 }}>
        {/* En-tete de l'utilisateur */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: '1.25rem' }}>
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ fontSize: '1rem' }}>
                {user.firstName} {user.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {user.email}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              icon={<Box sx={{ fontSize: 18 }}>{roleInfo.icon}</Box>}
              label={roleInfo.label}
              color={roleInfo.color}
              size="small"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
            <Chip
              label={statusInfo.label}
              color={statusInfo.color}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          </Box>
        </Box>

        {/* Metriques principales */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Person sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                {user.firstName} {user.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Nom complet
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Email sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                {user.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Adresse email
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <CalendarToday sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
              <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem' }}>
                {formatDate(user.createdAt)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Cree le
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default UserProfileCard;
