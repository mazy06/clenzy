import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProperty, useUpdateProperty } from '@/hooks/useProperties';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';
import type { UpdatePropertyData } from '@/api/endpoints/propertiesApi';

type RouteParams = { PropertyEdit: { propertyId: number } };

const PROPERTY_TYPE_OPTIONS = [
  { label: 'Appartement', value: 'APARTMENT' },
  { label: 'Maison', value: 'HOUSE' },
  { label: 'Studio', value: 'STUDIO' },
  { label: 'Villa', value: 'VILLA' },
  { label: 'Loft', value: 'LOFT' },
  { label: 'Chambre', value: 'ROOM' },
  { label: 'Autre', value: 'OTHER' },
];

export function PropertyEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyEdit'>>();
  const { propertyId } = route.params;

  const { data: property, isLoading } = useProperty(propertyId);
  const updateMutation = useUpdateProperty();

  const [form, setForm] = useState<UpdatePropertyData>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (property) {
      setForm({
        name: property.name,
        type: property.type,
        description: property.description ?? '',
        address: property.address ?? '',
        postalCode: property.postalCode ?? '',
        city: property.city ?? '',
        country: property.country ?? '',
        bedroomCount: property.bedroomCount ?? 0,
        bathroomCount: property.bathroomCount ?? 0,
        maxGuests: property.maxGuests ?? 0,
        squareMeters: property.squareMeters ?? 0,
      });
    }
  }, [property]);

  const updateField = useCallback(<K extends keyof UpdatePropertyData>(key: K, value: UpdatePropertyData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate(
      { id: propertyId, data: form },
      {
        onSuccess: () => {
          Alert.alert('Succes', 'Propriete mise a jour avec succes.');
          navigation.goBack();
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de mettre a jour la propriete.');
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
          Modifier la propriete
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
          {/* Informations generales */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
              <View style={{
                width: 34, height: 34, borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${theme.colors.primary.main}0C`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="home-outline" size={17} color={theme.colors.primary.main} />
              </View>
              <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                Informations generales
              </Text>
            </View>

            <Input
              label="Nom"
              value={form.name ?? ''}
              onChangeText={(v) => updateField('name', v)}
              placeholder="Nom de la propriete"
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />

            <Select
              label="Type"
              options={PROPERTY_TYPE_OPTIONS}
              value={form.type ?? ''}
              onChange={(v) => updateField('type', v)}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />

            <Input
              label="Description"
              value={form.description ?? ''}
              onChangeText={(v) => updateField('description', v)}
              placeholder="Description du bien"
              multiline
              numberOfLines={4}
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />
          </Card>

          {/* Adresse */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
              <View style={{
                width: 34, height: 34, borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${theme.colors.info.main}0C`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="location-outline" size={17} color={theme.colors.info.main} />
              </View>
              <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                Adresse
              </Text>
            </View>

            <Input
              label="Adresse"
              value={form.address ?? ''}
              onChangeText={(v) => updateField('address', v)}
              placeholder="Adresse"
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />

            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <Input
                label="Code postal"
                value={form.postalCode ?? ''}
                onChangeText={(v) => updateField('postalCode', v)}
                placeholder="75001"
                keyboardType="number-pad"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
              <Input
                label="Ville"
                value={form.city ?? ''}
                onChangeText={(v) => updateField('city', v)}
                placeholder="Paris"
                containerStyle={{ flex: 2, marginBottom: theme.SPACING.md }}
              />
            </View>

            <Input
              label="Pays"
              value={form.country ?? ''}
              onChangeText={(v) => updateField('country', v)}
              placeholder="France"
              containerStyle={{ marginBottom: theme.SPACING.md }}
            />
          </Card>

          {/* Capacite */}
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
              <View style={{
                width: 34, height: 34, borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${theme.colors.success.main}0C`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="people-outline" size={17} color={theme.colors.success.main} />
              </View>
              <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                Capacite
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <Input
                label="Chambres"
                value={String(form.bedroomCount ?? 0)}
                onChangeText={(v) => updateField('bedroomCount', parseInt(v, 10) || 0)}
                keyboardType="number-pad"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
              <Input
                label="Sdb"
                value={String(form.bathroomCount ?? 0)}
                onChangeText={(v) => updateField('bathroomCount', parseInt(v, 10) || 0)}
                keyboardType="number-pad"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <Input
                label="Voyageurs max"
                value={String(form.maxGuests ?? 0)}
                onChangeText={(v) => updateField('maxGuests', parseInt(v, 10) || 0)}
                keyboardType="number-pad"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
              <Input
                label="Surface (m2)"
                value={String(form.squareMeters ?? 0)}
                onChangeText={(v) => updateField('squareMeters', parseInt(v, 10) || 0)}
                keyboardType="number-pad"
                containerStyle={{ flex: 1, marginBottom: theme.SPACING.md }}
              />
            </View>
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
