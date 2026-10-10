import { BAR_PRICE_AMOUNT_MIN, BAR_PRICE_INLINE_MIN } from '../constants';

interface BarContentInput {
  width: number;
  height: number;
  guestName: string;
  guestNameWidth?: number;
  hasPrice: boolean;
  hasChannel: boolean;
  indicatorCount: number;
  isReservation?: boolean;
  /** Repli supplémentaire si la mesure du texte rendu dépasse le budget. */
  minimumFoldLevel?: number;
  hasAlert?: boolean;
}

/** Règles communes au planning Baitly et à ses démonstrations : le nom prime,
 * puis le prix, les prestations et le canal. L'avatar cède en dernier.
 * Les budgets sont calibrés sur la brique 12 px semibold du planning. */
export function getBarContentLayout({
  width,
  height,
  guestName,
  guestNameWidth,
  hasPrice,
  hasChannel,
  indicatorCount,
  isReservation = true,
  minimumFoldLevel = 0,
  hasAlert = false,
}: BarContentInput) {
  const showLabel = width > 40 && height >= 12;
  const avatarByWidth = isReservation && width > 90 && height >= 32;
  const showPrice = hasPrice && height >= 28;
  const priceAmountVisible = showPrice && width >= BAR_PRICE_AMOUNT_MIN;
  const priceByWidth = showPrice && width >= BAR_PRICE_INLINE_MIN;
  const compactRightZone = priceByWidth && !priceAmountVisible;
  const showBadgeGroup = isReservation && width > (hasAlert ? 84 : 56) && height >= 28;
  const baseSlots = compactRightZone ? 0 : width > (priceByWidth ? 220 : 175) ? 2 : 1;
  const inlineCount = indicatorCount <= baseSlots ? indicatorCount : Math.max(0, baseSlots - 1);
  const logoByWidth = hasChannel && width > 60 && !compactRightZone;
  const nameNeeded = showLabel ? guestNameWidth ?? guestName.length * 6.4 : 0;

  // 0 : inline ; 1 : prestations + canal repliés ; 2 : prix replié ;
  // 3 : avatar masqué. Réserver aussi la place de la pastille « +N ».
  const roomAtLevel = (level: number) => {
    let right = 0;
    if (level === 0 && showBadgeGroup) right += inlineCount * (54 + 7);
    if (showBadgeGroup && (level > 0 || indicatorCount > inlineCount)) right += 21 + 7;
    if (level === 0 && logoByWidth) right += 26 + 7;
    if (level <= 1 && priceByWidth) right += 66 + 7;
    const left = level <= 2 && avatarByWidth ? 26 + 7 : 0;
    return width - 14 - left - right - (hasAlert && width >= 36 ? 28 : 0);
  };

  let foldLevel = Math.min(3, Math.max(0, minimumFoldLevel));
  while (foldLevel < 3 && nameNeeded > roomAtLevel(foldLevel)) foldLevel += 1;
  const slots = foldLevel === 0 ? baseSlots : 0;
  const shownIndicatorCount = indicatorCount <= slots ? indicatorCount : Math.max(0, slots - 1);
  const priceInline = priceByWidth && foldLevel < 2;
  const priceFolded = showPrice && !priceInline;
  const channelFolded = hasChannel && (width <= 60 || compactRightZone || foldLevel > 0);

  return {
    foldLevel,
    showLabel,
    showAvatar: avatarByWidth && foldLevel < 3 && !compactRightZone,
    priceAmountVisible,
    priceInline,
    priceFolded,
    compactRightZone,
    showBadgeGroup,
    shownIndicatorCount,
    nameFitsInline: foldLevel === 0,
    channelFolded,
    overflowCount: indicatorCount - shownIndicatorCount + Number(priceFolded) + Number(channelFolded),
  };
}
