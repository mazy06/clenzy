import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, AlertDescription, Button as BuiButton, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Field, FieldDescription, FieldLabel, Input, NativeSelect, NativeSelectOption,
} from '../../components/ui';
import { OpenInNew, Warning } from '../../icons';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { issuesApi, type Issue, type IssueSeverity, type IssueStatus } from '../../services/api/issuesApi';
import { formatCurrency } from '../../utils/currencyUtils';
import { ISSUE_SEVERITIES as SEVERITIES, ISSUE_STATUS_TONES as STATUS_TONES } from './issuePresentation';

/**
 * Détail d'une anomalie : constat, puis qualification (catégorie, sévérité, coût),
 * conversion en demande de maintenance pré-chiffrée ou rejet. Ouvert depuis l'écran
 * Anomalies et depuis la vue Anomalies de la carte.
 */
export default function IssueDetailDialog({ issue, canManage, onClose, onUpdated }: {
  issue: Issue | null;
  canManage: boolean;
  onClose: () => void;
  onUpdated: (issue: Issue) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editCategory, setEditCategory] = useState('');
  const [editSeverity, setEditSeverity] = useState<IssueSeverity>('MEDIUM');
  const [editCost, setEditCost] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Une autre anomalie ouverte repart d'un formulaire vierge, prérempli de ses valeurs.
  useEffect(() => {
    if (!issue) return;
    setEditCategory(issue.category ?? '');
    setEditSeverity(issue.severity);
    setEditCost(issue.suggestedCost != null ? String(issue.suggestedCost) : '');
    setDismissReason('');
    setConfirmConvert(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement au changement d'anomalie
  }, [issue?.id]);

  const statusLabel = (status: IssueStatus) => t(`issues.status.${status.toLowerCase()}`, status);
  const severityLabel = (severity: IssueSeverity) => t(`issues.severity.${severity.toLowerCase()}`, severity);
  const isActionable = issue != null && (issue.status === 'OPEN' || issue.status === 'QUALIFIED');

  const runAction = async (action: () => Promise<Issue>) => {
    setSaving(true);
    setError(null);
    try {
      onUpdated(await action());
      setConfirmConvert(false);
    } catch {
      setError(t('issues.actionError', 'Action impossible — vérifiez le statut de l’anomalie.'));
    } finally {
      setSaving(false);
    }
  };

  const handleQualify = () =>
    runAction(() =>
      issuesApi.qualify(issue!.id, {
        category: editCategory.trim() || null,
        severity: editSeverity,
        suggestedCost: editCost.trim() === '' ? null : Number(editCost),
      })
    );
  const handleConvert = () => runAction(() => issuesApi.convert(issue!.id));
  const handleDismiss = () => runAction(() => issuesApi.dismiss(issue!.id, dismissReason.trim() || undefined));

  return (
  <Dialog open={issue != null} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="sm:max-w-[600px]">
    {issue && (
      <>
        <DialogHeader>
          <DialogTitle className="flex flex-row items-center gap-1.5 flex-wrap">
            <span className="flex-1 min-w-0">
              {issue.title}
            </span>
            <StatusChip tone={STATUS_TONES[issue.status]} label={statusLabel(issue.status)} />
          </DialogTitle>
        </DialogHeader>
        {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
        <div className="flex flex-col gap-3 border-y border-solid border-border py-3">
            <div>
              <span className="text-xs text-muted-foreground">
                {issue.propertyName ?? '—'}
                {' · '}
                {issue.createdAt ? new Date(issue.createdAt).toLocaleString() : ''}
                {issue.reportedByName ? ` · ${t('issues.reportedBy', 'Signalée par')} ${issue.reportedByName}` : ''}
              </span>
              {issue.description && (
                <p className="text-xs mt-1 whitespace-pre-wrap">
                  {issue.description}
                </p>
              )}
              {issue.dismissReason && (
                <p className="text-xs mt-1 text-muted-foreground">
                  {t('issues.dismissedReason', 'Motif du rejet')} : {issue.dismissReason}
                </p>
              )}
            </div>

            {issue.status === 'CONVERTED' && issue.convertedServiceRequestId != null && (
              <BuiButton
                variant="outline"
                size="sm"
                onClick={() => navigate(`/service-requests/${issue.convertedServiceRequestId}`)}
                className="self-start"
              >
                <OpenInNew />
                {t('issues.openServiceRequest', 'Voir la demande de maintenance')}
              </BuiButton>
            )}

            {canManage && isActionable && (
              <div className="flex flex-col gap-[9px]">
                <h6 className="text-xs font-medium">
                  {t('issues.qualifySection', 'Qualification')}
                </h6>
                <div className="flex flex-col min-[600px]:flex-row gap-[9px]">
                  <Field>
                    <FieldLabel htmlFor="issue-edit-category">{t('issues.fields.category', 'Catégorie')}</FieldLabel>
                    <Input
                      id="issue-edit-category"
                      className="w-full"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                    />
                    <FieldDescription>
                      {t('issues.fields.categoryHelp', 'Alignée sur le catalogue travaux → chiffrage automatique')}
                    </FieldDescription>
                  </Field>
                  <Field className="min-w-[140px]">
                    <FieldLabel htmlFor="issue-edit-severity">{t('issues.fields.severity', 'Sévérité')}</FieldLabel>
                    <NativeSelect
                      id="issue-edit-severity"
                      className="w-full"
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value as IssueSeverity)}
                    >
                      {SEVERITIES.map((severity) => (
                        <NativeSelectOption key={severity} value={severity}>{severityLabel(severity)}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field className="min-w-[120px]">
                    <FieldLabel htmlFor="issue-edit-cost">{t('issues.fields.suggestedCost', 'Coût (€)')}</FieldLabel>
                    <Input
                      id="issue-edit-cost"
                      className="w-full"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value.replace(',', '.'))}
                    />
                  </Field>
                </div>
              </div>
            )}

            {canManage && isActionable && confirmConvert && (
              <Alert variant="warning">
                <Warning />
                <AlertDescription>
                  {t('issues.convertConfirm', 'Créer une demande de maintenance pré-chiffrée à')}{' '}
                  <span className="font-semibold tabular-nums">
                    {issue.suggestedCost != null
                      ? formatCurrency(issue.suggestedCost)
                      : t('issues.noCost', 'chiffrage manuel')}
                  </span>
                  {' — '}{t('issues.convertConfirmSuffix', 'confirmer ?')}
                </AlertDescription>
              </Alert>
            )}

            {canManage && isActionable && !confirmConvert && (
              <Field>
                <FieldLabel htmlFor="issue-dismiss-reason">
                  {t('issues.fields.dismissReason', 'Motif de rejet (optionnel)')}
                </FieldLabel>
                <Input
                  id="issue-dismiss-reason"
                  className="w-full"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                />
              </Field>
            )}

            {error && (
              <Alert variant="destructive">
                <Warning />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
        </div>
        <DialogFooter className="gap-1.5">
          <BuiButton variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.close', 'Fermer')}
          </BuiButton>
          {canManage && isActionable && (
            <>
              {/* « Rejeter » reste tertiaire (ghost) : c'est l'issue de secours,
                  pas une suppression — la conversion est l'action attendue. */}
              <BuiButton variant="ghost" onClick={handleDismiss} disabled={saving}>
                {t('issues.actions.dismiss', 'Rejeter')}
              </BuiButton>
              <BuiButton variant="outline" onClick={handleQualify} disabled={saving}>
                {t('issues.actions.qualify', 'Qualifier')}
              </BuiButton>
              {confirmConvert ? (
                <BuiButton onClick={handleConvert} disabled={saving}>
                  {t('issues.actions.confirmConvert', 'Confirmer la conversion')}
                </BuiButton>
              ) : (
                <BuiButton onClick={() => setConfirmConvert(true)} disabled={saving}>
                  {t('issues.actions.convert', 'Convertir en maintenance')}
                </BuiButton>
              )}
            </>
          )}
        </DialogFooter>
      </>
    )}
    </DialogContent>
  </Dialog>
  );
}
