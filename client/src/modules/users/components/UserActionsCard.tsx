import React from 'react';
import { Box, Typography, Grid, Button } from '@mui/material';
import { Lock, LockOpen } from '../../../icons';
import type { LockoutStatus } from '../../../services/api';

interface UserActionsCardProps {
  lockoutStatus: LockoutStatus | null;
  isAdminOrManager: boolean;
  unlocking: boolean;
  onUnlockUser: () => void;
}

const UserActionsCard: React.FC<UserActionsCardProps> = ({
  lockoutStatus,
  isAdminOrManager,
  unlocking,
  onUnlockUser,
}) => {
  if (!isAdminOrManager || !lockoutStatus) return null;
  if (!lockoutStatus.isLocked && lockoutStatus.failedAttempts === 0) return null;

  return (
    <Grid item xs={12}>
      <Box sx={{
        border: '1px solid',
        borderColor: lockoutStatus.isLocked ? 'error.main' : 'warning.main',
        borderRadius: 1,
        p: 2,
        bgcolor: lockoutStatus.isLocked ? 'error.50' : 'warning.50',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: lockoutStatus.isLocked ? 'error.main' : 'warning.main' }}><Lock size={20} strokeWidth={1.75} /></Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {lockoutStatus.isLocked
                  ? 'Compte temporairement bloque'
                  : `${lockoutStatus.failedAttempts} tentative${lockoutStatus.failedAttempts > 1 ? 's' : ''} de connexion echouee${lockoutStatus.failedAttempts > 1 ? 's' : ''}`
                }
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lockoutStatus.isLocked
                  ? `Bloque pendant encore ${Math.ceil(lockoutStatus.remainingSeconds / 60)} minute${Math.ceil(lockoutStatus.remainingSeconds / 60) > 1 ? 's' : ''} (deblocage automatique)`
                  : lockoutStatus.captchaRequired
                    ? 'CAPTCHA requis a la prochaine connexion'
                    : 'Le verrouillage se declenche apres 5 tentatives'
                }
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<LockOpen size={16} strokeWidth={1.75} />}
            onClick={onUnlockUser}
            disabled={unlocking}
            color={lockoutStatus.isLocked ? 'error' : 'warning'}
            sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            {unlocking ? 'Deblocage...' : 'Debloquer'}
          </Button>
        </Box>
      </Box>
    </Grid>
  );
};

export default UserActionsCard;
