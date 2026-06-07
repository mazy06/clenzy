import React from 'react';
import { Drawer } from '@mui/material';
import type { ConversationDto } from '../../services/api/conversationApi';
import ConversationDetailPanel from './ConversationDetailPanel';

interface ConversationQuickDrawerProps {
  conversation: ConversationDto | null;
  open: boolean;
  archivedOnly?: boolean;
  onClose: () => void;
}

/**
 * Drawer latéral réutilisable affichant UNE conversation (messages + réponse)
 * par-dessus n'importe quel écran.
 *
 * <p>Conçu pour le <b>futur accès rapide global</b> : une icône WhatsApp/OTA
 * disponible partout dans le PMS ouvrira ce drawer. Il n'est volontairement
 * <b>pas</b> utilisé dans l'écran Contact > Messagerie OTA, qui affiche le
 * détail en master-detail inline (colonne de droite). On réutilise le même
 * {@link ConversationDetailPanel} pour garantir un rendu identique.</p>
 */
export default function ConversationQuickDrawer({
  conversation,
  open,
  archivedOnly = false,
  onClose,
}: ConversationQuickDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      {conversation && (
        <ConversationDetailPanel
          conversation={conversation}
          archivedOnly={archivedOnly}
          showClose
          onClose={onClose}
          onStatusChanged={onClose}
        />
      )}
    </Drawer>
  );
}
