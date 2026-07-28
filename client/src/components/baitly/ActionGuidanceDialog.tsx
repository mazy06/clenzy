import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLinkIcon, InfoIcon } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';
import { Money } from '../Money';
import type { DashboardActionItem, DashboardActionKind } from '../../services/api/dashboardOperationsApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — ce qu'il faut faire, et où le faire.
 *
 * <p>Onze natures d'action ne se règlent pas depuis le tableau de bord : on ne
 * réassigne pas une intervention ni ne rétablit une connexion OAuth dans une
 * modale de synthèse. Mais quitter l'écran sans savoir où l'on va, c'est perdre
 * le fil de ce qu'on était en train de traiter.</p>
 *
 * <p>Cette modale dit donc trois choses et s'arrête là : ce qui s'est passé, ce
 * que ça coûte si on ne fait rien, et l'écran qui porte réellement le geste.
 * Elle n'offre pas de « marquer comme traité » : ces actions sont déduites des
 * données, elles disparaissent quand leur cause disparaît. Proposer de les
 * rayer donnerait un bouton sans effet — le serveur le refuserait, et à raison.</p>
 */

export interface ActionGuidanceDialogProps {
  /** Action à expliquer. `null` ferme la modale. */
  item: DashboardActionItem | null;
  onClose: () => void;
}

