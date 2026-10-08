/**
 * Icône Reicon (https://reicon.dev) — remplace `Ionicons` de `@expo/vector-icons`.
 *
 * Même API que l'ancien composant (`name`, `size`, `color`, `style`) et même
 * vocabulaire de noms (`home-outline`, `checkmark-circle`…), pour que les écrans
 * migrés n'aient rien changé. Graisse : un nom `-outline` sert le DUOTONE Reicon
 * (graisse privilégiée de Baitly), un nom sans suffixe la variante pleine
 * (états actifs : étoile notée, case cochée…). Table : scripts/reicon/glyph-map.json.
 */
import React, { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { GLYPHS, type IconName } from './glyphs';

export interface ReiconProps {
  name: IconName;
  size?: number;
  /** Teinte du glyphe (défaut noir, comme Ionicons). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const FALLBACK: IconName = 'help-circle-outline';
const xmlCache = new Map<string, string>();

function toXml(name: string): string {
  let xml = xmlCache.get(name);
  if (!xml) {
    let body: string | undefined = GLYPHS[name as IconName];
    if (!body) {
      if (__DEV__) console.warn(`[Reicon] icône inconnue « ${name} » — ajouter-la à scripts/reicon/glyph-map.json`);
      body = GLYPHS[FALLBACK];
    }
    xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`;
    xmlCache.set(name, xml);
  }
  return xml;
}

function ReiconGlyph({ name, size = 24, color = '#000', style }: ReiconProps) {
  return <SvgXml xml={toXml(name)} width={size} height={size} color={color} style={style} />;
}

/** `Reicon.glyphMap` : compat `keyof typeof Ionicons.glyphMap` pour typer les noms. */
export const Reicon = Object.assign(memo(ReiconGlyph), { glyphMap: GLYPHS });
