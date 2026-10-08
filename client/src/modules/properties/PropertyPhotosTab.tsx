import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { PROPERTY_ART } from './propertyArtwork';
import { PropertyTabHeading, PropertyTabLoading, PropertyTabEmpty } from './PropertyTabPrimitives';
import { Button } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { useQueryClient } from '@tanstack/react-query';
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
  canEdit?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ───────────────────────────────────────────────────────────────

const PropertyPhotosTab: React.FC<PropertyPhotosTabProps> = ({ propertyId, canEdit = false }) => {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Flag d'upload jamais lu au render : ref servant de garde anti-double-upload.
  const uploadingRef = useRef(false);

  // ── Load photos from API on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setPhotos([]);
    propertyPhotosApi.list(propertyId)
      .then((data: PropertyPhotoDto[]) => {
        if (cancelled) return;
        setPhotos([...data].sort((a,b) => a.sortOrder-b.sortOrder || a.id-b.id).map((dto) => ({
          id: String(dto.id),
          url: propertyPhotosApi.getPhotoUrl(propertyId, dto.id),
          name: dto.originalFilename || `photo-${dto.id}`,
          apiId: dto.id,
        })));
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, retry]);

  // ── Upload files via API ─────────────────────────────────────────────────
  const addFiles = useCallback(async (files: FileList | null) => {
    if (!canEdit || !files || files.length === 0) return;
    if (uploadingRef.current) return; // anti double-upload
    uploadingRef.current = true;
    setUploading(true);
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
      setUploading(false);
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
  }, [propertyId, canEdit, notify, queryClient]);

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
    if (!canEdit || !deleteTarget || deleting) return;
    setDeleting(true);
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
      setDeleting(false);
    }
  }, [deleteTarget, propertyId, canEdit, deleting, notify, queryClient]);

  const selected = photos.find(photo => photo.id === selectedId) ?? photos[0];
  const uploadButton = <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
    {uploading ? <Spinner className="size-4" /> : <ImagePlus size={16} />}
    {t('properties.photos.upload')}
  </Button>;
  const headerActions = usePageHeaderActions(canEdit ? uploadButton : null);

  return (
    <div className="pdt-page">
      {headerActions}
      <input ref={fileInputRef} type="file" accept="image/*" multiple hidden disabled={!canEdit || uploading} onChange={handleFileChange} />
      <section className="pdt-surface">
        <PropertyTabHeading art={PROPERTY_ART.photos} title={t('properties.photos.title')}
          description={t('properties.photos.channelSync')} actions={<span className="text-xs tabular-nums text-muted-foreground">{photos.length} {t('properties.tabs.photos')}</span>} />
        {loading ? <PropertyTabLoading /> : loadError ? <Alert variant="destructive">
          <AlertDescription>{t('propertyTabs.photosLoadError', 'Impossible de charger les photos.')}</AlertDescription>
          <Button variant="outline" onClick={() => setRetry(value => value+1)}>{t('common.retry', 'Réessayer')}</Button>
        </Alert> : selected ? <div className="pdt-photo-layout">
          <div className="pdt-photo-grid" aria-label={t('properties.photos.title')}>
            {photos.map((photo,index) => <button className="pdt-photo-thumb" key={photo.id} type="button" aria-pressed={selected.id === photo.id}
              onClick={() => setSelectedId(photo.id)}>
              <img src={photo.url} alt={photo.name} loading="lazy" /><span>{index+1}. {photo.name}</span>
            </button>)}
          </div>
          <figure className="pdt-photo-preview">
            <img src={selected.url} alt={selected.name} />
            <footer><figcaption>{selected.name}</figcaption>{canEdit && <Button variant="outline" size="icon" aria-label={t('common.delete')} onClick={() => setDeleteTarget(selected)}>
              <Trash2 size={16} />
            </Button>}</footer>
          </figure>
        </div> : <PropertyTabEmpty art={PROPERTY_ART.photos} title={t('properties.photos.empty')} description={t('properties.photos.emptyDesc')} />}
        {canEdit && <div className="pdt-drop" data-drag={isDragOver}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <p>{t('properties.photos.dragDrop')}<br />{t('properties.photos.maxSize')}</p>{uploadButton}
        </div>}
      </section>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      {/* maxWidth="xs" MUI = 444 px. */}
      <Dialog open={deleteTarget !== null} onOpenChange={(next) => { if (!next && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('properties.photos.deleteConfirm')}</DialogTitle>
            <DialogDescription>{deleteTarget?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDeleteConfirm}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyPhotosTab;
