import React, { useRef, useState } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Spinner } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { Upload, Delete } from '../../../icons';
import { usersApi, type User } from '../../../services/api/usersApi';
import { useTranslation } from '../../../hooks/useTranslation';

interface AvatarUploaderProps {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'profilePictureUrl' | 'updatedAt'>;
  /** Called with the updated user after a successful upload/delete. */
  onChange?: (next: User) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const validate = (file: File): string | null => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'users.avatarFormat';
  }
  if (file.size > MAX_BYTES) {
    return 'users.avatarTooLarge';
  }
  return null;
};

const AvatarUploader: React.FC<AvatarUploaderProps> = ({ user, onChange }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = `${(user.firstName || '').charAt(0)}${(user.lastName || '').charAt(0)}`.toUpperCase() || '?';
  const photoUrl = user.profilePictureUrl
    ? usersApi.profilePictureUrl(user.id, user.updatedAt ?? null)
    : null;

  const upload = async (file: File) => {
    const issue = validate(file);
    if (issue) {
      setError(t(issue));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const updated = await usersApi.uploadProfilePicture(user.id, file);
      onChange?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const handleDelete = async () => {
    if (!photoUrl) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await usersApi.deleteProfilePicture(user.id);
      onChange?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-md',
          'transition-colors duration-150 ease-out-quart motion-reduce:transition-none',
          dragOver ? 'bg-primary-soft outline-2 outline-dashed outline-primary outline-offset-8' : 'bg-transparent',
        )}
      >
        <div className="relative row-span-2 self-start shrink-0">
          {/* Le fond accent est porte par le seul repli : l'image, quand elle
              existe, couvre entierement l'avatar. */}
          <Avatar className="size-14 rounded-full sm:size-16">
            {photoUrl && <AvatarImage src={photoUrl} alt={`${user.firstName} ${user.lastName}`} />}
            <AvatarFallback className="text-xl font-semibold text-primary-foreground bg-primary rounded-full">
              {initials}
            </AvatarFallback>
          </Avatar>
          {uploading && (
            // Voile teinte vers le bleu nuit de la marque, jamais du noir pur.
            <div className="absolute inset-0 rounded-full bg-[rgba(15,23,42,0.45)] flex items-center justify-center">
              <Spinner className="size-[22px] text-primary-foreground dark:text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* `m-0` : sans preflight Tailwind, un <p> natif reprend les marges UA
              que neutralisait `cn-text-*`. */}
          <p className="m-0 text-base font-semibold text-foreground [overflow-wrap:anywhere]">
            {user.firstName} {user.lastName}
          </p>
          <p className="m-0 mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
            {t('users.form.photoHint')}
          </p>
        </div>
        <div className="col-start-2 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleSelect}
            style={{ display: 'none' }}
          />
          {/* type="button" : ce composant vit DANS le <form> de la fiche
              utilisateur. Sans type, le bouton soumettait la fiche, qui
              redirigeait avant que le fichier choisi ne soit envoyé. */}
          <BuiButton
            type="button"
            size="sm"
            className="min-h-9 cursor-pointer"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} strokeWidth={1.75} />
            {photoUrl ? 'Remplacer' : t('common.upload')}
          </BuiButton>
          {photoUrl && (
            <BuiButton
              type="button"
              size="sm"
              className="min-h-9 cursor-pointer text-destructive-ink"
              variant="ghost"
              disabled={uploading}
              onClick={handleDelete}
            >
              <Delete size={16} strokeWidth={1.75} />
              Retirer
            </BuiButton>
          )}
        </div>
      </div>
      {error && (
        <BuiAlert variant="destructive" className="py-0.5 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton type="button" variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
    </div>
  );
};

export default AvatarUploader;
