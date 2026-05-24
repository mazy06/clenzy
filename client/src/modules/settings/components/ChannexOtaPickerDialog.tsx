/**
 * Channex OTA Picker Dialog
 *
 * Petit dialog Clenzy-native qui presente les OTAs supportes par Channex
 * sous forme de cards visuelles avec couleurs brand. Permet a l'utilisateur
 * de choisir un OTA AVANT d'ouvrir le widget iframe Channex, qui sera alors
 * pre-filtre sur l'OTA selectionne (param available_channels=<code>).
 *
 * Pourquoi cette etape intermediaire :
 *   - Channex ne permet pas a un compte standard de creer un channel
 *     programmatiquement (API reservee aux comptes whitelabel)
 *   - Le wizard iframe Channex affiche par defaut les 500+ channels supportes
 *   - Pre-filtrer ameliore drastiquement l'UX : 1 seul OTA visible dans la liste
 *   - L'utilisateur reste guide cote Clenzy avant de basculer dans Channex
 */
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  Stack,
  ButtonBase,
} from '@mui/material';
import { X, ChevronRight } from 'lucide-react';

import {
  CHANNEX_OTA_OPTIONS,
  type ChannexOtaCode,
  type ChannexOtaOption,
} from '../../../services/api/channexApi';

interface ChannexOtaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Nom de la property a afficher dans le header (contexte). */
  propertyName: string;
  /** Callback declenche au choix d'un OTA — passe le code Channex (ABB/BDC/...). */
  onPick: (code: ChannexOtaCode) => void;
}

export default function ChannexOtaPickerDialog({
  open,
  onClose,
  propertyName,
  onPick,
}: ChannexOtaPickerDialogProps) {
  const handlePick = (option: ChannexOtaOption) => {
    onPick(option.code);
    // On ne ferme pas ici : le parent ferme + ouvre le ChannexEmbedDialog
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          pb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
            Choisir l'OTA a connecter
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.4, mt: 0.25 }}
          >
            « {propertyName} » sera distribue sur l'OTA selectionne via le hub
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Fermer">
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2 }}>
        <Stack spacing={1}>
          {CHANNEX_OTA_OPTIONS.map((option) => (
            <ButtonBase
              key={option.code}
              onClick={() => handlePick(option)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
                p: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                  borderColor: option.brandColor,
                  bgcolor: `${option.brandColor}08`,
                  transform: 'translateX(2px)',
                },
                '&:focus-visible': {
                  outline: `2px solid ${option.brandColor}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  bgcolor: option.brandColor,
                  color: option.brandColorFg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {option.initials}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                  {option.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.3 }}
                >
                  {option.description}
                </Typography>
              </Box>
              <Box sx={{ color: 'text.disabled', flexShrink: 0 }}>
                <ChevronRight size={16} />
              </Box>
            </ButtonBase>
          ))}
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 2, textAlign: 'center', lineHeight: 1.5 }}
        >
          Vous serez redirige vers le widget de configuration OTA pour finaliser la
          connexion (login OTA + mapping des chambres).
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
