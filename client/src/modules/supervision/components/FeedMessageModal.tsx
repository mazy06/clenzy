/* ============================================================
   <FeedMessageModal> — aperçu du contenu d'un message envoyé

   Ouvert depuis une ligne du journal « En direct » qui porte un `messageLogId`
   (envois de message guest, ex. « Message de check-out »). Récupère le rendu du
   message via GET /api/guest-messaging/preview/{logId} et l'affiche dans une
   iframe SANDBOXÉE (aucun script, HTML isolé) — même approche sûre que
   l'historique des messages (UnifiedHistoryTab), jamais d'injection HTML directe.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useTheme } from '@mui/material';
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
  const isDark = useTheme().palette.mode === 'dark';
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

  const srcDoc = html
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:${
        isDark ? '#e0e0e0' : '#333'
      };background:${isDark ? '#1e1e1e' : '#fff'};padding:16px;margin:0;word-wrap:break-word;}a{color:${
        isDark ? '#90caf9' : '#1976d2'
      };}</style></head><body>${renderServerEmailPreview(html)}</body></html>`
    : '';

  return (
    <Dialog open={logId != null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('supervision.messageModal.title', { defaultValue: 'Message envoyé' })}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-6" />
          </div>
        ) : html ? (
          <>
            {subject && (
              <p className="cn-text-body2 mb-1.5">
                <strong>{t('supervision.messageModal.subject', { defaultValue: 'Sujet' })} :</strong> {subject}
              </p>
            )}
            <div className="rounded-[1px] border border-[divider] overflow-hidden">
              <iframe
                sandbox=""
                srcDoc={srcDoc}
                title={t('supervision.messageModal.title', { defaultValue: 'Message envoyé' })}
                style={{ width: '100%', height: 340, border: 'none' }}
              />
            </div>
          </>
        ) : (
          <p className="cn-text-body2 text-muted-foreground italic py-3">
            {t('supervision.messageModal.unavailable', { defaultValue: 'Aperçu du message indisponible.' })}
          </p>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('supervision.messageModal.close', { defaultValue: 'Fermer' })}</Button>
      </DialogActions>
    </Dialog>
  );
}
