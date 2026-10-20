import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui';
import { UserRound } from '../../icons/glyphs';
import { userAvatarSrc } from '../../services/api/usersApi';
import type { BaitlyCrmDetails } from '../../services/api/baitlyCrmDetailsApi';

/** Photo du responsable, puis initiales ou silhouette si elle est absente ou illisible. */
export default function BaitlyCrmAssigneeAvatar({ details }: { details?: BaitlyCrmDetails }) {
  const name = details?.assignee_unavailable ? undefined : details?.assigned_user_name;
  const src = name ? userAvatarSrc({ profilePictureUrl: details?.assigned_user_avatar_url }) : undefined;
  return <Avatar className="bcrm-person-avatar" aria-hidden>
    <AvatarImage src={src} alt="" />
    <AvatarFallback className="text-[9px]">
      {name ? name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('') : <UserRound size={17} />}
    </AvatarFallback>
  </Avatar>;
}
