import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

export interface ChecklistItemData {
  id: string;
  label: string;
  room?: string;
  completed: boolean;
  completedAt?: number; // timestamp
}

interface ChecklistItemProps {
  item: ChecklistItemData;
  onToggle: (id: string) => void;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function ChecklistItem({ item, onToggle }: ChecklistItemProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={() => onToggle(item.id)}
      style={[styles.container, { borderBottomColor: theme.colors.border.light }]}
      activeOpacity={0.6}
    >
      {/* Checkbox */}
      <View
        style={[
          styles.checkbox,
          {
            borderColor: item.completed ? theme.colors.success.main : theme.colors.border.main,
            backgroundColor: item.completed ? theme.colors.success.main : 'transparent',
          },
        ]}
      >
        {item.completed && <Text style={styles.checkmark}>&#10003;</Text>}
      </View>

      {/* Label */}
      <View style={styles.content}>
        <Text
          style={[
            theme.typography.body1,
            {
              color: item.completed ? theme.colors.text.disabled : theme.colors.text.primary,
              textDecorationLine: item.completed ? 'line-through' : 'none',
            },
          ]}
        >
          {item.label}
        </Text>
        {item.room && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{item.room}</Text>
        )}
      </View>

      {/* Timestamp */}
      {item.completedAt && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.success.main }}>
          {formatTimestamp(item.completedAt)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
});
