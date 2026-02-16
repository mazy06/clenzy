import React from 'react';
import { Box } from '@mui/material';

/* ────────────────────────────────────────────────────────────────
 * LiveDashboardPulse
 * Bandeau animé « blueprint tech » pour les cards d'intervention.
 *
 * Effets visuels :
 *  1. Grille de lignes fines (blueprint / circuit board)
 *  2. Points lumineux aux intersections de la grille
 *  3. Pulse principal — orbe lumineuse qui traverse en diagonale
 *  4. Scan line horizontale subtile
 *  5. Lueur ambiante pulsante en arrière-plan
 *
 * Adapte couleur & vitesse à la priorité, désactivé pour
 * les statuts terminaux (COMPLETED / CANCELLED).
 * ──────────────────────────────────────────────────────────────── */

interface LiveDashboardPulseProps {
  type: string;
  priority: string;
  status: string;
  height?: number;
  children: React.ReactNode;
}

// ─── Couleurs par catégorie de type ──────────────────────────────
const getTypeColors = (type: string): { gradient: string; accent: string } => {
  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];
  const maintenanceTypes = ['PREVENTIVE_MAINTENANCE', 'RESTORATION'];
  const outdoorTypes = ['GARDENING', 'PEST_CONTROL'];

  if (cleaningTypes.includes(type))
    return { gradient: 'linear-gradient(135deg, #1a3a5c 0%, #234b73 50%, #1e3d63 100%)', accent: '#5B9BD5' };
  if (repairTypes.includes(type))
    return { gradient: 'linear-gradient(135deg, #3d1a1a 0%, #5c2626 50%, #4a1f1f 100%)', accent: '#E06060' };
  if (maintenanceTypes.includes(type))
    return { gradient: 'linear-gradient(135deg, #3d2e10 0%, #5c4520 50%, #4a3818 100%)', accent: '#E8A838' };
  if (outdoorTypes.includes(type))
    return { gradient: 'linear-gradient(135deg, #1a3d35 0%, #265c4f 50%, #1f4a40 100%)', accent: '#4ECDC4' };
  return { gradient: 'linear-gradient(135deg, #1e2a35 0%, #2a3a4a 50%, #243242 100%)', accent: '#6B8A9A' };
};

// ─── Config du pulse selon priorité ──────────────────────────────
const getPulseConfig = (priority: string) => {
  switch (priority) {
    case 'CRITICAL': return { speed: 2, scanSpeed: 1.5, color: '#FF4444', glowIntensity: 0.4 };
    case 'URGENT':   return { speed: 2.5, scanSpeed: 2, color: '#FF6B35', glowIntensity: 0.35 };
    case 'HIGH':     return { speed: 3, scanSpeed: 2.5, color: '#F0A030', glowIntensity: 0.3 };
    case 'NORMAL':   return { speed: 5, scanSpeed: 4, color: '#7BA3C2', glowIntensity: 0.2 };
    case 'LOW':
    default:         return { speed: 7, scanSpeed: 5, color: '#4ECDC4', glowIntensity: 0.15 };
  }
};

const GRID_SIZE = 24;

const LiveDashboardPulse: React.FC<LiveDashboardPulseProps> = ({
  type,
  priority,
  status,
  height = 110,
  children,
}) => {
  const isCompleted = status === 'COMPLETED';
  const isCancelled = status === 'CANCELLED';
  const isActive = !isCompleted && !isCancelled;
  const { gradient, accent } = getTypeColors(type);
  const { speed, scanSpeed, color: pulseColor, glowIntensity } = getPulseConfig(priority);

  // ─── Background final ──────────────────────────────────────
  const getBackground = () => {
    if (isCompleted) return 'linear-gradient(135deg, #1a3d35 0%, #234a40 50%, #2d5c50 100%)';
    if (isCancelled) return 'linear-gradient(135deg, #2a2a2e 0%, #3a3a40 50%, #2e2e34 100%)';
    return gradient;
  };

  const gridColor = isActive ? accent : isCompleted ? '#4ECDC4' : '#666';
  const gridLineOpacity = isActive ? 0.12 : 0.06;
  const gridDotOpacity = isActive ? 0.3 : 0.1;

  return (
    <Box
      sx={{
        position: 'relative',
        height,
        overflow: 'hidden',
        background: getBackground(),
        ...(isCancelled ? { filter: 'grayscale(0.5)' } : {}),
      }}
    >
      {/* ─── Layer 1 : Dots ─── */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${gridColor} 1.5px, transparent 1.5px)`,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          opacity: gridDotOpacity,
        }}
      />

      {/* ─── Layer 3 : Lueur ambiante pulsante ─── */}
      {isActive && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 30% 50%, ${pulseColor}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
            animation: `ambientGlow ${speed * 1.5}s ease-in-out infinite alternate`,
            '@keyframes ambientGlow': {
              '0%': { opacity: 0.4 },
              '100%': { opacity: 1 },
            },
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              opacity: 0.7,
            },
          }}
        />
      )}

      {/* ─── Layer 4 : Pulse principal (orbe lumineuse) ─── */}
      {isActive && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${pulseColor}90 0%, ${pulseColor}40 30%, transparent 70%)`,
              filter: 'blur(12px)',
              animation: `pulseTravel ${speed}s ease-in-out infinite`,
              willChange: 'transform',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}70 0%, ${accent}25 35%, transparent 70%)`,
              filter: 'blur(10px)',
              animation: `pulseTravel2 ${speed * 1.3}s ease-in-out infinite`,
              animationDelay: `${speed * 0.5}s`,
              willChange: 'transform',
            },
            '@keyframes pulseTravel': {
              '0%': {
                transform: 'translate(-40px, 90px)',
                opacity: 0,
              },
              '8%': { opacity: 1 },
              '50%': {
                transform: `translate(calc(50% - 40px), 15px)`,
                opacity: 1,
              },
              '92%': { opacity: 1 },
              '100%': {
                transform: 'translate(calc(100% + 40px), -20px)',
                opacity: 0,
              },
            },
            '@keyframes pulseTravel2': {
              '0%': {
                transform: 'translate(calc(100% + 25px), 90px)',
                opacity: 0,
              },
              '8%': { opacity: 0.8 },
              '50%': {
                transform: 'translate(calc(50% - 25px), 55px)',
                opacity: 0.8,
              },
              '92%': { opacity: 0.8 },
              '100%': {
                transform: 'translate(-25px, -10px)',
                opacity: 0,
              },
            },
            '@media (prefers-reduced-motion: reduce)': {
              '&::before, &::after': { animation: 'none' },
            },
          }}
        />
      )}

      {/* ─── Layer 5 : Scan line horizontale ─── */}
      {isActive && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              width: '100%',
              height: '2px',
              background: `linear-gradient(90deg, transparent 0%, ${pulseColor}50 20%, ${pulseColor}90 50%, ${pulseColor}50 80%, transparent 100%)`,
              animation: `scanLine ${scanSpeed}s linear infinite`,
              willChange: 'transform',
            },
            '@keyframes scanLine': {
              '0%': { transform: `translateY(-2px)` },
              '100%': { transform: `translateY(${height}px)` },
            },
            '@media (prefers-reduced-motion: reduce)': {
              '&::before': { animation: 'none', display: 'none' },
            },
          }}
        />
      )}

      {/* ─── Layer 6 : Vignette subtile (bords sombres) ─── */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ─── Contenu superposé ─── */}
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default LiveDashboardPulse;
