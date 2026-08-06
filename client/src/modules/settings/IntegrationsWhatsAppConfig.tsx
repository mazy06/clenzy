import React, { useState } from 'react';
import { Spinner, Button } from '../../components/ui';
import { Card } from '../../components/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Settings2 } from 'lucide-react';
import { Link as LinkIcon, LinkOff as LinkOffIcon } from '../../icons';
import ServiceGridCard from './components/ServiceGridCard';
import IntegrationConfigDialog from './components/IntegrationConfigDialog';
import WhatsAppProviderConfigSection from './WhatsAppProviderConfigSection';
import { whatsAppConfigApi } from '../../services/api/whatsAppConfigApi';
import { getServicesByCategory } from '../../services/integrations/servicesCatalog';

/** Le service catalogue WhatsApp (source de vérité visuelle : nom, couleur, desc). */
const WHATSAPP_SERVICE = getServicesByCategory('messaging').find(
  (s) => s.id === 'whatsapp_business',
);

/**
 * Section « Messagerie » de l'onglet Intégrations.
 *
 * <p>Card alignée sur le design des cartes « Objets connectés (IoT) »
 * ({@link OAuthProviderCard}) : pas de chevron, pas de chip « Configurable », mais
 * une <b>icône de configuration</b> (couleur warm tant que non configuré, neutre une
 * fois configuré) + une <b>icône de connexion</b> (lien vert pour connecter / lien
 * barré pour déconnecter) + le chip de statut Connecté / Non connecté.</p>
 *
 * <p>Au clic config/connexion, ouvre {@link IntegrationConfigDialog} contenant la
 * configuration du <b>compte WhatsApp Baitly GLOBAL</b> (singleton plateforme).</p>
 */
export default function IntegrationsWhatsAppConfig() {
  const [open, setOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['whatsapp', 'config'],
    queryFn: () => whatsAppConfigApi.getConfig(),
    staleTime: 60_000,
    retry: false,
  });

  const disconnect = useMutation({
    mutationFn: () => whatsAppConfigApi.updateConfig({ enabled: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
      setDisconnectOpen(false);
    },
  });

  if (!WHATSAPP_SERVICE) return null;
  const service = WHATSAPP_SERVICE;

  // Configuré = identifiants Meta saisis (token + phone number id). Connecté = configuré ET actif.
  const configured = !!(config?.hasApiToken && config?.phoneNumberId);
  const connected = configured && !!config?.enabled;

  const closeConfig = () => {
    setOpen(false);
    // La config a pu changer dans le dialog → rafraîchit l'état de la card.
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'config'] });
  };

  // Icône config : warm tant que non configuré, neutre une fois configuré (même règle que Tuya/Netatmo).
  const configAction = (
    <Tooltip>
      {/* Le trigger enveloppe le bouton dans un span : les primitives du kit sont
          des fonctions et ne transmettent pas la ref dont Radix a besoin. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            aria-label="Configurer WhatsApp"
            className={configured ? 'text-muted-foreground' : 'text-warning'}
          >
            <Settings2 size={16} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {configured ? 'Configuration WhatsApp · Modifier' : 'Configurer le compte WhatsApp'}
      </TooltipContent>
    </Tooltip>
  );

  // Icône connexion : lien vert pour connecter/activer, lien barré (rouge au hover) pour déconnecter.
  const connectionAction = connected ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDisconnectOpen(true)}
            disabled={disconnect.isPending}
            aria-label="Déconnecter WhatsApp"
            className="text-muted-foreground hover:text-destructive-ink hover:bg-destructive-soft"
          >
            <LinkOffIcon size={16} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Déconnecter (désactiver l'envoi WhatsApp)</TooltipContent>
    </Tooltip>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(true)}
            aria-label="Connecter WhatsApp"
            className="text-success-ink hover:bg-success-soft"
          >
            <LinkIcon size={16} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {configured ? "Activer l'envoi WhatsApp" : 'Connecter le compte WhatsApp'}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {/* Section + card : design identique aux cartes IoT (Objets connectés). */}
      <Card className="gap-0 py-0 border-border mt-4 mb-3 px-3 py-2.5">
        <p className="text-sm font-semibold tracking-tight mb-0.5">
          Messagerie
        </p>
        <p className="text-xs text-muted-foreground mb-0.5">
          Envoyez vos messages WhatsApp via l'API native du provider, sans intermédiaire.
          Compte WhatsApp unique pour toute la plateforme.
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-[9px] mt-1.5">
          <ServiceGridCard
            serviceTooltipId={service.id}
            tooltipData={{
              description: service.tooltipDescription,
              accessModality: service.accessModality,
              websiteUrl: service.websiteUrl,
              region: service.region,
              name: service.name,
            }}
            label={service.name}
            description={service.shortDescription}
            status={connected ? 'connected' : 'idle'}
            onClick={() => setOpen(true)}
            logo={
              <div className="w-[40px] h-[40px] rounded-[8px] inline-flex items-center justify-center shrink-0 text-[0.85rem] font-bold tracking-[-0.02em]" style={{ backgroundColor: service.brandColor, color: service.brandTextColor }} aria-hidden="true">
                WA
              </div>
            }
            actions={
              <>
                {configAction}
                {connectionAction}
              </>
            }
          />
        </div>
      </Card>

      {/* Dialog de config du compte WhatsApp global — coque modale standard. */}
      <IntegrationConfigDialog open={open} onClose={closeConfig} maxWidth="lg">
        <Card className="gap-0 py-0 overflow-hidden">
          {/* Header — uniforme avec les autres modales d'intégration. */}
          <div className="px-3 py-2.5 flex items-center gap-2 border-b border-border">
            <div className="size-10 rounded-lg inline-flex items-center justify-center shrink-0 text-sm font-bold tracking-[-0.02em]" style={{ backgroundColor: service.brandColor, color: service.brandTextColor }} aria-hidden="true">
              WA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold tracking-tight text-balance">
                {service.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {service.shortDescription}
              </p>
            </div>
          </div>

          {/* Body — configuration du compte global (pas de sélecteur d'org). */}
          <div className="p-3">
            <WhatsAppProviderConfigSection />
          </div>
        </Card>
      </IntegrationConfigDialog>

      {/* Confirmation de déconnexion (désactivation de l'envoi). */}
      <Dialog open={disconnectOpen} onOpenChange={(next) => { if (!next) setDisconnectOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-semibold">Déconnecter WhatsApp ?</DialogTitle>
            <DialogDescription>
              L'envoi de messages WhatsApp sera désactivé pour toute la plateforme. Les identifiants
              restent enregistrés : vous pourrez réactiver à tout moment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDisconnectOpen(false)} variant="ghost" disabled={disconnect.isPending}>
              Annuler
            </Button>
            <Button
              onClick={() => disconnect.mutate()}
              variant="destructive"
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? <Spinner className="size-3.5" /> : 'Déconnecter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
