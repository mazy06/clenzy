import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useProperty, useUpdatePropertyInstructions } from '@/hooks/useProperties';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';
import type { UpdateInstructionsData } from '@/api/endpoints/propertiesApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type RouteParams = { PropertyInstructionsEdit: { propertyId: number } };

/* ─── Copy button ─── */

function CopyButton({ value, theme }: { value: string; theme: ReturnType<typeof useTheme> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  if (!value) return null;

  return (
    <Pressable
      onPress={handleCopy}
      hitSlop={8}
      style={{
        width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
        backgroundColor: copied ? `${theme.colors.success.main}14` : `${theme.colors.primary.main}0C`,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Ionicons
        name={copied ? 'checkmark' : 'copy-outline'}
        size={18}
        color={copied ? theme.colors.success.main : theme.colors.primary.main}
      />
    </Pressable>
  );
}

/* ─── Section header ─── */

function SectionHeader({ icon, iconColor, label, theme }: {
  icon: IoniconsName;
  iconColor: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
      <View style={{
        width: 34, height: 34, borderRadius: theme.BORDER_RADIUS.md,
        backgroundColor: `${iconColor}0C`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

/* ─── Input with copy ─── */

function InputWithCopy({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  theme: ReturnType<typeof useTheme>;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        containerStyle={{ flex: 1 }}
        {...inputProps}
      />
      <View style={{ marginBottom: 2 }}>
        <CopyButton value={value} theme={theme} />
      </View>
    </View>
  );
}

export function PropertyInstructionsEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyInstructionsEdit'>>();
  const { propertyId } = route.params;

  const { data: property, isLoading } = useProperty(propertyId);
  const updateMutation = useUpdatePropertyInstructions();

  const [form, setForm] = useState<UpdateInstructionsData>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (property) {
      const ci = property.checkInInstructions;
      setForm({
        wifiName: ci?.wifiName ?? '',
        wifiPassword: ci?.wifiPassword ?? '',
        accessCode: ci?.accessCode ?? '',
        parkingInfo: ci?.parkingInfo ?? '',
        checkInTime: property.defaultCheckInTime ?? '',
        checkOutTime: property.defaultCheckOutTime ?? '',
        houseRules: ci?.houseRules ?? '',
        emergencyContact: ci?.emergencyContact ?? property.emergencyContact ?? '',
        specialNotes: property.specialRequirements ?? '',
      });
    }
  }, [property]);

  const updateField = useCallback(<K extends keyof UpdateInstructionsData>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate(
      { propertyId, data: form },
      {
        onSuccess: () => {
          Alert.alert('Succes', 'Instructions mises a jour.');
          navigation.goBack();
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de mettre a jour les instructions.');
        },
      },
    );
  }, [form, propertyId, updateMutation, navigation]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
        <View style={{ padding: theme.SPACING.lg }}>
          <Skeleton width="60%" height={24} />
          <View style={{ height: theme.SPACING.xl }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={52} style={{ marginBottom: theme.SPACING.md }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md, gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Modifier les instructions
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* WiFi */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <SectionHeader
              icon="wifi-outline"
              iconColor={theme.colors.primary.main}
              label="WiFi"
              theme={theme}
            />
            <InputWithCopy
              label="Nom du reseau"
              value={form.wifiName ?? ''}
              onChangeText={(v) => updateField('wifiName', v)}
              placeholder="Nom du WiFi"
              theme={theme}
            />
            <InputWithCopy
              label="Mot de passe"
              value={form.wifiPassword ?? ''}
              onChangeText={(v) => updateField('wifiPassword', v)}
              placeholder="Mot de passe WiFi"
              theme={theme}
            />
          </Card>

          {/* Acces */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <SectionHeader
              icon="key-outline"
              iconColor={theme.colors.warning.main}
              label="Acces"
              theme={theme}
            />
            <InputWithCopy
              label="Code d'acces"
              value={form.accessCode ?? ''}
              onChangeText={(v) => updateField('accessCode', v)}
              placeholder="Code de la porte"
              theme={theme}
            />
            <Input
              label="Informations parking"
              value={form.parkingInfo ?? ''}
              onChangeText={(v) => updateField('parkingInfo', v)}
              placeholder="Instructions de stationnement"
              multiline
              numberOfLines={3}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />
          </Card>

          {/* Horaires */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <SectionHeader
              icon="time-outline"
              iconColor={theme.colors.info.main}
              label="Horaires"
              theme={theme}
            />
            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <Input
                label="Heure d'arrivee"
                value={form.checkInTime ?? ''}
                onChangeText={(v) => updateField('checkInTime', v)}
                placeholder="15:00"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
              <Input
                label="Heure de depart"
                value={form.checkOutTime ?? ''}
                onChangeText={(v) => updateField('checkOutTime', v)}
                placeholder="11:00"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
            </View>
          </Card>

          {/* Reglement interieur */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <SectionHeader
              icon="document-text-outline"
              iconColor={theme.colors.success.main}
              label="Reglement interieur"
              theme={theme}
            />
            <Input
              label="Regles de la maison"
              value={form.houseRules ?? ''}
              onChangeText={(v) => updateField('houseRules', v)}
              placeholder="Regles a respecter par les voyageurs"
              multiline
              numberOfLines={5}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />
          </Card>

          {/* Contact & notes */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <SectionHeader
              icon="call-outline"
              iconColor={theme.colors.error.main}
              label="Contact & notes"
              theme={theme}
            />
            <Input
              label="Contact d'urgence"
              value={form.emergencyContact ?? ''}
              onChangeText={(v) => updateField('emergencyContact', v)}
              placeholder="Numero ou nom du contact"
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />
            <Input
              label="Notes speciales"
              value={form.specialNotes ?? ''}
              onChangeText={(v) => updateField('specialNotes', v)}
              placeholder="Informations supplementaires"
              multiline
              numberOfLines={4}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating save button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: theme.SPACING.lg, paddingBottom: Platform.OS === 'ios' ? 34 : theme.SPACING.lg,
        backgroundColor: theme.colors.background.default,
        borderTopWidth: 1, borderTopColor: theme.colors.border.light,
        ...theme.shadows.md,
      }}>
        <Button
          title="Enregistrer"
          onPress={handleSave}
          loading={updateMutation.isPending}
          disabled={!hasChanges || updateMutation.isPending}
          fullWidth
          icon={<Ionicons name="checkmark" size={20} color={theme.colors.primary.contrastText} />}
        />
      </View>
    </SafeAreaView>
  );
}