export default function ActionGuidanceDialog({ item, onClose }: ActionGuidanceDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const guidance = item ? GUIDANCE[item.kind] : undefined;

  return (
    <Dialog open={item != null && guidance != null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8">{item?.title}</DialogTitle>
          <DialogDescription>
            {[item?.detail, item?.propertyName].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {guidance && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{t(guidance.whatKey, guidance.what)}</p>
            <p className="text-foreground">{t(guidance.todoKey, guidance.todo)}</p>
          </div>
        )}

        {item?.amount != null && (
          <p className="text-lg font-semibold text-foreground tabular-nums">
            <Money value={item.amount} />
          </p>
        )}

        {/* Dire pourquoi il n'y a rien à cocher évite de chercher le bouton. */}
        <Alert>
          <InfoIcon />
          <AlertDescription>
            {t(
              'dashboard.guidance.selfClosing',
              'Cette ligne disparaîtra d’elle-même une fois la cause traitée.',
            )}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            onClick={() => {
              onClose();
              if (guidance) navigate(guidance.route);
            }}
          >
            <ExternalLinkIcon />
            {guidance ? t(guidance.linkKey, guidance.link) : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Guidance {
  whatKey: string;
  what: string;
  todoKey: string;
  todo: string;
  route: string;
  linkKey: string;
  link: string;
}

/**
 * Ce qui s'est passé, et où le réparer, pour chaque nature déduite.
 *
 * Une table plutôt qu'une cascade de conditions : ajouter une nature devient
 * une entrée, et une nature oubliée se voit tout de suite — la modale ne
 * s'ouvre pas, plutôt que d'afficher un texte générique qui n'aide personne.
 */
const GUIDANCE: Partial<Record<DashboardActionKind, Guidance>> = {
  INTERVENTION_UNASSIGNED: {
    whatKey: 'dashboard.guidance.interventionUnassignedWhat',
    what: 'Aucune personne ni équipe n’est rattachée à cette intervention.',
    todoKey: 'dashboard.guidance.interventionUnassignedTodo',
    todo: 'Assignez quelqu’un, sans quoi personne ne se présentera le jour venu.',
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },
  INTERVENTION_UNPAID: {
    whatKey: 'dashboard.guidance.interventionUnpaidWhat',
    what: 'Le travail est fait, mais l’intervention reste bloquée faute de règlement.',
    todoKey: 'dashboard.guidance.interventionUnpaidTodo',
    todo: 'Encaissez le montant pour libérer l’intervention.',
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },
  CHECKIN_NOT_STARTED: {
    whatKey: 'dashboard.guidance.checkinWhat',
    what: 'Le voyageur arrive bientôt et n’a pas commencé son check-in en ligne.',
    todoKey: 'dashboard.guidance.checkinTodo',
    todo: 'Relancez-le : sans ses pièces d’identité, la déclaration ne pourra pas être faite dans les délais.',
    route: '/reservations',
    linkKey: 'dashboard.guidance.seeReservations',
    link: 'Voir les réservations',
  },
  NOISE_ALERT_UNACKNOWLEDGED: {
    whatKey: 'dashboard.guidance.noiseWhat',
    what: 'Un dépassement sonore a été mesuré et personne ne l’a acquitté.',
    todoKey: 'dashboard.guidance.noiseTodo',
    todo: 'Vérifiez le logement et acquittez l’alerte : c’est ce qui précède une plainte de voisinage.',
    route: '/properties?tab=connected-objects',
    linkKey: 'dashboard.guidance.seeDevices',
    link: 'Voir les objets connectés',
  },
  ISSUE_OPEN: {
    whatKey: 'dashboard.guidance.issueWhat',
    what: 'Un signalement du terrain attend une décision.',
    todoKey: 'dashboard.guidance.issueTodo',
    todo: 'Convertissez-le en prestation, ou écartez-le en indiquant pourquoi.',
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },
  OWNER_PAYOUT_PENDING: {
    whatKey: 'dashboard.guidance.payoutWhat',
    what: 'Un reversement est préparé mais n’a jamais été approuvé.',
    todoKey: 'dashboard.guidance.payoutTodo',
    todo: 'Approuvez-le ou corrigez-le : le propriétaire attend son virement.',
    route: '/billing?tab=payouts',
    linkKey: 'dashboard.guidance.seePayouts',
    link: 'Voir les reversements',
  },
  PAYOUT_ONBOARDING_INCOMPLETE: {
    whatKey: 'dashboard.guidance.onboardingWhat',
    what: 'Le compte de paiement est raccordé, mais sa vérification n’a jamais été terminée.',
    todoKey: 'dashboard.guidance.onboardingTodo',
    todo: 'Terminez la vérification : en l’état, aucun versement ne partira, alors que tout paraît configuré.',
    route: '/billing?tab=payouts',
    linkKey: 'dashboard.guidance.seePayouts',
    link: 'Voir les reversements',
  },
  INVITATION_EXPIRED: {
    whatKey: 'dashboard.guidance.invitationWhat',
    what: 'Le lien d’invitation a expiré : la personne ne peut plus rejoindre l’organisation.',
    todoKey: 'dashboard.guidance.invitationTodo',
    todo: 'Renvoyez une invitation, ou retirez-la si elle n’a plus lieu d’être.',
    route: '/directory',
    linkKey: 'dashboard.guidance.seeDirectory',
    link: 'Voir l’annuaire',
  },
  AUTOMATION_FAILED: {
    whatKey: 'dashboard.guidance.automationWhat',
    what: 'Une automatisation a échoué : l’action promise n’a pas eu lieu.',
    todoKey: 'dashboard.guidance.automationTodo',
    todo: 'Vérifiez la règle et faites le geste à la main si le voyageur est concerné.',
    route: '/automation-rules',
    linkKey: 'dashboard.guidance.seeAutomations',
    link: 'Voir les automatisations',
  },
  OUTBOX_DEAD_LETTER: {
    whatKey: 'dashboard.guidance.outboxWhat',
    what: 'Un message interne a épuisé toutes ses tentatives : plus personne ne le reprendra.',
    todoKey: 'dashboard.guidance.outboxTodo',
    todo: 'Ses conséquences apparaissent ailleurs — un calendrier non prévenu, par exemple. À rejouer.',
    route: '/admin/monitoring',
    linkKey: 'dashboard.guidance.seeMonitoring',
    link: 'Voir la supervision',
  },
  EINVOICE_FAILED: {
    whatKey: 'dashboard.guidance.einvoiceWhat',
    what: 'L’administration fiscale a refusé la transmission de cette facture.',
    todoKey: 'dashboard.guidance.einvoiceTodo',
    todo: 'Corrigez la facture puis retransmettez-la : en l’état, l’obligation légale n’est pas remplie.',
    route: '/billing?tab=invoices',
    linkKey: 'dashboard.guidance.seeInvoices',
    link: 'Voir les factures',
  },
  INTEGRATION_DISCONNECTED: {
    whatKey: 'dashboard.guidance.integrationWhat',
    what: 'La connexion est morte : jeton expiré, accès révoqué, ou erreur persistante.',
    todoKey: 'dashboard.guidance.integrationTodo',
    todo: 'Reconnectez l’intégration : tant qu’elle est muette, les disponibilités ne remontent plus.',
    route: '/channels',
    linkKey: 'dashboard.guidance.seeChannels',
    link: 'Voir les canaux',
  },
};
