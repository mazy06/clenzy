import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useSmartLocks, useSmartLockStatus, useCreateSmartLock, useDeleteSmartLock, useLockSmartLock, useUnlockSmartLock } from '@/hooks/useSmartLocks';
import { useProperties } from '@/hooks/useProperties';
import type { SmartLockDeviceDto } from '@/api/endpoints/smartLockApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Lock Card ─── */

function BatteryIcon({ level, theme }: { level: number | null; theme: ReturnType<typeof useTheme> }) {
  if (level == null) return null;

  let iconName: IoniconsName = 'battery-full-outline';
  let color = theme.colors.success.main;

  if (level <= 10) {
    iconName = 'battery-dead-outline';
    color = theme.colors.error.main;
  } else if (level <= 30) {
    iconName = 'battery-half-outline';
    color = theme.colors.warning.main;
  } else if (level <= 60) {
    iconName = 'battery-half-outline';
    color = theme.colors.success.main;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={iconName} size={16} color={color} />
      <Text style={{ ...theme.typography.caption, color }}>{level}%</Text>
    </View>
  );
}

function SmartLockCard({ lock, onDelete }: { lock: SmartLockDeviceDto; onDelete: (id: number) => void }) {
  const theme = useTheme();
  const { data: status, isLoading: statusLoading } = useSmartLockStatus(lock.id);
  const lockMutation = useLockSmartLock();
  const unlockMutation = useUnlockSmartLock();

  const isLocked = status?.locked ?? lock.lockState === 'LOCKED';
  const isOnline = status?.online ?? lock.status === 'ACTIVE';
  const batteryLevel = status?.batteryLevel ?? lock.batteryLevel;
  const isActioning = lockMutation.isPending || unlockMutation.isPending;

  const handleToggleLock = useCallback(() => {
    if (isLocked) {
      Alert.alert(
        'Deverrouiller',
        `Deverrouiller "${lock.name}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Deverrouiller', onPress: () => unlockMutation.mutate(lock.id) },
        ],
      );
    } else {
      lockMutation.mutate(lock.id);
    }
  }, [isLocked, lock.id, lock.name, lockMutation, unlockMutation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la serrure',
      `Supprimer "${lock.name}" ? Cette action est irreversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(lock.id) },
      ],
    );
  }, [lock.id, lock.name, onDelete]);

  return (
    <Card style={{ marginBottom: theme.SPACING.sm }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
        <View style={{
          width: 44,
          height: 44,
          borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: isOnline ? `${theme.colors.primary.main}10` : `${theme.colors.grey[300]}20`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: theme.SPACING.md,
        }}>
          <Ionicons
            name={isLocked ? 'lock-closed' : 'lock-open'}
            size={22}
            color={isOnline ? theme.colors.primary.main : theme.colors.text.disabled}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>{lock.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginTop: 2 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              {lock.propertyName}
            </Text>
            {lock.roomName && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                · {lock.roomName}
              </Text>
            )}
          </View>
        </View>

        <Pressable onPress={handleDelete} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.text.disabled} />
        </Pressable>
      </View>

      {/* Status row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, marginBottom: theme.SPACING.md }}>
        <Badge
          label={isOnline ? 'En ligne' : 'Hors ligne'}
          variant="subtle"
          color={isOnline ? 'success' : 'error'}
          size="small"
        />
        <Badge
          label={isLocked ? 'Verrouille' : 'Deverrouille'}
          variant="subtle"
          color={isLocked ? 'primary' : 'warning'}
          size="small"
        />
        <BatteryIcon level={batteryLevel} theme={theme} />
      </View>

      {/* Action button */}
      <Pressable
        onPress={handleToggleLock}
        disabled={!isOnline || isActioning || statusLoading}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: isActioning
            ? theme.colors.background.surface
            : isLocked
              ? pressed ? `${theme.colors.warning.main}18` : `${theme.colors.warning.main}0A`
              : pressed ? `${theme.colors.success.main}18` : `${theme.colors.success.main}0A`,
          opacity: !isOnline ? 0.5 : 1,
        })}
      >
        {isActioning ? (
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
        ) : (
          <>
            <Ionicons
              name={isLocked ? 'lock-open-outline' : 'lock-closed-outline'}
              size={18}
              color={isLocked ? theme.colors.warning.main : theme.colors.success.main}
            />
            <Text style={{
              ...theme.typography.body2,
              fontWeight: '600',
              color: isLocked ? theme.colors.warning.main : theme.colors.success.main,
            }}>
              {isLocked ? 'Deverrouiller' : 'Verrouiller'}
            </Text>
          </>
        )}
      </Pressable>
    </Card>
  );
}

/* ─── Add Lock Modal ─── */

