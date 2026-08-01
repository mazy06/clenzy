import React, { useRef, useState } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Spinner } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { Upload, Delete } from '../../../icons';
import { usersApi, type User } from '../../../services/api/usersApi';

interface AvatarUploaderProps {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'profilePictureUrl' | 'updatedAt'>;
  /** Called with the updated user after a successful upload/delete. */
  onChange?: (next: User) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const validate = (file: File): string | null => {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Format non supporté (JPEG, PNG, WebP ou GIF uniquement)';
  }
  if (file.size > MAX_BYTES) {
    return 'Fichier trop volumineux (5 Mo maximum)';
  }
  return null;
};

/**
 * Avatar uploader — drag-and-drop or click-to-upload, with delete.
 *
 * <h4>Design rules respected</h4>
 * <ul>
 *   <li>No emoji icons, no glassmorphism.</li>
 *   <li>Soft-tinted accent (var(--accent-soft)) for the drop zone.</li>
 *   <li>`prefers-reduced-motion` respected.</li>
 *   <li>Inline error feedback, no modal-first reflex.</li>
 * </ul>
 */
const AvatarUploader: React.FC<AvatarUploaderProps> = ({ user, onChange }) => {
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
      setError(issue);
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
        // borderRadius: 2 = 16px (shape.borderRadius = 8 dans le theme)
        className={cn(
          'flex items-center gap-3 p-3 rounded-[16px] border border-dashed',
          '[transition:border-color_150ms_ease,background-color_150ms_ease] motion-reduce:[transition:none]',
          dragOver ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line-2)] bg-transparent',
        )}
      >
        <div className="relative shrink-0">
          {/* Le fond accent est porte par le seul repli : l'image, quand elle
              existe, couvre entierement l'avatar. */}
          <Avatar className="size-[72px] rounded-full">
            {photoUrl && <AvatarImage src={photoUrl} alt="" />}
            <AvatarFallback className="text-[1.5rem] font-[family-name:var(--font-display)] font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-full">
              {initials}
            </AvatarFallback>
          </Avatar>
          {uploading && (
            <div className="absolute inset-[0px] rounded-[50%] bg-[rgba(15,23,42,0.45)] flex items-center justify-center">
              <Spinner className="size-[22px] text-[#FFFFFF]" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="cn-text-body1 text-[0.875rem] font-semibold">
            Photo de profil
          </p>
          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground mt-0.5">
            Glissez-déposez une image ou utilisez le bouton. JPEG, PNG, WebP ou GIF, 5 Mo max. La photo est
            synchronisée avec les OTA connectées.
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleSelect}
            style={{ display: 'none' }}
          />
          <BuiButton
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} strokeWidth={1.75} />
            {photoUrl ? 'Remplacer' : 'Téléverser'}
          </BuiButton>
          {photoUrl && (
            <BuiButton
              size="sm"
              variant="destructive"
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
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
    </div>
  );
};

export default AvatarUploader;
