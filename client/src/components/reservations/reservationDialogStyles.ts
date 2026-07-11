import React from 'react';
import { Box } from '@mui/material';

// ─── Styles « Signature » partagés par ReservationDialog et ses sous-composants ──
// Tokens var(--…) de theme/signature/tokens.css. Aucune logique — présentation pure.

/** Pied d'actions du dialogue (barre boutons) — partagé wizard / édition / blocage. */
export const FOOT_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 22px',
  borderTop: '1px solid var(--line)',
  backgroundColor: 'var(--surface-2)',
  flexShrink: 0,
} as const;

/** Overline de section (.rm-sec) */
export const SEC_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--faint)',
} as const;

/** Champ flottant (.rm-field/.rm-input) — appliqué aux TextField outlined. */
export const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    minHeight: 44,
    borderRadius: '11px',
    backgroundColor: 'var(--field)',
    fontFamily: 'inherit',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--ink)',
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
    '&.MuiInputBase-adornedStart': { paddingLeft: '13px' },
    '&.Mui-disabled': { backgroundColor: 'var(--field)' },
  },
  '& .MuiOutlinedInput-input': { padding: '0 13px', height: 44, boxSizing: 'border-box' },
  '& .MuiInputBase-adornedStart .MuiOutlinedInput-input': { paddingLeft: '8px' },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'var(--body)' },
  '& .MuiInputLabel-root': {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
    '&.Mui-disabled': { color: 'var(--muted)' },
  },
} as const;

/** Variante textarea (.rm-textarea) */
export const TEXTAREA_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '11px',
    backgroundColor: 'var(--field)',
    padding: '11px 13px',
    fontFamily: 'inherit',
    fontSize: '13px',
    color: 'var(--body)',
    lineHeight: 1.5,
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
  },
  '& .MuiOutlinedInput-input': { padding: 0 },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiInputLabel-root': {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
  },
} as const;

/** Variante compacte du champ (formulaire voyageur dense) — hauteur 38, plus serré. */
export const COMPACT_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    minHeight: 38,
    borderRadius: '10px',
    backgroundColor: 'var(--field)',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--ink)',
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
    '&.Mui-disabled': { backgroundColor: 'var(--field)' },
  },
  '& .MuiOutlinedInput-input': { padding: '0 11px', height: 38, boxSizing: 'border-box' },
  // Select : forcer la MÊME hauteur 38 que les inputs texte (sinon .MuiSelect-select
  // garde son min-height/padding par défaut et rend plus haut).
  '& .MuiSelect-select.MuiOutlinedInput-input': {
    height: 38,
    minHeight: 'auto',
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: '30px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'var(--body)' },
  '& .MuiInputLabel-root': {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
    '&.Mui-disabled': { color: 'var(--muted)' },
  },
} as const;

/** Variante compacte du textarea (formulaire voyageur dense). */
export const COMPACT_TEXTAREA_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    backgroundColor: 'var(--field)',
    padding: '9px 11px',
    fontFamily: 'inherit',
    fontSize: '13px',
    color: 'var(--body)',
    lineHeight: 1.45,
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
    '&.Mui-disabled': { backgroundColor: 'var(--field)' },
  },
  '& .MuiOutlinedInput-input': { padding: 0 },
  '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'var(--body)' },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiInputLabel-root': {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
    '&.Mui-disabled': { color: 'var(--muted)' },
  },
} as const;

/** Bouton .s-btn (base) */
const BTN_BASE_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  height: 38,
  padding: '0 17px',
  borderRadius: '11px',
  fontFamily: 'inherit',
  fontSize: '12.5px',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'transform .12s, background .14s, border-color .14s, color .14s',
  '&:active:not(:disabled)': { transform: 'scale(.97)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

/** .s-btn--ghost */
export const BTN_GHOST_SX = {
  ...BTN_BASE_SX,
  background: 'none',
  color: 'var(--muted)',
  '&:hover': { color: 'var(--ink)' },
} as const;

/** .s-btn--p (contour accent) */
export const BTN_PRIMARY_SX = {
  ...BTN_BASE_SX,
  background: 'transparent',
  borderColor: 'var(--accent)',
  color: 'var(--accent)',
  '&:hover:not(:disabled)': { backgroundColor: 'var(--accent-soft)' },
  '&:disabled': { opacity: 0.45, cursor: 'not-allowed' },
} as const;

/** Lien accent (.rm-link) */
export const LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12.5px',
  fontWeight: 600,
  color: 'var(--accent)',
  cursor: 'pointer',
  background: 'none',
  border: 0,
  padding: 0,
  fontFamily: 'inherit',
  alignSelf: 'flex-start',
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
} as const;

/** Segmented (.rm-status / .rm-tariftabs) — conteneur */
export const SEG_WRAP_SX = {
  display: 'inline-flex',
  backgroundColor: 'var(--field)',
  border: '1px solid var(--field-line)',
  borderRadius: '10px',
  padding: '3px',
  gap: '2px',
} as const;

/** Segmented — bouton */
export const segBtnSx = (on: boolean) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  border: 0,
  background: on ? 'var(--card)' : 'none',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  color: on ? 'var(--accent)' : 'var(--muted)',
  padding: '6px 12px',
  borderRadius: '7px',
  cursor: 'pointer',
  boxShadow: on ? '0 1px 3px rgba(21,36,45,.12)' : 'none',
  transition: 'background .14s, color .14s',
  whiteSpace: 'nowrap' as const,
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
});

/** Toggle ménage (.rm-toggle) — Switch MUI redimensionné 42×24, pouce 20. */
export const SWITCH_SX = {
  width: 42,
  height: 24,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: '2px',
    '&.Mui-checked': {
      transform: 'translateX(18px)',
      '& + .MuiSwitch-track': { backgroundColor: 'var(--accent)', opacity: 1 },
    },
  },
  '& .MuiSwitch-thumb': { width: 20, height: 20, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' },
  '& .MuiSwitch-track': { borderRadius: 99, backgroundColor: 'var(--line-2)', opacity: 1, transition: 'background-color .18s' },
} as const;

/** Bouton stepper compteur (.rm-count) */
export const STEP_BTN_SX = {
  width: 30,
  height: 30,
  borderRadius: '8px',
  border: 0,
  backgroundColor: 'var(--card)',
  color: 'var(--body)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'color .14s',
  '&:hover:not(:disabled)': { color: 'var(--accent)' },
  '&:disabled': { opacity: 0.4, cursor: 'default' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
} as const;

/** Icône d'adornment (.rm-ic) */
export const AdornIcon: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  React.createElement(Box, { component: 'span', sx: { display: 'inline-flex', color: 'var(--faint)' } }, children);
