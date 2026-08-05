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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
import { ChevronRight } from 'lucide-react';

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* La croix de fermeture est fournie par DialogContent : l'IconButton
          d'origine ferait doublon. */}
      <DialogContent className="max-w-[600px]">
        <DialogHeader className="pe-7">
          <DialogTitle className="leading-[1.3]">
            Choisir l'OTA a connecter
          </DialogTitle>
          <DialogDescription className="text-xs leading-[1.4]">
            « {propertyName} » sera distribue sur l'OTA selectionne via le hub
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {CHANNEX_OTA_OPTIONS.map((option) => (
            // La couleur de marque est une donnee d'execution : elle passe par une
            // custom property, seule facon d'alimenter un `hover:` en Tailwind.
            <button
              key={option.code}
              type="button"
              onClick={() => handlePick(option)}
              style={{ '--ota-brand': option.brandColor } as React.CSSProperties}
              className="flex items-center gap-2 w-full p-[7.5px] rounded-xl border border-solid border-border bg-card text-start cursor-pointer transition-all duration-[180ms] ease-out-quart hover:border-[var(--ota-brand)] hover:bg-[color-mix(in_srgb,var(--ota-brand)_3%,transparent)] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-[var(--ota-brand)] focus-visible:outline-offset-2"
            >
              <div className="size-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm tracking-[-0.02em]" style={{ backgroundColor: option.brandColor, color: option.brandColorFg }}>
                {option.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-[1.3] text-foreground">
                  {option.name}
                </p>
                <span className="text-xs text-muted-foreground block leading-[1.3]">
                  {option.description}
                </span>
              </div>
              <div className="text-muted-foreground opacity-60 shrink-0">
                <ChevronRight size={16} className="cn-rtl-flip" />
              </div>
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground block text-center leading-[1.5]">
          Vous serez redirige vers le widget de configuration OTA pour finaliser la
          connexion (login OTA + mapping des chambres).
        </span>
      </DialogContent>
    </Dialog>
  );
}
