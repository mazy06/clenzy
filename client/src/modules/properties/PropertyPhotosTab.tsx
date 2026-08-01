import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Button } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  CloudUpload,
  Delete,
  AddPhotoAlternate,
  PhotoLibrary,
} from '../../icons';
import { useQueryClient } from '@tanstack/react-query';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { propertyDetailsKeys } from '../../hooks/usePropertyDetails';
import { propertyPhotosApi, type PropertyPhotoDto } from '../../services/api/propertyPhotosApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropertyPhoto {
  id: string;
  url: string;
  name: string;
  apiId?: number; // DB id for API operations
}

interface PropertyPhotosTabProps {
  propertyId: number;
}

// ─── Stable sx constants ─────────────────────────────────────────────────────

// .fr-sec — overline de section (tokens baseline).
const SECTION_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--faint)',
  mb: 1,
} as const;

/** Report en classes de `SECTION_TITLE_SX`. */
const SECTION_TITLE_CLASS = 'text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)] mb-1.5';

// .pd-card — carte hairline r14 plate.
const CARD_CLASS = 'border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] px-[18px] py-4';

// Dropzone — pattern manquant au baseline (signalé) : dérivé minimal en tokens
// (tirets --line-2, hover/drag accent + accent-soft), aucun style inventé au-delà.
const DROP_ZONE_CLASS = 'border-2 border-dashed border-[var(--line-2)] rounded-[11px] p-[18px] flex flex-col items-center justify-center cursor-pointer transition-[border-color,background-color] duration-[140ms] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ───────────────────────────────────────────────────────────────

const PropertyPhotosTab: React.FC<PropertyPhotosTabProps> = ({ propertyId }) => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  // Flag d'upload jamais lu au render : ref servant de garde anti-double-upload.
  const uploadingRef = useRef(false);

  // ── Load photos from API on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    propertyPhotosApi.list(propertyId)
      .then((data: PropertyPhotoDto[]) => {
        if (cancelled) return;
        setPhotos(data.map((dto) => ({
          id: String(dto.id),
          url: propertyPhotosApi.getPhotoUrl(propertyId, dto.id),
          name: dto.originalFilename || `photo-${dto.id}`,
          apiId: dto.id,
        })));
      })
      .catch(() => { /* silent — empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  // ── Upload files via API ─────────────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (uploadingRef.current) return; // anti double-upload
    uploadingRef.current = true;
    let uploaded = 0;
    let skippedTooLarge = 0;
    let skippedNotImage = 0;
    let failed = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          skippedNotImage++;
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          skippedTooLarge++;
          continue;
        }
        try {
          const dto = await propertyPhotosApi.upload(propertyId, file);
          setPhotos((prev) => [...prev, {
            id: String(dto.id),
            url: propertyPhotosApi.getPhotoUrl(propertyId, dto.id),
            name: dto.originalFilename || file.name,
            apiId: dto.id,
          }]);
          uploaded++;
        } catch (err) {
          failed++;
          const message = err instanceof Error ? err.message : 'Erreur inconnue';
          notify.error(`Échec upload "${file.name}" : ${message}`);
        }
      }
    } finally {
      uploadingRef.current = false;
    }
    if (skippedTooLarge > 0) {
      notify.warning(`${skippedTooLarge} photo(s) ignorée(s) : taille > 10 Mo`);
    }
    if (skippedNotImage > 0) {
      notify.warning(`${skippedNotImage} fichier(s) ignoré(s) : format non image`);
    }
    if (uploaded > 0 && failed === 0 && skippedTooLarge === 0 && skippedNotImage === 0) {
      notify.success(`${uploaded} photo(s) ajoutée(s)`);
    }
    if (uploaded > 0) {
      queryClient.invalidateQueries({ queryKey: propertyDetailsKeys.detail(String(propertyId)) });
      queryClient.invalidateQueries({ queryKey: ['property-photos', String(propertyId)] });
    }
  }, [propertyId, notify, queryClient]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(e.target.files);
      if (e.target) e.target.value = '';
    },
    [addFiles],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.apiId) {
        await propertyPhotosApi.delete(propertyId, deleteTarget.apiId);
      }
      setPhotos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      queryClient.invalidateQueries({ queryKey: propertyDetailsKeys.detail(String(propertyId)) });
      queryClient.invalidateQueries({ queryKey: ['property-photos', String(propertyId)] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      notify.error(`Échec suppression : ${message}`);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, propertyId, notify, queryClient]);

  const hasPhotos = photos.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Sync info banner ─────────────────────────────────────────────── */}
      <Alert variant="info" className="text-[0.75rem]">
        <Info />
        <AlertDescription>{t('properties.photos.channelSync')}</AlertDescription>
      </Alert>

      {/* ── Upload zone ──────────────────────────────────────────────────── */}
      <div className={CARD_CLASS}>
        <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>{t('properties.photos.upload')}</p>
        <div
          className={cn(DROP_ZONE_CLASS, isDragOver && 'border-[var(--accent)] bg-[var(--accent-soft)]')}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="inline-flex text-muted-foreground opacity-60 mb-1.5"><CloudUpload size={36} strokeWidth={1.5} /></span>
          <p className="cn-text-body1 text-[0.8125rem] font-medium text-muted-foreground text-center">
            {t('properties.photos.dragDrop')}
          </p>
          <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60 mt-0.5">
            {t('properties.photos.maxSize')}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-6">
          <Spinner className="size-7" />
        </div>
      )}

      {/* ── Photo grid or empty state ────────────────────────────────────── */}
      {!loading && hasPhotos ? (
        <div className={CARD_CLASS}>
          <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
            {t('properties.photos.title')} ({photos.length})
          </p>
          <div className="grid grid-cols-[repeat(2,_1fr)] min-[600px]:grid-cols-[repeat(3,_1fr)] min-[900px]:grid-cols-[repeat(4,_1fr)] gap-1.5">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative rounded-[11px] overflow-hidden border border-solid border-[var(--line)] aspect-[4/3] [&:hover_.photo-overlay]:opacity-100"
              >
                <img className="w-full h-full object-cover block" src={photo.url} alt={photo.name} />
                <div className="photo-overlay absolute inset-0 bg-[rgba(10,18,24,0.42)] opacity-0 transition-opacity duration-200 flex items-start justify-end p-[3px]">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleteTarget(photo)}
                    className="rounded-[10px] bg-[rgba(255,255,255,0.92)] text-[#2A3942] hover:bg-[rgba(255,255,255,1)] hover:text-[var(--err)]"
                  >
                    <Delete size={16} strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add more button */}
            {/* `borderColor: 'divider'` (jeton MUI) => var(--line). */}
            <div
              className={cn(DROP_ZONE_CLASS, 'p-0 aspect-[4/3] border-[var(--line)]')}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="inline-flex text-muted-foreground opacity-60"><AddPhotoAlternate size={28} strokeWidth={1.5} /></span>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <EmptyState
          icon={<PhotoLibrary />}
          title={t('properties.photos.empty')}
          description={t('properties.photos.emptyDesc')}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUpload size={18} strokeWidth={1.75} />
              {t('properties.photos.upload')}
            </Button>
          }
        />
      ) : null}

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      {/* maxWidth="xs" MUI = 444 px. */}
      <Dialog open={deleteTarget !== null} onOpenChange={(next) => { if (!next) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('properties.photos.deleteConfirm')}</DialogTitle>
            <DialogDescription>{deleteTarget?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirm}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyPhotosTab;
