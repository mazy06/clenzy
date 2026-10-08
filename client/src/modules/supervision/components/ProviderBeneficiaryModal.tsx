import { useEffect, useId, useState } from 'react';
import { Alert, AlertDescription, Button, Checkbox, Dialog } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';
import { ActionModalBody, ActionModalContent, ActionModalFacts, ActionModalFooter, ActionModalHeader, ActionModalLoading } from './ActionModal';
import type { ActionConfirmModalProps } from './ActionConfirmModal';
import type { SuggestionPreview } from './ActionReviewModal';

/** Une décision sur l'affectation relue par le serveur, jamais sur un compte saisi librement. */
export function ProviderBeneficiaryModal({ action, onClose, onConfirm }: ActionConfirmModalProps) {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const allowed = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);
  const checkboxId = useId();
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null); setFailed(false); setConfirmed(false); setSubmitting(false);
    if (!allowed) return () => controller.abort();
    const token = getAccessToken();
    fetch(buildApiUrl(`/ai/supervision/suggestions/${action.id}/preview`), {
      credentials: 'include', signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((response) => {
      if (!response.ok) throw new Error('Preview unavailable');
      return response.json() as Promise<SuggestionPreview>;
    }).then((value) => { if (!controller.signal.aborted) setPreview(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [action.id, allowed]);

  const company = preview?.recipients?.[0];
  const ready = allowed && preview?.channel === 'Bénéficiaire' && !!company && !preview.blocked && !failed;
  const confirm = () => {
    if (!ready || !confirmed || submitting) return;
    setSubmitting(true);
    onConfirm();
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
    <ActionModalContent className="sm:max-w-[560px]">
      <ActionModalHeader action={action} title={t('supervision.beneficiary.title')} description={action.title} />
      <ActionModalBody>
        {!allowed ? <Alert><AlertDescription>{t('supervision.beneficiary.staffOnly')}</AlertDescription></Alert>
          : failed ? <Alert variant="destructive"><AlertDescription>{t('supervision.beneficiary.unavailable')}</AlertDescription></Alert>
          : !preview ? <ActionModalLoading />
          : <div className="space-y-4">
            {preview.blocked || !ready ? <Alert variant="destructive"><AlertDescription>{preview.blocked || t('supervision.beneficiary.unavailable')}</AlertDescription></Alert>
              : <>
                <p className="m-0 text-base font-semibold text-foreground">{company}</p>
                <ActionModalFacts facts={preview.facts} />
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <Checkbox id={checkboxId} checked={confirmed} disabled={submitting} onCheckedChange={(value) => setConfirmed(value === true)} />
                  <label className="cursor-pointer text-sm leading-relaxed" htmlFor={checkboxId}>
                    {t('providerPayoutBeneficiary.confirm', { name: company })}
                  </label>
                </div>
              </>}
          </div>}
      </ActionModalBody>
      <ActionModalFooter>
        <Button variant="ghost" disabled={submitting} onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={!ready || !confirmed || submitting} onClick={confirm}>
          {t(submitting ? 'providerPayoutBeneficiary.saving' : 'supervision.beneficiary.cta')}
        </Button>
      </ActionModalFooter>
    </ActionModalContent>
  </Dialog>;
}
