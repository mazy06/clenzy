import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { tuyaApi, type TuyaAppAccountDto } from '@/api/endpoints/tuyaApi';
import {
  TuyaPairing,
  isTuyaPairingAvailable,
  type PairingMode,
  type PairedDevice,
} from '@/native/tuyaPairing';

export type PairingStatus = 'idle' | 'preparing' | 'pairing' | 'success' | 'error';

/** Compte app Tuya de l'hote (provisionne a la demande cote PMS). */
export function useTuyaAppAccount() {
  return useQuery<TuyaAppAccountDto>({
    queryKey: ['tuya', 'app-account'],
    queryFn: () => tuyaApi.getAppAccount(),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Orchestration de l'appairage Tuya (modele C) : compte app -> login SDK -> token -> activator.
 * Tant que le module natif n'est pas dans le build, {@link nativeAvailable} vaut false et `pair`
 * renvoie une erreur explicite (l'ecran affiche alors un message "build natif requis").
 */
export function useTuyaPairing() {
  const { data: account, isLoading: accountLoading, error: accountError, refetch } = useTuyaAppAccount();

  const [status, setStatus] = useState<PairingStatus>('idle');
  const [progress, setProgress] = useState<string | null>(null);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pair = useCallback(
    async (params: { mode: PairingMode; ssid: string; password: string }) => {
      setError(null);
      setDevices([]);

      if (!isTuyaPairingAvailable) {
        setStatus('error');
        setError('Module natif Tuya indisponible (build natif requis).');
        return;
      }
      if (!account?.username || !account?.secret || !account?.schema) {
        setStatus('error');
        setError('Compte app Tuya indisponible — vérifiez la configuration plateforme (schema App SDK).');
        return;
      }

      try {
        setStatus('preparing');
        setProgress('Initialisation du SDK…');
        // Init du SDK Tuya (idempotent) avec l'AppKey/AppSecret App SDK de la plateforme,
        // servis par le backend (GET /tuya/app-sdk-credentials), selon iOS/Android.
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const creds = await tuyaApi.getAppSdkCredentials(platform);
        await TuyaPairing.init(creds.appKey, creds.appSecret);

        setProgress('Connexion au compte…');
        await TuyaPairing.loginAppAccount(account.countryCode ?? '33', account.username, account.secret);

        setProgress("Récupération du token d'appairage…");
        const token = await TuyaPairing.getPairingToken();

        setStatus('pairing');
        setProgress("Appairage en cours — gardez l'appareil à proximité…");
        const paired = await TuyaPairing.startPairing({
          mode: params.mode,
          ssid: params.ssid,
          password: params.password,
          token,
        });

        setDevices(paired);
        setStatus('success');
        setProgress(null);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : "Échec de l'appairage.");
      }
    },
    [account],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(null);
    setDevices([]);
    setError(null);
  }, []);

  return {
    account,
    accountLoading,
    accountError,
    refetchAccount: refetch,
    nativeAvailable: isTuyaPairingAvailable,
    pair,
    reset,
    status,
    progress,
    devices,
    error,
  };
}
