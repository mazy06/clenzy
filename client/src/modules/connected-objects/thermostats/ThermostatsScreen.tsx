import { useMemo } from 'react';
import { Box, Typography, Paper, Chip, alpha, useTheme } from '@mui/material';
import { Thermostat, Home } from '../../../icons';
import PageHeader from '../../../components/PageHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import ThermostatTile from './ThermostatTile';
import { MOCK_THERMOSTATS, type MockThermostat } from './mockThermostats';

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.25 } as const;
const ACCENT = '#6B8A9A';

/**
 * Écran d'APERÇU thermostats (Phase 2, UI-first). Thermostats simulés groupés par
 * logement avec le composant `ThermostatTile`. Valide l'UX avant de brancher un
 * provider climat (Netatmo / Tado / Ecobee / Tuya) et l'entité backend.
 */
export default function ThermostatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  const groups = useMemo(() => {
    const map = new Map<string, MockThermostat[]>();
    for (const th of MOCK_THERMOSTATS) {
      if (!map.has(th.propertyName)) map.set(th.propertyName, []);
      map.get(th.propertyName)!.push(th);
    }
    return [...map.entries()];
  }, []);

  return (
    <Box>
      <PageHeader
        title="Thermostats"
        subtitle="Confort thermique des logements — aperçu de l'expérience à venir."
        iconBadge={<Thermostat />}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
      />

      {/* Bandeau aperçu : données simulées */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.25, mb: 1.5, borderRadius: 1.5, borderStyle: 'dashed',
          borderColor: alpha(ACCENT, 0.4),
          bgcolor: alpha(ACCENT, theme.palette.mode === 'dark' ? 0.08 : 0.04),
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
        }}
      >
        <Chip size="small" label="Aperçu" sx={{ height: 22, bgcolor: ACCENT, color: '#fff', fontWeight: 700, fontSize: '0.65rem' }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 220 }}>
          Données simulées — le pilotage de consigne, les modes et les scénarios arriveront en <strong>Phase&nbsp;2</strong> via un provider climat (Netatmo, Tado, Ecobee, Tuya).
        </Typography>
      </Paper>

      {groups.map(([propertyName, items]) => (
        <Box key={propertyName} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.875 }}>
            <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }}>
              <Home size={15} strokeWidth={1.75} />
            </Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: 'text.primary' }}>{propertyName}</Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>· {items.length} thermostat{items.length > 1 ? 's' : ''}</Typography>
          </Box>
          <Box sx={GRID}>
            {items.map((th) => <ThermostatTile key={th.id} thermostat={th} />)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
