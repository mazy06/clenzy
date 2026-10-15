import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { catalogMoneyParts } from './domain';

// Tracés repris des symboles du PMS, client/src/icons (aucune police requise).
const dirham = 'm300.92 17.36h7.0116v125.28h-7.0116zm-13.095 0h7.0117v125.28h-7.0117zm-17.844 82.957c0.13639 1.6815 0.53703 3.3412 1.1827 4.8997 1.8104 4.3699 5.52 7.7989 9.7969 9.819 4.277 2.0201 9.0885 2.7168 13.818 2.6196 3.8938-0.0799 7.7652-0.68026 11.554-1.5821 4.9397-1.1758 9.8016-2.8879 14.082-5.619 5.9146-3.7737 10.617-9.5705 12.587-16.304 2.1237-7.2604 0.97882-15.264-2.3653-22.049-3.5712-7.2458-9.5366-13.178-16.473-17.318-6.3684-3.8004-13.504-6.137-20.697-7.9407-7.4382-1.8653-15.011-3.1933-22.64-3.9704l3.3791-11.995c5 0.77913 9.9854 1.6523 14.953 2.6188 6.3498 1.2355 12.696 2.6313 18.754 4.8997 8.4858 3.1775 16.354 8.0858 22.725 14.53 8.0937 8.1876 13.735 19.085 14.361 30.581 0.58463 10.734-3.3527 21.662-10.729 29.483-6.6389 7.0388-15.732 11.417-25.136 13.692-6.192 1.4977-12.607 2.1443-18.961 1.6828-4.4022-0.31974-8.7998-1.1811-12.84-2.9567-6.9603-3.0586-12.707-8.9552-15.206-16.135-0.99894-2.8698-1.4876-5.9164-1.4361-8.9544z';

export function BaitlyMoney({ amount, currency, country, style }: { amount?: number | null; currency?: string | null; country?: string | null; style?: StyleProp<TextStyle> }) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const parts = catalogMoneyParts(amount, currency, i18n.language, country);
  if (!parts) return <BaitlyText style={style}>{t('onQuote')}</BaitlyText>;
  const at = parts.findIndex(part => part.type === 'currency');
  if (at < 0 || currency !== 'MAD' && currency !== 'SAR') return <BaitlyText style={style}>{parts.map(part => part.value).join('')}</BaitlyText>;
  const before = parts.slice(0, at).map(part => part.value).join('').trim();
  const after = parts.slice(at + 1).map(part => part.value).join('').trim();
  return <View accessible accessibilityLabel={`${amount} ${currency}`} style={styles.amount}>
    {before ? <BaitlyText style={style}>{before}</BaitlyText> : null}
    <Svg width={currency === 'MAD' ? 18 : 16} height={18} viewBox={currency === 'MAD' ? '234 11 138 138' : '0 0 24 24'} accessible={false}>
      {currency === 'MAD' ? <Path d={dirham} fill={colors.ink} /> : <Path d="m20 19.5-5.5 1.2M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2m-17.022 4.151 5.549-1.363A2 2 0 0 0 10 16V2M20 10 4 13.5" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
    {after ? <BaitlyText style={style}>{after}</BaitlyText> : null}
  </View>;
}
const styles = StyleSheet.create({ amount: { flexDirection: 'row', alignItems: 'center', gap: 3 } });
