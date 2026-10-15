export type BaitlyArtwork = 'marketplace' | 'properties' | 'tracking' | 'account' | 'today' | 'home' | 'missions' | 'network' | 'messages' | 'reels';
export type BaitlyTabName = 'Marketplace' | 'Properties' | 'Tracking' | 'Profile' | 'Today' | 'Calendar' | 'Reels' | 'Messages';
export interface BaitlyTabDefinition { name: BaitlyTabName; label: string; artwork: BaitlyArtwork }

/** Stable route identities; capabilities change menus, never permissions. */
/** Four destinations at most per persona: the dock is drawn for four. */
export function baitlyTabs(mode: 'guest' | 'owner' | 'concierge' | 'provider', canQuote = false): BaitlyTabDefinition[] {
  const shared: BaitlyTabDefinition[] = [
    { name: 'Marketplace', label: 'explore', artwork: 'marketplace' },
    { name: 'Tracking', label: mode === 'provider' ? canQuote ? 'requests' : 'networkTab' : 'tracking',
      artwork: mode === 'provider' && !canQuote ? 'network' : 'tracking' },
    { name: 'Profile', label: 'account', artwork: 'account' },
  ];
  const reels: BaitlyTabDefinition = { name: 'Reels', label: 'reelTab', artwork: 'reels' };
  const messages: BaitlyTabDefinition = { name: 'Messages', label: 'messagesTab', artwork: 'messages' };
  if (mode === 'guest') return [shared[0], { name: 'Properties', label: 'properties', artwork: 'properties' }, reels, shared[2]];
  if (mode === 'provider') return [
    { name: 'Today', label: 'missions', artwork: 'missions' },
    ...(canQuote ? [shared[1]] : []),
    messages,
    shared[2],
  ];
  // Owner and concierge: today's work, the bookings calendar, the homes, then everything else.
  return [
    { name: 'Today', label: 'homeTab', artwork: 'home' },
    { name: 'Calendar', label: 'calendarTab', artwork: 'today' },
    { name: 'Properties', label: 'properties', artwork: 'properties' },
    shared[2],
  ];
}

export function physicalTabIndex(index: number, count: number, rtl: boolean) {
  return rtl ? count - 1 - index : index;
}