function AddLockModal({
  visible,
  onClose,
  propertyOptions,
}: {
  visible: boolean;
  onClose: () => void;
  propertyOptions: { label: string; value: string }[];
}) {
  const theme = useTheme();
  const createMutation = useCreateSmartLock();

  const [name, setName] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nom requis';
    if (!propertyId) newErrors.propertyId = 'Propriete requise';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        propertyId: parseInt(propertyId, 10),
        roomName: roomName.trim() || undefined,
        externalDeviceId: deviceId.trim() || undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setPropertyId('');
          setRoomName('');
          setDeviceId('');
          setErrors({});
          onClose();
        },
      },
    );
  }, [name, propertyId, roomName, deviceId, createMutation, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: theme.colors.background.paper,
            borderTopLeftRadius: theme.BORDER_RADIUS.xl,
            borderTopRightRadius: theme.BORDER_RADIUS.xl,
            padding: theme.SPACING.lg,
            paddingBottom: theme.SPACING['4xl'],
          }}
          onPress={() => {}} // Prevent closing when tapping modal content
        >
          {/* Handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: theme.colors.border.main,
            alignSelf: 'center', marginBottom: theme.SPACING.lg,
          }} />

          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, marginBottom: theme.SPACING.lg }}>
            Ajouter une serrure
          </Text>

          <Input
            label="Nom de la serrure"
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
            placeholder="Ex: Porte principale"
            error={errors.name}
          />

          <View style={{ marginTop: theme.SPACING.md }}>
            <Select
              label="Propriete"
              options={propertyOptions}
              value={propertyId}
              onChange={(v) => { setPropertyId(v); setErrors((e) => ({ ...e, propertyId: '' })); }}
              error={errors.propertyId}
            />
          </View>

          <View style={{ marginTop: theme.SPACING.md }}>
            <Input
              label="Piece (optionnel)"
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Ex: Entree, Chambre 1"
            />
          </View>

          <View style={{ marginTop: theme.SPACING.md }}>
            <Input
              label="ID appareil Tuya (optionnel)"
              value={deviceId}
              onChangeText={setDeviceId}
              placeholder="Ex: abc123xyz"
            />
          </View>

          <View style={{ marginTop: theme.SPACING['2xl'], gap: theme.SPACING.sm }}>
            <Button
              title="Ajouter"
              onPress={handleSubmit}
              fullWidth
              loading={createMutation.isPending}
            />
            <Button
              title="Annuler"
              variant="text"
              onPress={onClose}
              fullWidth
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Main Screen ─── */

export function SmartLockScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: locks, isLoading, isRefetching, refetch } = useSmartLocks();
  const deleteMutation = useDeleteSmartLock();
  const { data: propertiesData } = useProperties();

  const propertyOptions = useMemo(() => {
    const properties = propertiesData?.content ?? [];
    return properties.map((p) => ({ label: p.name, value: String(p.id) }));
  }, [propertiesData]);

  const handleDelete = useCallback((id: number) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  // Group locks by property
  const groupedLocks = useMemo(() => {
    if (!locks?.length) return [];
    const groups = new Map<string, SmartLockDeviceDto[]>();
    for (const lock of locks) {
      const key = lock.propertyName || 'Autre';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lock);
    }
    return Array.from(groups.entries());
  }, [locks]);

  // Summary counts
  const summary = useMemo(() => {
    if (!locks?.length) return { total: 0, online: 0, locked: 0, lowBattery: 0 };
    return {
      total: locks.length,
      online: locks.filter((l) => l.status === 'ACTIVE').length,
      locked: locks.filter((l) => l.lockState === 'LOCKED').length,
      lowBattery: locks.filter((l) => l.batteryLevel != null && l.batteryLevel <= 20).length,
    };
  }, [locks]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        backgroundColor: theme.colors.background.paper,
        gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Serrures connectees
        </Text>
        <Pressable
          onPress={() => setShowAddModal(true)}
          style={{
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: theme.colors.primary.main,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {/* Summary cards */}
        {summary.total > 0 && (
          <View style={{ flexDirection: 'row', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg }}>
            <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>{summary.total}</Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Total</Text>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.success.main }}>{summary.online}</Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>En ligne</Text>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
              <Text style={{ ...theme.typography.h4, color: theme.colors.primary.main }}>{summary.locked}</Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Verrouilles</Text>
            </Card>
            {summary.lowBattery > 0 && (
              <Card style={{ flex: 1, alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
                <Text style={{ ...theme.typography.h4, color: theme.colors.error.main }}>{summary.lowBattery}</Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Batterie faible</Text>
              </Card>
            )}
          </View>
        )}

        {/* Lock list */}
        {groupedLocks.length === 0 ? (
          <EmptyState
            iconName="lock-closed-outline"
            title="Aucune serrure"
            description="Ajoutez une serrure connectee pour gerer les acces a vos proprietes"
            style={{ paddingVertical: theme.SPACING['3xl'] }}
          />
        ) : (
          groupedLocks.map(([propertyName, propertyLocks]) => (
            <View key={propertyName} style={{ marginBottom: theme.SPACING.md }}>
              {groupedLocks.length > 1 && (
                <Text style={{
                  ...theme.typography.h5,
                  color: theme.colors.text.secondary,
                  marginBottom: theme.SPACING.sm,
                }}>
                  {propertyName}
                </Text>
              )}
              {propertyLocks.map((lock) => (
                <SmartLockCard key={lock.id} lock={lock} onDelete={handleDelete} />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <AddLockModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        propertyOptions={propertyOptions}
      />
    </SafeAreaView>
  );
}
