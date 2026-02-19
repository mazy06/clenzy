import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Add,
  Delete,
  Handshake,
  Memory,
  Home,
  MeetingRoom,
} from '@mui/icons-material';
import type { NoiseDevice } from '../../hooks/useNoiseDevices';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Component ──────────────────────────────────────────────────────────────

interface NoiseDeviceListProps {
  devices: NoiseDevice[];
  onRemoveDevice: (id: string) => void;
  onAddDevice: () => void;
}

const NoiseDeviceList: React.FC<NoiseDeviceListProps> = ({ devices, onRemoveDevice, onAddDevice }) => {
  const { t } = useTranslation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onRemoveDevice(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.9rem' }}>
            {t('dashboard.noise.myDevices') || 'Mes capteurs'}
          </Typography>
          <Chip
            label={devices.length}
            size="small"
            color="primary"
            sx={{ fontSize: '0.6875rem', height: 20, minWidth: 20 }}
          />
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<Add sx={{ fontSize: 16 }} />}
          onClick={onAddDevice}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderWidth: 1.5,
            px: 1.5,
            py: 0.5,
          }}
        >
          {t('dashboard.noise.addDevice') || 'Ajouter un capteur'}
        </Button>
      </Box>

      {/* Device cards */}
      <Grid container spacing={1.5}>
        {devices.map((device) => {
          const isMinut = device.type === 'minut';
          const isConfirming = confirmDeleteId === device.id;

          return (
            <Grid item xs={12} sm={6} md={4} key={device.id}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  border: '1.5px solid',
                  borderColor: 'divider',
                  transition: 'border-color 0.15s',
                  '&:hover': { borderColor: 'primary.light' },
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                      {isMinut ? (
                        <Handshake sx={{ color: '#6B8A9A', fontSize: 20, flexShrink: 0 }} />
                      ) : (
                        <Memory sx={{ color: '#4A9B8E', fontSize: 20, flexShrink: 0 }} />
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {device.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Home sx={{ fontSize: 12, color: 'text.disabled' }} />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.6875rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {device.propertyName}
                          </Typography>
                        </Box>
                        {device.roomName && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <MeetingRoom sx={{ fontSize: 12, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                              {device.roomName}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip
                        label={t('dashboard.noise.deviceActive') || 'Actif'}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.5625rem', height: 18, '& .MuiChip-label': { px: 0.5 } }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(device.id)}
                        sx={{
                          color: isConfirming ? 'error.main' : 'text.disabled',
                          '&:hover': { color: 'error.main' },
                        }}
                      >
                        <Delete sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Confirm delete */}
                  <Collapse in={isConfirming}>
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        bgcolor: 'error.main',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'white', fontSize: '0.6875rem' }}>
                        {t('dashboard.noise.removeDeviceConfirm') || 'Confirmer la suppression ?'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button
                          size="small"
                          onClick={() => setConfirmDeleteId(null)}
                          sx={{ color: 'white', fontSize: '0.625rem', minWidth: 0, textTransform: 'none', py: 0 }}
                        >
                          Non
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleDelete(device.id)}
                          sx={{ color: 'white', fontWeight: 700, fontSize: '0.625rem', minWidth: 0, textTransform: 'none', py: 0 }}
                        >
                          Oui
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default NoiseDeviceList;
