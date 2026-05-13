import React, { useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close, ChevronLeft, ChevronRight, People, SquareFoot,
  KingBed, Bathtub, PhotoLibrary, AccessTime, CheckCircle,
} from '../../../icons';
import type { ResolvedTokens, PreviewProperty } from '../types/bookingEngine';
import type { BookingI18n } from '../sdk/i18n';

interface PropertyDetailPanelProps {
  property: PreviewProperty;
  tk: ResolvedTokens;
  i18n: BookingI18n;
  onClose: () => void;
}

/** Convert amenity codes (WIFI, AIR_CONDITIONING) to human-readable labels */
const formatAmenity = (code: string): string => {
  const labels: Record<string, string> = {
    WIFI: 'Wi-Fi', TV: 'TV', HEATING: 'Chauffage', AIR_CONDITIONING: 'Climatisation',
    MICROWAVE: 'Micro-ondes', DISHWASHER: 'Lave-vaisselle', EQUIPPED_KITCHEN: 'Cuisine équipée',
    OVEN: 'Four', WASHING_MACHINE: 'Lave-linge', HAIR_DRYER: 'Sèche-cheveux',
    DRYER: 'Sèche-linge', POOL: 'Piscine', BARBECUE: 'Barbecue', JACUZZI: 'Jacuzzi',
    IRON: 'Fer à repasser', PARKING: 'Parking', GARDEN_TERRACE: 'Jardin / Terrasse',
    HIGH_CHAIR: 'Chaise haute', BABY_BED: 'Lit bébé', SAFE: 'Coffre-fort',
    FIREPLACE: 'Cheminée', BALCONY: 'Balcon', SEA_VIEW: 'Vue mer',
    MOUNTAIN_VIEW: 'Vue montagne', ELEVATOR: 'Ascenseur', WHEELCHAIR_ACCESSIBLE: 'Accessible PMR',
    PET_FRIENDLY: 'Animaux acceptés', PRIVATE_ENTRANCE: 'Entrée privée',
    WORKSPACE: 'Espace de travail', SMART_LOCK: 'Serrure connectée',
  };
  return labels[code] || code.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
};

