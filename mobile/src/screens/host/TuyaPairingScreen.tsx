import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTuyaPairing } from '@/hooks/useTuyaPairing';
import type { PairingMode } from '@/native/tuyaPairing';

const MODE_OPTIONS = [
  { label: 'Wi-Fi rapide (EZ) — recommandé', value: 'EZ' },
  { label: "Wi-Fi point d'accès (AP)", value: 'AP' },
  { label: 'Bluetooth (BLE)', value: 'BLE' },
];

/**
 * Ecran d'appairage Tuya (modele C). L'hote saisit le Wi-Fi du logement et lance l'activator du
 * SDK Tuya ; l'appareil appaire atterrit sur le compte plateforme et devient visible dans le PMS.
 *
 * Scaffolding : tant que le module natif Tuya n'est pas dans le build, l'ecran affiche un message
 * "build natif requis". Une fois le natif + l'App SDK en place, le flux fonctionne de bout en bout.
 */
export default function TuyaPairingScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { account, accountLoading, accountError, nativeAvailable, pair, reset, status, progress, devices, error } =
    useTuyaPairing();

  const [mode, setMode] = useState<PairingMode>('EZ');
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  const busy = status === 'preparing' || status === 'pairing';
  const schemaMissing = !accountLoading && !accountError && !account?.schema;
  const canStart = nativeAvailable && !!account?.schema && ssid.trim().length > 0 && (mode === 'BLE' || true) && !busy;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="hardware-chip-outline" size={22} color={theme.colors.primary.main} />
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>Appairer un appareil Tuya</Text>
        </View>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
          Connectez votre caméra, serrure ou capteur. L'appareil sera rattaché à votre organisation et
          apparaîtra automatiquement dans le PMS.
        </Text>

        {/* Build natif manquant */}
        {!nativeAvailable && (
          <Card>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Ionicons name="construct-outline" size={20} color={theme.colors.warning.main} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>
                  Module d'appairage non disponible
                </Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 4 }}>
                  Cette version de l'app n'inclut pas encore le module natif Tuya. Mettez à jour vers une
                  version intégrant le SDK Tuya (build dev-client / EAS).
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Tuya non configuré côté plateforme */}
        {(accountError || schemaMissing) && (
          <Card>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error.main} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>
                  Tuya non configuré
                </Text>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 4 }}>
                  Le projet Tuya (App SDK) n'est pas encore configuré pour votre organisation. Contactez
                  l'administrateur Baitly.
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Succès */}
        {status === 'success' && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success.main} />
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
                {devices.length} appareil{devices.length > 1 ? 's' : ''} appairé{devices.length > 1 ? 's' : ''}
              </Text>
            </View>
            {devices.map((d) => (
              <Text key={d.devId} style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
                • {d.name || d.devId}
              </Text>
            ))}
            <View style={{ marginTop: 12, gap: 8 }}>
              <Button title="Appairer un autre appareil" variant="outlined" onPress={reset} fullWidth />
              <Button title="Terminé" onPress={() => navigation.goBack()} fullWidth />
            </View>
          </Card>
        )}

        {/* Formulaire d'appairage */}
        {status !== 'success' && (
          <Card>
            <Select
              label="Mode d'appairage"
              options={MODE_OPTIONS}
              value={mode}
              onChange={(v) => setMode(v as PairingMode)}
            />
            {mode !== 'BLE' && (
              <>
                <Input
                  label="Réseau Wi-Fi (2,4 GHz)"
                  value={ssid}
                  onChangeText={setSsid}
                  placeholder="Nom du Wi-Fi du logement"
                  autoCapitalize="none"
                  editable={!busy}
                />
                <Input
                  label="Mot de passe Wi-Fi"
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!busy}
                />
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 4 }}>
                  Tuya ne supporte que le Wi-Fi 2,4 GHz pour l'appairage.
                </Text>
              </>
            )}

            {progress && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <ActivityIndicator size="small" color={theme.colors.primary.main} />
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, flex: 1 }}>{progress}</Text>
              </View>
            )}

            {status === 'error' && error && (
              <Text style={{ ...theme.typography.body2, color: theme.colors.error.main, marginTop: 12 }}>{error}</Text>
            )}

            <View style={{ marginTop: 16 }}>
              <Button
                title={busy ? 'Appairage…' : "Lancer l'appairage"}
                onPress={() => pair({ mode, ssid: ssid.trim(), password: wifiPassword })}
                loading={busy}
                disabled={!canStart}
                fullWidth
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
