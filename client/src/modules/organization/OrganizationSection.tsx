import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import {
  Business,
  PersonAdd,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import SendInvitationDialog from './SendInvitationDialog';
import InvitationsList from './InvitationsList';

interface Props {
  organizationId: number;
  organizationName?: string;
}

export default function OrganizationSection({ organizationId, organizationName }: Props) {
  const { hasAnyRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const canManageInvitations = hasAnyRole(['ADMIN', 'MANAGER']);

  if (!canManageInvitations) {
    return null;
  }

  return (
    <>
      <Paper sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
              Organisation{organizationName ? ` — ${organizationName}` : ''}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<PersonAdd />}
            onClick={() => setDialogOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Inviter
          </Button>
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Invitations envoyees
        </Typography>

        <InvitationsList
          organizationId={organizationId}
          refreshTrigger={refreshTrigger}
        />
      </Paper>

      <SendInvitationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        organizationId={organizationId}
        onInvitationSent={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </>
  );
}
