import { useCallback, useState } from 'react';
import { assistantApi, type AttachmentRef, type UploadResponse } from '../services/api/assistantApi';

/**
 * Hook pour uploader des images dans le chat assistant (vision support).
 *
 * <p>Workflow :
 * <ol>
 *   <li>L'user choisit un fichier (input type=file accept=image/*)</li>
 *   <li>{@link uploadImage} valide le MIME + la taille cote client</li>
 *   <li>Si > 2MB, compression douce via Canvas (resize cote longueur + JPEG q=0.85)</li>
 *   <li>POST multipart vers {@code /api/assistant/upload}</li>
 *   <li>Retourne un {@link AttachmentRef} a placer dans la liste a injecter au chat</li>
 * </ol>
 *
 * <p>Limites alignees avec le backend :
 * <ul>
 *   <li>MIME : image/jpeg, image/png, image/gif, image/webp</li>
 *   <li>Taille : 5MB max (apres compression)</li>
 *   <li>3 images max par message (geree par le composant appelant)</li>
 * </ul>
 */

const MAX_BYTES = 5 * 1024 * 1024;
const COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const COMPRESS_MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.85;

export interface UseImageUploadResult {
  /** Upload progress en cours par index (0..1). */
  isUploading: boolean;
  /** Erreur du dernier upload (null si succes ou jamais essaye). */
  error: string | null;
  /**
   * Upload une image et retourne sa reference. Throw si validation echoue
   * (le composant appelant gere le toast/notification).
   */
  uploadImage: (file: File) => Promise<AttachmentRef>;
  /** Reset l'erreur (utile pour cacher un message d'erreur lu). */
  clearError: () => void;
}

export function useImageUpload(): UseImageUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(async (file: File): Promise<AttachmentRef> => {
    setError(null);

    if (!ACCEPTED_MIME.has(file.type)) {
      const msg = `Format non supporte (${file.type || 'inconnu'}). Formats acceptes : JPEG, PNG, GIF, WebP.`;
      setError(msg);
      throw new Error(msg);
    }

    let toUpload: File = file;
    // Compression douce pour les fichiers > 2MB (mais on garde le format d'origine
    // si ce n'est pas un JPEG/PNG — pas de re-encode WebP/GIF, ce sont deja compresses).
    if (file.size > COMPRESS_THRESHOLD_BYTES
            && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      try {
        toUpload = await compressViaCanvas(file);
      } catch (e) {
        // Si la compression echoue (canvas indispo), on retombe sur l'original
        // tant qu'il reste sous la limite serveur.
        console.warn('Image compression failed, falling back to original', e);
        toUpload = file;
      }
    }

    if (toUpload.size > MAX_BYTES) {
      const msg = `Image trop volumineuse (${formatSize(toUpload.size)}). Max ${formatSize(MAX_BYTES)}.`;
      setError(msg);
      throw new Error(msg);
    }

    setIsUploading(true);
    try {
      const response: UploadResponse = await assistantApi.uploadImage(toUpload);
      return {
        storageKey: response.storageKey,
        mediaType: response.mediaType,
        url: response.url,
        name: response.name,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload impossible";
      setError(msg);
      throw e;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { isUploading, error, uploadImage, clearError };
}

// ─── Helpers (exportes uniquement pour les tests) ───────────────────────────

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compression via Canvas : on charge l'image dans un canvas, on resize sur la
 * plus grande dimension a {@link COMPRESS_MAX_DIMENSION}, on re-exporte en JPEG
 * q=0.85. Conserve les proportions.
 *
 * Cette implementation evite d'introduire une dependance npm (browser-image-compression)
 * — suffisante pour le besoin "ne pas envoyer 10MB de RAW au serveur".
 */
async function compressViaCanvas(file: File): Promise<File> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(img.width, img.height));
  const targetW = Math.round(img.width * ratio);
  const targetH = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponible');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob a echoue'))),
      'image/jpeg', COMPRESS_QUALITY);
  });

  const compressedName = file.name.replace(/\.(png|jpe?g)$/i, '') + '-compressed.jpg';
  return new File([blob], compressedName, { type: 'image/jpeg' });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = src;
  });
}
