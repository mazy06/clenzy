import { useState } from 'react';
import type { Notification } from '../../services/api/notificationsApi';
import { cn } from '../../utils/cn';
import { StockActionThumbnail } from '../stock/StockActionThumbnail';
import { categoryStyle } from './notificationMeta';
import { notificationVisual } from './notificationVisual';
import { NOTIFICATION_ILLUSTRATIONS } from './notificationArtwork';
import './notification-thumbnail.css';

/** Shared by the event list and the selected event, without replacing live dossier photos. */
export function NotificationThumbnail({ notification, size = 'list' }: {
  notification: Notification; size?: 'list' | 'detail';
}) {
  const visual = notificationVisual(notification);
  const source = visual?.kind === 'illustration' ? NOTIFICATION_ILLUSTRATIONS[visual.visual] : undefined;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!visual) {
    const style = categoryStyle(notification.category);
    return <span aria-hidden="true" className={cn(
      'mt-0.5 inline-flex shrink-0 items-center justify-center rounded-lg',
      size === 'detail' ? 'size-9' : 'size-8', style.accent,
    )}>{style.icon}</span>;
  }
  return <span className="baitly-notification-thumbnail" data-size={size} aria-hidden="true">
    {visual.kind === 'stock'
      ? <StockActionThumbnail stockItemId={visual.stockItemId} name={visual.name} size={size === 'detail' ? 64 : 48} />
      : source && source !== failedSource && <img src={source} alt="" width={size === 'detail' ? 64 : 48}
          height={size === 'detail' ? 64 : 48} loading="lazy" decoding="async" draggable={false}
          onError={() => setFailedSource(source)} />}
  </span>;
}
