/**
 * Channex OTA Picker Dialog
 *
 * Petit dialog Baitly-native qui presente les OTAs supportes par Channex
 * sous forme de cards visuelles avec couleurs brand. Permet a l'utilisateur
 * de choisir un OTA AVANT d'ouvrir le widget iframe Channex, qui sera alors
 * pre-filtre sur l'OTA selectionne (param available_channels=<code>).
 *
 * Pourquoi cette etape intermediaire :
 *   - Channex ne permet pas a un compte standard de creer un channel
 *     programmatiquement (API reservee aux comptes whitelabel)
 *   - Le wizard iframe Channex affiche par defaut les 500+ channels supportes
 *   - Pre-filtrer ameliore drastiquement l'UX : 1 seul OTA visible dans la liste
 *   - L'utilisateur reste guide cote Baitly avant de basculer dans Channex
 */
import React from 'react';
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, ButtonBase } from '@mui/material';
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
        <div className="min-w-0 flex-1">
          <h6 className="cn-text-subtitle1 font-semibold leading-[1.3]">
            Choisir l'OTA a connecter
          </h6>
          <span className="cn-text-caption text-muted-foreground block leading-[1.4] mt-0.5">
            « {propertyName} » sera distribue sur l'OTA selectionne via le hub
          </span>
        </div>
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
              <div className="w-[40px] h-[40px] rounded-[8px] flex items-center justify-center shrink-0 font-bold text-[0.95rem] tracking-[-0.02em]" style={{ backgroundColor: option.brandColor, color: option.brandColorFg }}>
                {option.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="cn-text-body2 font-semibold leading-[1.3]">
                  {option.name}
                </p>
                <span className="cn-text-caption text-muted-foreground block leading-[1.3]">
                  {option.description}
                </span>
              </div>
              <div className="text-muted-foreground opacity-60 shrink-0">
                <ChevronRight size={16} />
              </div>
            </ButtonBase>
          ))}
        </Stack>

        <span className="cn-text-caption text-muted-foreground block mt-3 text-center leading-[1.5]">
          Vous serez redirige vers le widget de configuration OTA pour finaliser la
          connexion (login OTA + mapping des chambres).
        </span>
      </DialogContent>
    </Dialog>
  );
}
