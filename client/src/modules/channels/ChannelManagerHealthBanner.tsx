import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { CheckCircle as CheckIcon, Warning as WarningIcon } from '../../icons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { channexApi } from '../../services/api/channexApi';

/**
 * Bandeau de sante du channel manager — le dessin de la projection
 * (BIntegrationsSectionDemo), alimente par le VRAI health-summary Channex
 * (mappings par statut + elements d'attention + horodatage du calcul).
 *
 * Silencieux quand il n'a rien a dire : organisation sans mapping Channex,
 * endpoint inaccessible (role sans le droit), ou chargement. Un bandeau de
 * sante qui affiche un squelette ou une erreur ferait plus de bruit que la
 * sante elle-meme.
 */
export default function ChannelManagerHealthBanner() {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canOpenSyncJournal = user?.permissions?.includes('users:manage') ?? false;

  const { data } = useQuery({
    queryKey: ['channex-health-summary'],
    queryFn: () => channexApi.healthSummary(),
    staleTime: 60_000,
    retry: false,
  });

  if (!data || data.totalMappings === 0) return null;

  const erreurs = data.countsByStatus.ERROR ?? 0;
  const actifs = data.countsByStatus.ACTIVE ?? 0;
  const enErreur = erreurs > 0;
  const heure = new Date(data.computedAt).toLocaleTimeString(
    currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'en' ? 'en-US' : 'fr-FR',
    { hour: '2-digit', minute: '2-digit' },
  );

  return (
    <div
      className={cn(
        'mb-3 flex items-center gap-3 rounded-xl border border-solid p-3',
        enErreur ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success-soft/40',
      )}
    >
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
          enErreur ? 'bg-destructive/10 text-destructive' : 'bg-success-soft text-success',
        )}
      >
        {enErreur ? <WarningIcon size={16} strokeWidth={1.75} /> : <CheckIcon size={16} strokeWidth={1.75} />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold text-foreground">
          {enErreur
            ? t('channels.health.errors', { count: erreurs, defaultValue: '{{count}} logements en erreur de synchronisation' })
            : t('channels.health.ok', 'Channel manager opérationnel')}
        </div>
        <div className="text-xs text-muted-foreground">
          {t('channels.health.detail', {
            active: actifs,
            total: data.totalMappings,
            time: heure,
            defaultValue: '{{active}}/{{total}} mappings actifs · calculé à {{time}}',
          })}
          {enErreur && data.attentionItems[0]
            ? ` · ${data.attentionItems[0].propertyName}`
            : ''}
        </div>
      </div>
      {canOpenSyncJournal && (
        <Button size="xs" variant="ghost" onClick={() => navigate('/admin/sync')}>
          {t('channels.health.journal', 'Journal de sync')}
        </Button>
      )}
    </div>
  );
}
