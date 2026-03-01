import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

export interface TimelineStep {
  label: string;
  status: 'completed' | 'active' | 'pending';
  time?: string;
}

interface MissionTimelineProps {
  steps: TimelineStep[];
}

export function MissionTimeline({ steps }: MissionTimelineProps) {
  const theme = useTheme();

  const getColor = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed': return theme.colors.success.main;
      case 'active': return theme.colors.primary.main;
      case 'pending': return theme.colors.grey[300];
    }
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.stepRow}>
          {/* Dot + line */}
          <View style={styles.dotColumn}>
            <View style={[styles.dot, { backgroundColor: getColor(step.status), borderColor: getColor(step.status) }]}>
              {step.status === 'completed' && <Text style={styles.checkText}>&#10003;</Text>}
              {step.status === 'active' && <View style={[styles.innerDot, { backgroundColor: '#fff' }]} />}
            </View>
            {index < steps.length - 1 && (
              <View style={[styles.line, { backgroundColor: step.status === 'completed' ? theme.colors.success.main : theme.colors.grey[200] }]} />
            )}
          </View>

          {/* Label */}
          <View style={styles.labelColumn}>
            <Text style={[
              theme.typography.body2,
              {
                color: step.status === 'pending' ? theme.colors.text.disabled : theme.colors.text.primary,
                fontWeight: step.status === 'active' ? '600' : '400',
              },
            ]}>
              {step.label}
            </Text>
            {step.time && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>{step.time}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingLeft: 4 },
  stepRow: { flexDirection: 'row', minHeight: 48 },
  dotColumn: { alignItems: 'center', width: 28 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  innerDot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  labelColumn: { flex: 1, marginLeft: 12, paddingBottom: 12 },
  checkText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
