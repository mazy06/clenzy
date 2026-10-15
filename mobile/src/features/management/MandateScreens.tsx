import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyRow, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { isSignatureToken, managementApi } from './api';

export function OwnerMandatesScreen({ navigation }: NativeStackScreenProps<BaitlyStackParams, 'OwnerMandates'>) {
  const { t } = useTranslation('mobileV1');
  const scope = useBaitlyScope();
  const query = useQuery({ queryKey: [...scope, 'owner-mandates'], queryFn: ({ signal }) => managementApi.list(signal),
    refetchOnMount: 'always' });
  return <BaitlyScreen title={t('ownerMandates')} subtitle={t('ownerMandatesHelp')}>
    {query.isPending ? <BaitlyLoading /> : query.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} />
      : !query.data.length ? <BaitlyEmpty title={t('noMandates')} message={t('noMandatesHelp')} />
        : query.data.map(mandate => <BaitlyRow key={mandate.id} title={mandate.contractNumber}
          subtitle={t(`mandateState.${mandate.status}`, { defaultValue: mandate.status })}
          detail={mandate.signatureStatus ? t(`signatureState.${mandate.signatureStatus}`) : t('mandateNotReady')}
          onPress={mandate.signatureToken ? () => navigation.navigate('MandateSignature', { token: mandate.signatureToken! }) : undefined} />)}
    <BaitlyButton secondary title={t('refresh')} busy={query.isFetching} onPress={() => { void query.refetch(); }} />
    <BaitlyButton secondary title={t('findManagement')} onPress={() => navigation.navigate('DiscoverConciergeries')} />
  </BaitlyScreen>;
}

export function MandateSignatureScreen({ route }: NativeStackScreenProps<BaitlyStackParams, 'MandateSignature'>) {
  // Changer de mandat efface le nom, la lecture du PDF et le consentement précédents.
  return <MandateSignatureContent key={route.params.token} token={route.params.token} />;
}