const PropertyDetailPanel: React.FC<PropertyDetailPanelProps> = ({ property, tk, i18n, onClose }) => {
  const photoUrls = property.photoUrls ?? [];
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hasMultiple = photoUrls.length > 1;

  const infoItems = [
    { icon: <People size={18} strokeWidth={1.75} />, value: property.maxGuests, suffix: ` ${i18n.t('detail.guests')}` },
    { icon: <SquareFoot size={18} strokeWidth={1.75} />, value: property.squareMeters, suffix: ` ${i18n.t('detail.surface')}` },
    { icon: <KingBed size={18} strokeWidth={1.75} />, value: property.bedroomCount, suffix: ` ${i18n.t('detail.bedrooms')}` },
    { icon: <Bathtub size={18} strokeWidth={1.75} />, value: property.bathroomCount, suffix: ` ${i18n.t('detail.bathrooms')}` },
  ].filter(item => item.value != null && item.value > 0);

  return (
    <>
      {/* Backdrop */}
      <Box onClick={onClose} sx={{
        position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)',
        zIndex: 1200, transition: 'opacity 0.3s',
      }} />

      {/* Panel */}
      <Box sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: { xs: '100%', sm: 440 }, maxWidth: '100vw',
        bgcolor: tk.surface, zIndex: 1201, overflow: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.3s ease-out',
        '@keyframes slideInRight': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      }}>
        {/* Header */}
        <Box sx={{
          bgcolor: tk.secondary, color: '#fff', px: 3, py: 2.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: tk.primary, mb: 0.25 }}>
              {i18n.tObject('propertyTypes')[property.type] || property.type}
            </Typography>
            <Typography sx={{ fontFamily: tk.headingFont, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {property.name}
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#fff', ml: 1 }}>
            <Close />
          </IconButton>
        </Box>

        {/* Photo carousel */}
        <Box sx={{
          position: 'relative', width: '100%', height: 260, bgcolor: tk.secondary, overflow: 'hidden',
          cursor: photoUrls.length > 0 ? 'pointer' : 'default',
        }} onClick={() => { if (photoUrls.length > 0) setLightboxOpen(true); }}>
          {photoUrls.length > 0 ? (
            <Box component="img" src={photoUrls[photoIdx]} alt={property.name} sx={{
              width: '100%', height: '100%', objectFit: 'cover',
            }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'rgba(255,255,255,0.3)' }}><PhotoLibrary size={48} strokeWidth={1.75} /></Box>
            </Box>
          )}
          {hasMultiple && (
            <>
              <IconButton size="small" onClick={() => setPhotoIdx(i => i <= 0 ? photoUrls.length - 1 : i - 1)} sx={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.85)', width: 32, height: 32, '&:hover': { bgcolor: '#fff' },
              }}>
                <ChevronLeft size={20} strokeWidth={1.75} />
              </IconButton>
              <IconButton size="small" onClick={() => setPhotoIdx(i => i >= photoUrls.length - 1 ? 0 : i + 1)} sx={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.85)', width: 32, height: 32, '&:hover': { bgcolor: '#fff' },
              }}>
                <ChevronRight size={20} strokeWidth={1.75} />
              </IconButton>
              <Box sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0.5 }}>
                {photoUrls.map((_, i) => (
                  <Box key={i} onClick={() => setPhotoIdx(i)} sx={{
                    width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                    bgcolor: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.8)',
                  }} />
                ))}
              </Box>
            </>
          )}
        </Box>

        {/* Info chips */}
        {infoItems.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, px: 3, py: 2.5, borderBottom: `1px solid ${tk.border}` }}>
            {infoItems.map((item, idx) => (
              <Box key={idx} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.5, py: 0.75, borderRadius: tk.radiusSm,
                bgcolor: tk.surfaceMuted, color: tk.text,
              }}>
                <Box sx={{ color: tk.primary, display: 'flex' }}>{item.icon}</Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  {item.value}{item.suffix}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Check-in / Check-out times */}
        {(property.checkInTime || property.checkOutTime) && (
          <Box sx={{ display: 'flex', gap: 3, px: 3, py: 2, borderBottom: `1px solid ${tk.border}` }}>
            {property.checkInTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: tk.primary }}><AccessTime size={16} strokeWidth={1.75} /></Box>
                <Typography sx={{ fontSize: 12, color: tk.textLabel }}>
                  {i18n.t('detail.checkIn')}: <Box component="span" sx={{ fontWeight: 600, color: tk.text }}>{property.checkInTime}</Box>
                </Typography>
              </Box>
            )}
            {property.checkOutTime && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: tk.primary }}><AccessTime size={16} strokeWidth={1.75} /></Box>
                <Typography sx={{ fontSize: 12, color: tk.textLabel }}>
                  {i18n.t('detail.checkOut')}: <Box component="span" sx={{ fontWeight: 600, color: tk.text }}>{property.checkOutTime}</Box>
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Description */}
        <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${tk.border}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.3, mb: 1.5 }}>
            {i18n.t('detail.description')}
          </Typography>
          <Typography sx={{ fontSize: 13, color: tk.text, lineHeight: 1.7, opacity: 0.85 }}>
            {property.description || i18n.t('detail.noDescription')}
          </Typography>
        </Box>

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${tk.border}` }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tk.text, textTransform: 'uppercase', letterSpacing: 0.3, mb: 1.5 }}>
              {i18n.t('detail.amenities')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {property.amenities.map((amenity, idx) => (
                <Box key={idx} sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.5, py: 0.5, borderRadius: tk.radiusSm,
                  border: `1px solid ${tk.border}`, fontSize: 12, color: tk.text,
                }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: tk.primary }}><CheckCircle size={14} strokeWidth={1.75} /></Box>
                  {formatAmenity(amenity)}
                </Box>
              ))}
            </Box>
          </Box>
        )}

      </Box>

      {/* ── Fullscreen lightbox ── */}
      {lightboxOpen && photoUrls.length > 0 && (
        <Box onClick={() => setLightboxOpen(false)} sx={{
          position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.92)',
          zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          {/* Photo */}
          <Box component="img" src={photoUrls[photoIdx]} alt={property.name}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{
              maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain',
              borderRadius: '4px', cursor: 'default',
            }}
          />

          {/* Close button */}
          <IconButton onClick={() => setLightboxOpen(false)} sx={{
            position: 'absolute', top: 16, right: 16, color: '#fff',
            bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
          }}>
            <Close />
          </IconButton>

          {/* Counter */}
          <Typography sx={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500,
          }}>
            {photoIdx + 1} / {photoUrls.length}
          </Typography>

          {/* Prev / Next */}
          {hasMultiple && (
            <>
              <IconButton onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => i <= 0 ? photoUrls.length - 1 : i - 1); }} sx={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', width: 44, height: 44,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              }}>
                <ChevronLeft size={28} strokeWidth={1.75} />
              </IconButton>
              <IconButton onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => i >= photoUrls.length - 1 ? 0 : i + 1); }} sx={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', width: 44, height: 44,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              }}>
                <ChevronRight size={28} strokeWidth={1.75} />
              </IconButton>
            </>
          )}
        </Box>
      )}
    </>
  );
};

export default PropertyDetailPanel;
