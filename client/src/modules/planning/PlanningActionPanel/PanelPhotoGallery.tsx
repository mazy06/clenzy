import React, { useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Button, Dialog, DialogContent, DialogTitle } from '../../../components/ui';
import {
  Close,
  ChevronLeft,
  ChevronRight,
  PhotoLibrary,
} from '../../../icons';

interface PanelPhotoGalleryProps {
  photos: string[];
  label: string;
  maxVisible?: number;
}

const PanelPhotoGallery: React.FC<PanelPhotoGalleryProps> = ({
  photos,
  label,
  maxVisible = 4,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex items-center gap-0.5 py-1.5">
        <span className="inline-flex text-[var(--faint)]"><PhotoLibrary size={14} strokeWidth={1.75} /></span>
        <p className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] italic">
          Aucune photo — {label}
        </p>
      </div>
    );
  }

  const visible = photos.slice(0, maxVisible);
  const extra = photos.length - maxVisible;

  return (
    <>
      <div className="flex items-center gap-0.5 mb-1">
        <span className="inline-flex text-[var(--brand-ink)]"><PhotoLibrary size={14} strokeWidth={1.75} /></span>
        <p className="cn-text-body1 text-[0.6875rem] font-semibold text-[var(--ink)]">
          {label}
        </p>
        <StatusChip size="sm" tokens={{ color: 'var(--muted)', bg: 'var(--field)' }} label={photos.length} className="ms-auto tabular-nums" />
      </div>

      <div className="grid grid-cols-2 gap-0.5 mb-1.5">
        {visible.map((url, i) => (
          <div
            key={url}
            onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
            className="relative w-full pt-[75%] rounded-[10px] overflow-hidden cursor-pointer border border-solid border-[var(--line)] transition-[opacity,border-color] duration-150 hover:opacity-85 hover:border-[var(--line-2)] motion-reduce:transition-none"
          >
            <img className="absolute top-[0px] start-[0px] w-full h-full object-cover" src={url} alt={`${label} ${i + 1}`} />
            {/* "+N" overlay on last visible */}
            {i === maxVisible - 1 && extra > 0 && (
              <div className="absolute inset-[0px] flex items-center justify-center bg-[rgba(21,36,45,.55)]">
                <p className="cn-text-body1 text-[var(--on-accent)] font-semibold text-[1rem] font-[family-name:var(--font-display)] tabular-nums">
                  +{extra}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={lightboxOpen} onOpenChange={(next) => { if (!next) setLightboxOpen(false); }}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="w-auto max-w-[90vw] max-h-[90vh] p-0 overflow-hidden border-none bg-[rgba(21,36,45,.96)]"
        >
          {/* Radix exige un titre : la visionneuse n'en affiche pas, il reste
              reserve aux technologies d'assistance. */}
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <div className="relative flex items-center justify-center min-w-[400px] min-h-[300px]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLightboxOpen(false)}
              aria-label="Fermer"
              className="absolute top-2 right-2 z-[2] text-[var(--on-accent)] hover:text-[var(--on-accent)] hover:bg-[rgba(255,255,255,.12)]"
            >
              <Close />
            </Button>

            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLightboxIndex((p) => (p > 0 ? p - 1 : photos.length - 1))}
                  aria-label="Photo precedente"
                  className="absolute left-2 z-[2] text-[var(--on-accent)] hover:text-[var(--on-accent)] hover:bg-[rgba(255,255,255,.12)]"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLightboxIndex((p) => (p < photos.length - 1 ? p + 1 : 0))}
                  aria-label="Photo suivante"
                  className="absolute right-2 z-[2] text-[var(--on-accent)] hover:text-[var(--on-accent)] hover:bg-[rgba(255,255,255,.12)]"
                >
                  <ChevronRight />
                </Button>
              </>
            )}

            <img className="max-w-[85vw] max-h-[85vh] object-contain" src={photos[lightboxIndex]} alt={`${label} ${lightboxIndex + 1}`} />

            <p className="cn-text-body1 absolute bottom-[12px] text-[var(--on-accent)] text-[0.75rem] tabular-nums">
              {lightboxIndex + 1} / {photos.length}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PanelPhotoGallery;
