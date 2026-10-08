import { cn } from '../../../utils/cn';

/** Static portrait shared by the assistant header, invitation and replies. */
export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <img
      src="/images/assistant/baitly-assistant.webp"
      alt=""
      width={512}
      height={512}
      draggable={false}
      className={cn('baitly-assistant-avatar', className)}
    />
  );
}
