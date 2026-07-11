import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PhotoGrid } from '@/components/domain/PhotoGrid';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { takePhoto, type CapturedPhoto } from '@/services/camera/cameraService';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { issuesApi, type IssueSeverity } from '@/api/endpoints/issuesApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = {
  AnomalyReport: { interventionId: number };
};

const ANOMALY_CATEGORIES: { value: string; icon: IoniconsName }[] = [
  { value: 'DAMAGE', icon: 'warning-outline' },
  { value: 'MISSING_ITEM', icon: 'search-outline' },
  { value: 'HYGIENE', icon: 'water-outline' },
  { value: 'EQUIPMENT', icon: 'build-outline' },
  { value: 'SAFETY', icon: 'shield-outline' },
  { value: 'OTHER', icon: 'ellipsis-horizontal-outline' },
];

// 4 niveaux alignés sur IssueSeverity backend (CRITICAL n'est plus remappé sur HIGH).
const SEVERITY_LEVELS = [
  { value: 'LOW', color: '#059669', icon: 'information-circle-outline' as IoniconsName },
  { value: 'MEDIUM', color: '#D97706', icon: 'alert-circle-outline' as IoniconsName },
  { value: 'HIGH', color: '#EA580C', icon: 'warning-outline' as IoniconsName },
  { value: 'CRITICAL', color: '#DC2626', icon: 'alert-outline' as IoniconsName },
];

