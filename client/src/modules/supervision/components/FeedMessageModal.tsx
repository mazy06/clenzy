/* ============================================================
   <FeedMessageModal> — aperçu du contenu d'un message envoyé

   Ouvert depuis une ligne du journal « En direct » qui porte un `messageLogId`
   (envois de message guest, ex. « Message de check-out »). Récupère le rendu du
   message via GET /api/guest-messaging/preview/{logId} et l'affiche dans une
   iframe SANDBOXÉE (aucun script, HTML isolé) — même approche sûre que
   l'historique des messages (UnifiedHistoryTab), jamais d'injection HTML directe.
   ============================================================ */

import { useEffect, useState } from 'react';
import {
  Button,
  Spinner,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui';
import { useThemeMode } from '../../../hooks/useThemeMode';
import { useTranslation } from '../../../hooks/useTranslation';
import { guestMessagingApi } from '../../../services/api/guestMessagingApi';
import { renderServerEmailPreview } from '../../../utils/emailMarkdown';

interface FeedMessageModalProps {
  /** Id du message à prévisualiser (ouvre la modale quand non-null). */
  logId: number | null;
  onClose: () => void;
}

export function FeedMessageModal({ logId, onClose }: FeedMessageModalProps) {
  const { t } = useTranslation();
  const { isDark } = useThemeMode();
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState<string>('');
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (logId == null) {
      setSubject('');
      setHtml(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSubject('');
    setHtml(null);
    guestMessagingApi
      .previewMessage(logId)
      .then((res) => {
        if (cancelled) return;
        setSubject(res.subject ?? '');
        setHtml(res.htmlBody ?? null);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logId]);

  // L'iframe est un document ISOLÉ : il n'hérite ni de la feuille Baitly UI ni
  // des variables --bui-*. Les teintes sont donc recopiées en dur, mais prises
  // sur la palette (foreground / card / info-ink) — jamais de blanc ni de noir purs.
  const srcDoc = html
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:${
        isDark ? '#D7E1EE' : '#1B2A35'
      };background:${isDark ? '#111B31' : '#FBFCFD'};padding:16px;margin:0;word-wrap:break-word;}a{color:${
        isDark ? '#5B8DF6' : '#1D4ED8'
      };}</style></head><body>${renderServerEmailPreview(html)}</body></html>`
    : '';

  return (
    <Dialog open={logId != null} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Pas de DialogDescription ici : le corps est une iframe. On coupe donc
          explicitement aria-describedby pour ne pas pointer un noeud absent. */}
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('supervision.messageModal.title', { defaultValue: 'Message envoyé' })}</DialogTitle>
        </DialogHeader>
        {/* Pendant du `dividers` de l'ancienne DialogContent MUI. */}
        <div className="-mx-4 px-4 py-3 border-y border-solid border-border">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-6" />
          </div>
        ) : html ? (
          <>
            {subject && (
              <p className="text-xs text-foreground mb-1.5">
                <strong className="font-semibold">{t('supervision.messageModal.subject', { defaultValue: 'Sujet' })} :</strong> {subject}
              </p>
            )}
            <div className="rounded-md border border-solid border-border overflow-hidden">
              <iframe
                sandbox=""
                srcDoc={srcDoc}
                title={t('supervision.messageModal.title', { defaultValue: 'Message envoyé' })}
                style={{ width: '100%', height: 340, border: 'none' }}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic py-3">
            {t('supervision.messageModal.unavailable', { defaultValue: 'Aperçu du message indisponible.' })}
          </p>
        )}
        </div>
        <DialogFooter>
          {/* Modale de simple lecture : la fermeture reste une action tertiaire. */}
          <Button variant="ghost" onClick={onClose}>{t('supervision.messageModal.close', { defaultValue: 'Fermer' })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
