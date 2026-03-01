import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useProperties } from '@/hooks/useProperties';
import { useCreateNoiseDevice } from '@/hooks/useCreateNoiseDevice';

/* ─── Constants ─── */

const DEVICE_TYPE_OPTIONS = [
  { label: 'Minut', value: 'MINUT' },
  { label: 'Clenzy Hardware', value: 'TUYA' },
];

const ROOM_CHIPS = ['Salon', 'Chambre 1', 'Chambre 2', 'Cuisine', 'Terrasse', 'Entree'];

/* ─── Room Chip ─── */

function RoomChip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: theme.BORDER_RADIUS.full,
        backgroundColor: selected ? theme.colors.primary.main : theme.colors.background.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary.main : theme.colors.border.light,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{
        ...theme.typography.caption,
        color: selected ? '#fff' : theme.colors.text.secondary,
        fontWeight: selected ? '600' : '500',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Screen ─── */

export function AddNoiseDeviceScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { data: propertiesData } = useProperties();
  const createDevice = useCreateNoiseDevice();

  // Form state
  const [deviceType, setDeviceType] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [name, setName] = useState('');
  const [externalDeviceId, setExternalDeviceId] = useState('');
  const [externalHomeId, setExternalHomeId] = useState('');

  // Property options for Select
  const propertyOptions = useMemo(() => {
    const properties = propertiesData?.content ?? [];
    return properties.map((p) => ({
      label: p.name,
      value: String(p.id),
    }));
  }, [propertiesData]);

  // Auto-fill name based on selections
  const selectedProperty = propertyOptions.find((p) => p.value === propertyId);
  const selectedType = DEVICE_TYPE_OPTIONS.find((t) => t.value === deviceType);
  const nameManuallyEdited = useRef(false);

  const suggestedName = useMemo(() => {
    const parts = [selectedType?.label, selectedProperty?.label, roomName].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : '';
  }, [selectedType, selectedProperty, roomName]);

  // Auto-fill name when suggestion changes (unless user manually edited)
  useEffect(() => {
    if (!nameManuallyEdited.current && suggestedName) {
      setName(suggestedName);
    }
  }, [suggestedName]);

  const handleRoomChip = useCallback((chip: string) => {
    setRoomName((prev) => (prev === chip ? '' : chip));
  }, []);

  const handleSubmit = useCallback(() => {
    // Validation
    if (!deviceType) {
      Alert.alert('Type requis', 'Selectionnez le type de capteur');
      return;
    }
    if (!propertyId) {
      Alert.alert('Propriete requise', 'Selectionnez la propriete');
      return;
    }
    const finalName = name.trim() || suggestedName;
    if (!finalName) {
      Alert.alert('Nom requis', 'Saisissez un nom pour le capteur');
      return;
    }

    createDevice.mutate(
      {
        deviceType,
        name: finalName,
        propertyId: Number(propertyId),
        roomName: roomName || undefined,
        externalDeviceId: externalDeviceId.trim() || undefined,
        externalHomeId: externalHomeId.trim() || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert('Capteur ajoute', 'Le capteur a ete cree avec succes', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        },
        onError: (error: any) => {
          const message = error?.response?.data?.message ?? error?.message ?? 'Erreur inconnue';
          Alert.alert('Erreur', message);
        },
      },
    );
  }, [deviceType, propertyId, name, suggestedName, roomName, externalDeviceId, externalHomeId, createDevice, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        gap: theme.SPACING.sm,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
            ...theme.shadows.sm,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Ajouter un capteur
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Device Type */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Select
            label="Type de capteur *"
            placeholder="Selectionnez le type..."
            options={DEVICE_TYPE_OPTIONS}
            value={deviceType}
            onChange={setDeviceType}
          />
        </Card>

        {/* Property */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Select
            label="Propriete *"
            placeholder="Selectionnez la propriete..."
            options={propertyOptions}
            value={propertyId}
            onChange={setPropertyId}
          />
        </Card>

        {/* Room */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.body2, fontWeight: '500', color: theme.colors.text.primary, marginBottom: 8 }}>
            Piece (optionnel)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.SPACING.sm }}>
            {ROOM_CHIPS.map((chip) => (
              <RoomChip
                key={chip}
                label={chip}
                selected={roomName === chip}
                onPress={() => handleRoomChip(chip)}
                theme={theme}
              />
            ))}
          </View>
          <Input
            placeholder="Ou saisir un nom personnalise..."
            value={ROOM_CHIPS.includes(roomName) ? '' : roomName}
            onChangeText={(text) => setRoomName(text)}
          />
        </Card>

        {/* Name */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Input
            label="Nom du capteur *"
            placeholder="Ex: Minut - Appartement Paris - Salon"
            value={name}
            onChangeText={(text) => {
              nameManuallyEdited.current = true;
              setName(text);
            }}
          />
        </Card>

        {/* External IDs (advanced) */}
        <Card style={{ marginBottom: theme.SPACING['2xl'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.SPACING.md }}>
            <Ionicons name="settings-outline" size={16} color={theme.colors.text.secondary} />
            <Text style={{ ...theme.typography.body2, fontWeight: '500', color: theme.colors.text.secondary }}>
              Configuration avancee
            </Text>
          </View>
          <Input
            label="ID appareil externe"
            placeholder="Identifiant Minut ou Tuya"
            value={externalDeviceId}
            onChangeText={setExternalDeviceId}
            helperText="Fourni par le fabricant du capteur"
            containerStyle={{ marginBottom: theme.SPACING.md }}
          />
          <Input
            label="ID maison externe"
            placeholder="Identifiant maison Minut"
            value={externalHomeId}
            onChangeText={setExternalHomeId}
            helperText="Necessaire pour les capteurs Minut"
          />
        </Card>

        {/* Submit */}
        <Button
          title="Ajouter le capteur"
          onPress={handleSubmit}
          fullWidth
          loading={createDevice.isPending}
          disabled={createDevice.isPending}
          icon={<Ionicons name="add-circle-outline" size={18} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