export function AnomalyReportScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RouteParams, 'AnomalyReport'>>();
  const navigation = useNavigation();
  const { interventionId } = route.params;

  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleTakePhoto = useCallback(async () => {
    const photo = await takePhoto();
    if (photo) setPhotos((prev) => [...prev, photo]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!category) {
      Alert.alert(t('anomaly.categoryRequiredTitle'), t('anomaly.categoryRequiredMessage'));
      return;
    }
    if (!description.trim()) {
      Alert.alert(t('anomaly.descriptionRequiredTitle'), t('anomaly.descriptionRequiredMessage'));
      return;
    }

    setSubmitting(true);
    try {
      // Le ticket Issue backend exige un titre : categorie + localisation.
      const categoryLabel = t(`anomaly.categories.${category}`, category);
      const trimmedLocation = location.trim();
      const title = trimmedLocation ? `${categoryLabel} — ${trimmedLocation}` : categoryLabel;

      await issuesApi.create({
        sourceInterventionId: interventionId,
        title: title.slice(0, 150),
        description: description.trim(),
        category,
        severity: severity as IssueSeverity,
      });

      // Photos : mecanisme existant des photos d'intervention, phase ISSUE.
      // Best-effort : le ticket est deja cree, un echec photo ne le remet pas en cause.
      if (photos.length > 0) {
        try {
          const formData = new FormData();
          formData.append('photoType', 'issue');
          photos.forEach((photo, index) => {
            formData.append('photos', {
              uri: photo.uri,
              type: 'image/jpeg',
              name: `issue_${interventionId}_${index}.jpg`,
            } as unknown as Blob);
          });
          await interventionsApi.uploadPhotos(interventionId, formData);
        } catch {
          Alert.alert(t('anomaly.photosFailedTitle'), t('anomaly.photosFailedMessage'));
        }
      }

      setSubmitted(true);
    } catch {
      Alert.alert(t('common.error'), t('anomaly.submitError'));
    }
    setSubmitting(false);
  }, [category, severity, location, description, photos, interventionId, t]);

  // Success state with contact option
  if (submitted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.SPACING.lg }}>
          <View style={{
            width: 72, height: 72, borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: `${theme.colors.success.main}12`,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: theme.SPACING.lg,
          }}>
            <Ionicons name="checkmark-circle" size={40} color={theme.colors.success.main} />
          </View>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, textAlign: 'center', marginBottom: 8 }}>
            {t('anomaly.successTitle')}
          </Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, textAlign: 'center', marginBottom: theme.SPACING['2xl'] }}>
            {t('anomaly.successMessage')}
          </Text>
          <View style={{ width: '100%', gap: theme.SPACING.sm }}>
            <Pressable
              onPress={() => (navigation as any).navigate('Profile', { screen: 'MyIssues' })}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, paddingVertical: 14,
                borderRadius: theme.BORDER_RADIUS.lg,
                backgroundColor: pressed ? theme.colors.primary.dark : theme.colors.primary.main,
              })}
            >
              <Ionicons name="list-outline" size={18} color="#fff" />
              <Text style={{ ...theme.typography.body2, color: '#fff', fontWeight: '600' }}>
                {t('anomaly.viewMyIssues')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => (navigation as any).navigate('Messages')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, paddingVertical: 14,
                borderRadius: theme.BORDER_RADIUS.lg,
                borderWidth: 1, borderColor: theme.colors.primary.main,
                backgroundColor: pressed ? `${theme.colors.primary.main}12` : 'transparent',
              })}
            >
              <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.primary.main} />
              <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '600' }}>
                {t('anomaly.contactManager')}
              </Text>
            </Pressable>
            <Button title={t('common.back')} variant="text" onPress={() => navigation.goBack()} fullWidth />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
        backgroundColor: theme.colors.background.paper, gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>{t('anomaly.title')}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{t('anomaly.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}>
        {/* Category chips */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>{t('anomaly.categorySection')}</Text>
          <View style={styles.chipRow}>
            {ANOMALY_CATEGORIES.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderRadius: theme.BORDER_RADIUS.lg,
                    backgroundColor: isSelected ? theme.colors.warning.main : `${theme.colors.warning.main}08`,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.colors.warning.main : `${theme.colors.warning.main}30`,
                  }}
                >
                  <Ionicons name={cat.icon} size={14} color={isSelected ? '#fff' : theme.colors.warning.main} />
                  <Text style={{
                    ...theme.typography.caption, fontWeight: '600',
                    color: isSelected ? '#fff' : theme.colors.warning.main,
                  }}>
                    {t(`anomaly.categories.${cat.value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Severity */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>{t('anomaly.severitySection')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SEVERITY_LEVELS.map((sev) => {
              const isSelected = severity === sev.value;
              return (
                <Pressable
                  key={sev.value}
                  onPress={() => setSeverity(sev.value)}
                  style={{
                    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12,
                    borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: isSelected ? sev.color : `${sev.color}08`,
                    borderWidth: 1,
                    borderColor: isSelected ? sev.color : `${sev.color}30`,
                  }}
                >
                  <Ionicons name={sev.icon} size={18} color={isSelected ? '#fff' : sev.color} />
                  <Text style={{
                    ...theme.typography.caption, fontWeight: '600',
                    color: isSelected ? '#fff' : sev.color,
                  }}>
                    {t(`anomaly.severities.${sev.value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Location */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>{t('anomaly.locationSection')}</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={t('anomaly.locationPlaceholder')}
            placeholderTextColor={theme.colors.text.disabled}
            style={[styles.textInputSingle, {
              borderColor: theme.colors.border.main,
              color: theme.colors.text.primary,
              backgroundColor: theme.colors.background.default,
            }]}
          />
        </Card>

        {/* Description */}
        <Card style={{ marginBottom: theme.SPACING.md }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginBottom: theme.SPACING.sm }}>{t('anomaly.descriptionSection')}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('anomaly.descriptionPlaceholder')}
            placeholderTextColor={theme.colors.text.disabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[styles.textInput, {
              borderColor: theme.colors.border.main,
              color: theme.colors.text.primary,
              backgroundColor: theme.colors.background.default,
            }]}
          />
        </Card>

        {/* Photos */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.SPACING.sm }}>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>{t('anomaly.photosSection')}</Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {t('anomaly.photoCount', { count: photos.length })}
            </Text>
          </View>
          <PhotoGrid photos={photos.map((p) => p.uri)} onAddPhoto={handleTakePhoto} />
        </Card>

        <Button
          title={t('anomaly.submit')}
          onPress={handleSubmit}
          color="warning"
          fullWidth
          loading={submitting}
          icon={<Ionicons name="send-outline" size={16} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
  },
  textInputSingle: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 44,
  },
});
