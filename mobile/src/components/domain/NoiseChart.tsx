import React, { useMemo, useRef } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HORIZONTAL_PADDING = 32; // theme.SPACING.lg * 2
const POINT_SPACING = 50; // px between data points

interface ChartDataPoint {
  time: string; // "HH:mm"
  value: number; // dB level
}

interface NoiseChartProps {
  /** Noise data points sorted by time */
  data: ChartDataPoint[];
  /** Warning threshold in dB (orange dashed line) */
  warningThreshold?: number;
  /** Critical threshold in dB (red dashed line) */
  criticalThreshold?: number;
  /** Whether data is loading */
  isLoading?: boolean;
}

export function NoiseChart({
  data,
  warningThreshold = 70,
  criticalThreshold = 85,
  isLoading,
}: NoiseChartProps) {
  const theme = useTheme();
  const scrollRef = useRef(null);

  // Build chart data with labels
  const chartData = useMemo(() => {
    if (data.length === 0) {
      // Generate empty 24h skeleton with 30-min resolution
      const points: { value: number; label: string; hideDataPoint: boolean }[] = [];
      for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
          points.push({
            value: 0,
            label: m === 0 ? `${String(h).padStart(2, '0')}h` : '',
            hideDataPoint: true,
          });
        }
      }
      return points;
    }

    return data.map((point) => {
      const hour = point.time.split(':')[0];
      const min = point.time.split(':')[1];
      return {
        value: point.value,
        label: min === '00' ? `${hour}h` : '',
        hideDataPoint: false,
      };
    });
  }, [data]);

  // Calculate scroll position to center on current hour
  const scrollToIndex = useMemo(() => {
    if (data.length === 0) {
      // For empty skeleton: 48 points/day, find current half-hour index
      const now = new Date();
      return now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
    }

    // Find the data point closest to current time
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let closestIdx = 0;
    let closestDiff = Infinity;

    data.forEach((point, idx) => {
      const [h, m] = point.time.split(':').map(Number);
      const pointMinutes = h * 60 + m;
      const diff = Math.abs(currentMinutes - pointMinutes);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = idx;
      }
    });

    return closestIdx;
  }, [data]);

  const chartWidth = SCREEN_WIDTH - CHART_HORIZONTAL_PADDING;
  const hasData = data.length > 0;

  return (
    <View>
      <View
        style={{
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          paddingVertical: theme.SPACING.md,
          ...theme.shadows.sm,
        }}
      >
        {/* Legend */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: theme.SPACING.md,
            paddingHorizontal: theme.SPACING.md,
            marginBottom: theme.SPACING.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 16,
                height: 2,
                backgroundColor: theme.colors.warning.main,
                borderStyle: 'dashed',
              }}
            />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Attention ({warningThreshold} dB)
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 16,
                height: 2,
                backgroundColor: theme.colors.error.main,
                borderStyle: 'dashed',
              }}
            />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 10 }}>
              Critique ({criticalThreshold} dB)
            </Text>
          </View>
        </View>

        {/* Chart */}
        <LineChart
          data={chartData}
          scrollRef={scrollRef}
          scrollToIndex={scrollToIndex}
          scrollAnimation
          nestedScrollEnabled
          width={chartWidth - 50}
          height={180}
          spacing={POINT_SPACING}
          initialSpacing={20}
          endSpacing={20}
          maxValue={120}
          noOfSections={6}
          stepValue={20}
          color={hasData ? theme.colors.primary.main : 'transparent'}
          thickness={hasData ? 2 : 0}
          dataPointsColor={hasData ? theme.colors.primary.main : 'transparent'}
          dataPointsRadius={hasData ? 3 : 0}
          curved={hasData}
          areaChart={hasData}
          startFillColor={`${theme.colors.primary.main}30`}
          endFillColor={`${theme.colors.primary.main}05`}
          startOpacity={0.3}
          endOpacity={0.05}
          // Reference line 1: Warning threshold
          showReferenceLine1
          referenceLine1Position={warningThreshold}
          referenceLine1Config={{
            color: theme.colors.warning.main,
            dashWidth: 6,
            dashGap: 4,
            thickness: 1.5,
            type: 'dashed' as const,
          }}
          // Reference line 2: Critical threshold
          showReferenceLine2
          referenceLine2Position={criticalThreshold}
          referenceLine2Config={{
            color: theme.colors.error.main,
            dashWidth: 6,
            dashGap: 4,
            thickness: 1.5,
            type: 'dashed' as const,
          }}
          // Y axis
          yAxisTextStyle={{
            ...theme.typography.caption,
            color: theme.colors.text.disabled,
            fontSize: 9,
          }}
          yAxisLabelSuffix=" dB"
          yAxisColor={theme.colors.border.light}
          yAxisThickness={1}
          // X axis
          xAxisColor={theme.colors.border.light}
          xAxisThickness={1}
          xAxisLabelTextStyle={{
            ...theme.typography.caption,
            color: theme.colors.text.disabled,
            fontSize: 9,
          }}
          // Grid
          rulesColor={`${theme.colors.border.light}80`}
          rulesType="dashed"
          dashWidth={4}
          dashGap={6}
          // Pointer (tooltip on press)
          pointerConfig={hasData ? {
            pointerStripColor: theme.colors.primary.main,
            pointerStripWidth: 1,
            pointerColor: theme.colors.primary.main,
            radius: 5,
            pointerLabelWidth: 80,
            pointerLabelHeight: 30,
            pointerLabelComponent: (items: any[]) => {
              return (
                <View
                  style={{
                    backgroundColor: theme.colors.text.primary,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: theme.BORDER_RADIUS.sm,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {Math.round(items[0]?.value ?? 0)} dB
                  </Text>
                </View>
              );
            },
          } : undefined}
        />

        {/* Empty state overlay */}
        {!hasData && !isLoading && (
          <View
            style={{
              position: 'absolute',
              top: 60,
              left: 0,
              right: 0,
              bottom: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.text.disabled,
                fontStyle: 'italic',
              }}
            >
              En attente de donnees...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
