/**
 * Channex OTA Picker Dialog
 *
 * Petit dialog Baitly-native qui presente les OTAs supportes par Channex
 * sous forme de cards visuelles avec couleurs brand. Permet a l'utilisateur
 * de choisir un OTA AVANT d'ouvrir le widget iframe Channex, qui sera alors
 * pre-filtre sur l'OTA selectionne (param available_channels=<code>).
 *
 * Pourquoi cette etape intermediaire :
 *   - Le wizard iframe Channex affiche par defaut les 500+ channels supportes
 *   - Pre-filtrer ameliore drastiquement l'UX : 1 seul OTA visible dans la liste
 *   - L'utilisateur reste guide cote Baitly avant de basculer dans Channex
 *
 * Second ecran (facultatif) : quand l'OTA choisi expose un `createSetting`, on
 * demande ce reglage ici pour que le parent puisse PRE-CREER le channel par API,
 * deja rattache a la bonne propriete. Sans ce pre-remplissage, l'utilisateur
 * cree le channel dans le wizard et doit y choisir la propriete lui-meme — un
 * oubli frequent qui produit un channel rattache a rien : l'ecran de mapping
 * n'affiche alors « No data » et le channel ne peut pas etre active.
 */
import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '../../../components/ui';
import { ArrowLeft, ChevronRight } from 'lucide-react';

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
  /**
   * Callback declenche au choix d'un OTA — passe le code Channex (ABB/BDC/...)
   * et, si l'OTA en exige un, les reglages de creation saisis (`{hotel_id}`).
   */
  onPick: (code: ChannexOtaCode, settings?: Record<string, string>) => void;
}

export default function ChannexOtaPickerDialog({
  open,
  onClose,
  propertyName,
  onPick,
}: ChannexOtaPickerDialogProps) {
  // OTA en attente de son reglage de creation. null = on est sur la liste.
  const [pendingOption, setPendingOption] = useState<ChannexOtaOption | null>(null);
  const [settingValue, setSettingValue] = useState('');

  // Rouvrir le dialog doit repartir de la liste, pas du formulaire precedent.
  useEffect(() => {
    if (!open) {
      setPendingOption(null);
      setSettingValue('');
    }
  }, [open]);

  const handlePick = (option: ChannexOtaOption) => {
    if (option.createSetting) {
      setPendingOption(option);
      setSettingValue('');
      return;
    }
    onPick(option.code);
    // On ne ferme pas ici : le parent ferme + ouvre le ChannexEmbedDialog
  };

  const handleConfirmSetting = () => {
    if (!pendingOption?.createSetting) return;
    const value = settingValue.trim();
    onPick(
      pendingOption.code,
      value ? { [pendingOption.createSetting.key]: value } : undefined,
    );
  };

  if (pendingOption?.createSetting) {
    const setting = pendingOption.createSetting;
    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader className="pe-7">
            <DialogTitle className="leading-[1.3]">
              Connecter {pendingOption.name}
            </DialogTitle>
            <DialogDescription className="text-xs leading-[1.4]">
              « {propertyName} » — le canal sera créé et rattaché à ce logement
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ota-create-setting" className="text-xs">
              {setting.label}
            </Label>
            <Input
              id="ota-create-setting"
              value={settingValue}
              placeholder={setting.placeholder}
              onChange={(e) => setSettingValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSetting(); }}
              autoFocus
            />
            <span className="text-xs text-muted-foreground leading-[1.5]">
              {setting.help}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingOption(null)}
              className="gap-1"
            >
              <ArrowLeft size={14} className="cn-rtl-flip" />
              Retour
            </Button>
            <div className="flex items-center gap-2">
              {/* Sans identifiant on ouvre quand meme le wizard : c'est le
                  comportement d'avant, pas une impasse. */}
              <Button variant="ghost" size="sm" onClick={() => onPick(pendingOption.code)}>
                Je ne l'ai pas
              </Button>
              <Button size="sm" onClick={handleConfirmSetting} disabled={!settingValue.trim()}>
                Continuer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
