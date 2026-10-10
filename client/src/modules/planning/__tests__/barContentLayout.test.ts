import { describe, expect, it } from 'vitest';
import { getBarContentLayout } from '../utils/barContentLayout';

const reservation = {
  height: 36,
  guestName: 'Marie-Christine Dubois',
  hasPrice: true,
  hasChannel: true,
  indicatorCount: 1,
};

describe('reservation content priorities', () => {
  it('réserve la place de l’alerte sans empiler deux pastilles sur une brique très courte', () => {
    expect(getBarContentLayout({ ...reservation, width: 60, hasAlert: true })).toMatchObject({ showBadgeGroup: false, showAvatar: false, priceInline: false });
  });
  it.each([
    [400, 0, true, true, 1, 0],
    [300, 1, true, true, 0, 2],
    [240, 2, true, false, 0, 3],
    [180, 3, false, false, 0, 3],
  ])('uses width %i to preserve the full name before secondary content',
    (width, foldLevel, showAvatar, priceInline, shownIndicatorCount, overflowCount) => {
      expect(getBarContentLayout({ ...reservation, width })).toMatchObject({
        foldLevel, showAvatar, priceInline, shownIndicatorCount, overflowCount,
      });
    },
  );

  it('reacts to the name length at the same width', () => {
    const short = getBarContentLayout({ ...reservation, width: 300, guestName: 'Li Wu' });
    const long = getBarContentLayout({ ...reservation, width: 300 });
    expect(short.foldLevel).toBe(0);
    expect(long.foldLevel).toBe(1);
    expect(long.channelFolded).toBe(true);
  });

  it('uses the measured width for scripts whose character count is misleading', () => {
    const measured = getBarContentLayout({ ...reservation, width: 300, guestNameWidth: 35 });
    expect(measured.foldLevel).toBe(0);
    const wide = getBarContentLayout({ ...reservation, width: 300, guestName: 'Li', guestNameWidth: 210 });
    expect(wide.foldLevel).toBeGreaterThan(0);
  });

  it('counts each hidden indicator and the price and channel exactly once', () => {
    const result = getBarContentLayout({ ...reservation, width: 240, indicatorCount: 3 });
    expect(result.overflowCount).toBe(5);
    expect(result.shownIndicatorCount).toBe(0);
    const withoutPriceOrChannel = getBarContentLayout({
      ...reservation, width: 180, indicatorCount: 3, hasPrice: false, hasChannel: false,
    });
    expect(withoutPriceOrChannel.overflowCount).toBe(3);
  });

  it('keeps the medium-width rule: no avatar, icon-only price and folded channel', () => {
    expect(getBarContentLayout({ ...reservation, width: 149, guestName: 'Li', indicatorCount: 0 })).toMatchObject({
      compactRightZone: true,
      showAvatar: false,
      priceAmountVisible: false,
      priceInline: true,
      overflowCount: 1,
    });
  });

  it('uses the next shared folding stage when rendered text exceeds its initial budget', () => {
    expect(getBarContentLayout({ ...reservation, width: 400, minimumFoldLevel: 2 })).toMatchObject({
      foldLevel: 2,
      showAvatar: true,
      priceInline: false,
      overflowCount: 3,
    });
  });

  it('restores the photo and details when a stay is widened', () => {
    const narrow = getBarContentLayout({ ...reservation, width: 180 });
    const wide = getBarContentLayout({ ...reservation, width: 500 });
    expect(narrow.showAvatar).toBe(false);
    expect(wide.showAvatar).toBe(true);
    expect(wide.priceInline).toBe(true);
    expect(wide.channelFolded).toBe(false);
    expect(wide.overflowCount).toBe(0);
  });
});