function MandateSignatureContent({ token }: { token: string }) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const scope = useBaitlyScope();
  const client = useQueryClient();
  const valid = isSignatureToken(token);
  const key = [...scope, 'mandate-signature', token];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => managementApi.view(token, signal),
    enabled: valid, retry: false, gcTime: 0, refetchOnMount: 'always' });
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [openedDocument, setOpenedDocument] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [documentError, setDocumentError] = useState(false);
  const [focused, setFocused] = useState(false);
  const lock = useRef(false);
  const view = query.data;
  const canSign = !query.isFetching && !query.isError && view?.status === 'PENDING' && view.documentAvailable
    && openedDocument && consent && name.trim().length > 0 && name.trim().length <= 255 && !uncertain;
  const refresh = async () => {
    if (lock.current) return;
    setConsent(false); setOpenedDocument(false);
    const result = await query.refetch();
    if (!result.isError) setUncertain(false);
  };
  const sign = async () => {
    if (lock.current || !canSign) return;
    lock.current = true; setBusy(true);
    try {
      const result = await managementApi.sign(token, name);
      client.setQueryData(key, result);
      setConsent(false);
      void client.invalidateQueries({ queryKey: [...scope, 'owner-mandates'] });
    } catch {
      // Une coupure peut survenir après l'enregistrement : vérifier avant toute nouvelle tentative.
      setUncertain(true);
    } finally { lock.current = false; setBusy(false); }
  };
  return <BaitlyScreen title={t('managementMandate')}>
    {!valid ? <BaitlyEmpty title={t('mandateUnavailable')} /> : query.isPending ? <BaitlyLoading />
      : query.isError ? <BaitlyEmpty title={t('mandateUnavailable')} message={t('mandateUnavailableHelp')} retry={() => { void refresh(); }} />
        : view ? <>
          <BaitlyText variant="heading">{view.propertyName}</BaitlyText>
          <BaitlyText muted>{view.contractNumber} · {t(`signatureState.${view.status}`)}</BaitlyText>
          <BaitlyRow title={t('mandateOwner')} subtitle={view.ownerName} />
          <BaitlyRow title={t('mandateType')} subtitle={t(`mandateType.${view.contractType}`, { defaultValue: view.contractType })} />
          <BaitlyRow title={t('mandateCommission')} detail={view.commissionRate == null ? t('notAvailable')
            : Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 2 }).format(view.commissionRate)} />
          <BaitlyRow title={t('mandatePeriod')} detail={[view.startDate, view.endDate || t('noEndDate')].filter(Boolean).join(' / ')} />
          <BaitlyRow title={t('mandatePayment')} subtitle={t(`mandatePayment.${view.paymentModel}`, { defaultValue: view.paymentModel })} />
          <BaitlyText variant="heading">{t('mandateObligations')}</BaitlyText>
          {(['policeDeclarationBy', 'touristTaxBy', 'licenceHeldBy'] as const).map(field =>
            <BaitlyRow key={field} title={t(`mandateObligation.${field}`)} subtitle={t(`mandateBearer.${view[field]}`, { defaultValue: view[field] })} />)}
          {view.documentAvailable && (view.status === 'PENDING' || view.status === 'SIGNED') ?
            <BaitlyButton secondary title={t(view.status === 'SIGNED' ? 'readSignedMandate' : 'readMandate')} busy={busy}
              onPress={() => {
                setDocumentError(false);
                void WebBrowser.openBrowserAsync(managementApi.documentUrl(token)).then(result => {
                  if (result.type !== 'cancel') setOpenedDocument(true);
                }).catch(() => setDocumentError(true));
              }} /> : null}
          {documentError ? <BaitlyNotice error>{t('mandateDocumentFailed')}</BaitlyNotice> : null}
          {view.status === 'PENDING' ? <>
            {!view.documentAvailable ? <BaitlyNotice>{t('mandateNotReady')}</BaitlyNotice> : <BaitlyText muted>{t('readMandateFirst')}</BaitlyText>}
            <BaitlyField label={t('signerName')} value={name} onChangeText={setName} editable={!busy}
              maxLength={255} autoCapitalize="words" autoComplete="name" />
            <Pressable testID="mandate-consent" accessibilityRole="checkbox" accessibilityLabel={view.consentText}
              accessibilityState={{ checked: consent, disabled: busy || !openedDocument }} disabled={busy || !openedDocument}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={() => setConsent(value => !value)}
              style={({ pressed }) => [styles.consent, { backgroundColor: colors.muted, opacity: pressed ? 0.8 : 1,
                borderColor: focused || consent ? colors.primary : colors.border }]}>
              <View style={[styles.check, { borderColor: colors.primary, backgroundColor: consent ? colors.primary : colors.surface }]}>
                <BaitlyText style={{ color: colors.onPrimary, textAlign: 'center' }}>{consent ? '✓' : ''}</BaitlyText>
              </View>
              <BaitlyText>{view.consentText}</BaitlyText>
            </Pressable>
            {uncertain ? <BaitlyNotice error>{t('signatureUncertain')}</BaitlyNotice> : null}
            <BaitlyButton title={t('signMandate')} disabled={!canSign} busy={busy} onPress={() => { void sign(); }} />
          </> : view.status === 'SIGNED' ? <BaitlyNotice>{t('mandateSigned', { name: view.signedByName, date: view.signedAt })}</BaitlyNotice>
            : <BaitlyNotice>{t('mandateUnavailableHelp')}</BaitlyNotice>}
          <BaitlyButton title={t('checkSignature')} secondary busy={query.isFetching || busy} onPress={() => { void refresh(); }} />
        </> : null}
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  consent: { padding: 16, gap: 12, borderWidth: 2, borderRadius: 8 },
  check: { width: 28, height: 28, borderWidth: 1, borderRadius: 6 },
});
