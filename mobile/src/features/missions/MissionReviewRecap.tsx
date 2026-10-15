import { MissionRecap } from './MissionRecap';
import { safetyApi } from './baitlySafetyApi';
import { restockApi } from './baitlyRestockApi';
import { useBaitlyScope } from '@/features/marketplace/queries';
import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyField, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { baitlyMediaList } from '@/api/baitlyMedia';
import { BAITLY_QUERY_ROOT } from '@/config/baitlyCache';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { reviewDemoWork } from './baitlyDemoWork';
import type { MobileWork } from './api';
import { parseStringList } from './domain';
import { parseDiagnostic } from './diagnosticModel';

/** The same intervention recap, with review actions only when granted by the server. */
export function MissionReviewRecap({ work, demo, onReviewed }: { work: MobileWork; demo: boolean; onReviewed: () => void }) {
  const { t } = useTranslation('mobileV1');
  const cache = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mission = work.mission;
  const scope = useBaitlyScope();
  const safety = useQuery({ queryKey: [...scope, 'mission-safety', mission.id], queryFn: () => safetyApi.detail(mission.id), retry: false });
  const stock = useQuery({ queryKey: [...scope, 'mission-stock', mission.id], queryFn: () => restockApi.list(mission.id), retry: false });
  const proofBlocked = safety.isPending || stock.isPending || safety.isError || stock.isError;
  const canReview = work.canReview && mission.status === 'AWAITING_VALIDATION';
  async function decide(approve: boolean) {
    if (lock.current || proofBlocked || !canReview || (!demo && !isConnected)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (demo) reviewDemoWork(mission.id, approve, reason);
      else await interventionsApi.managerReview(mission.id, { decision: approve ? 'approve' : 'reject', feedback: reason.trim() || undefined,
        amount: approve && mission.estimatedCost != null ? String(mission.estimatedCost) : undefined, version: work.version });
      await Promise.all([cache.invalidateQueries({ queryKey: [BAITLY_QUERY_ROOT] }), cache.invalidateQueries({ queryKey: ['interventions'] })]);
      onReviewed();
    } catch {
      setError(t('stateChanged'));
      await cache.invalidateQueries({ queryKey: [BAITLY_QUERY_ROOT] });
    } finally { lock.current = false; setBusy(false); }
  }
  return <BaitlyScreen title={mission.title} footer={canReview ? <>
    <BaitlyButton title={t(rejecting ? 'demoRequestRework' : 'demoApproveReport')} busy={busy}
      disabled={proofBlocked || (!demo && !isConnected) || (rejecting ? !reason.trim() : !demo && mission.estimatedCost == null)} onPress={() => { void decide(!rejecting); }} />
    <BaitlyButton secondary title={t(rejecting ? 'cancel' : 'demoRequestRework')} disabled={busy} onPress={() => setRejecting(value => !value)} />
  </> : undefined}>
    <BaitlyText>{mission.propertyName}</BaitlyText>
    <BaitlyText muted>{t(`missionStatus.${mission.status}`, { defaultValue: mission.status })}</BaitlyText>
    {demo ? <BaitlyNotice>{t('homeDemo')}</BaitlyNotice> : null}
    {mission.notes ? <BaitlyText>{mission.notes}</BaitlyText> : null}
    {work.technicianNotes ? <BaitlyNotice>{t('step.diagnostic')} : {parseDiagnostic(work.technicianNotes, work.materialsUsed).finding}</BaitlyNotice> : null}
    {work.signatureStatus ? <BaitlyNotice tone={work.signatureStatus === 'SIGNED' ? 'success' : 'info'}>{work.signatureStatus === 'SIGNED' ? t('signatureDoneBy', { name: work.signerName ?? '' }) : t('signatureAbsentDone')}</BaitlyNotice> : null}
    <MissionRecap required={work.requiredSteps ?? parseStringList(mission.completedSteps)} checked={parseStringList(mission.completedSteps)} before={baitlyMediaList(mission.beforePhotosUrls)} after={baitlyMediaList(mission.afterPhotosUrls)} demo={demo} safety={safety.data} stock={stock.data} mission={mission} />
    {safety.isError || stock.isError ? <BaitlyButton secondary title={t('retry')} onPress={() => { void safety.refetch(); void stock.refetch(); }} /> : null}
    {canReview && !demo && mission.estimatedCost == null ? <BaitlyNotice>{t('reviewAmountMissing')}</BaitlyNotice> : null}
    {rejecting ? <BaitlyField label={t('demoReworkReason')} value={reason} onChangeText={setReason} multiline maxLength={1000} /> : null}
    {error ? <BaitlyNotice error>{error}</BaitlyNotice> : null}
  </BaitlyScreen>;
}
