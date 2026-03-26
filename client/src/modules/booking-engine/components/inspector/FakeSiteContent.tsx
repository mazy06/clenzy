import React from 'react';
import { Box, Typography } from '@mui/material';

const FONT_FAMILY = 'Inter, system-ui, -apple-system, sans-serif';

// ─── Navbar ─────────────────────────────────────────────────────────────────

const Navbar: React.FC = () => (
  <Box sx={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    px: 3, py: 1.5, borderBottom: '1px solid #e5e7eb', bgcolor: '#fff',
    position: 'sticky', top: 0, zIndex: 5,
    order: 0,
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '6px', bgcolor: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>V</Typography>
      </Box>
      <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Villa Serena</Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 2.5 }}>
      {['Accueil', 'Nos villas', 'Tarifs', 'Contact'].map((label) => (
        <Typography key={label} sx={{ fontFamily: FONT_FAMILY, fontSize: 12, color: '#6b7280', cursor: 'default', '&:hover': { color: '#374151' } }}>{label}</Typography>
      ))}
    </Box>
  </Box>
);

// ─── Hero ───────────────────────────────────────────────────────────────────

const HeroSection: React.FC = () => (
  <Box id="hero" sx={{
    order: 2, height: 280,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    color: '#fff', textAlign: 'center', px: 4, position: 'relative',
  }}>
    <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: 800, mb: 1, textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
      Votre havre de paix
    </Typography>
    <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 14, opacity: 0.85, maxWidth: 420 }}>
      Des villas d'exception au coeur de la Provence, pour des sejours inoubliables.
    </Typography>
  </Box>
);

// ─── Hebergements ───────────────────────────────────────────────────────────

const VILLAS = [
  { name: 'Villa Lavande', type: 'Villa 4 chambres', price: '180' },
  { name: 'Mas des Oliviers', type: 'Mas 3 chambres', price: '145' },
  { name: 'Bastide du Soleil', type: 'Bastide 5 chambres', price: '220' },
];

const HebergementsSection: React.FC = () => (
  <Box id="hebergements" sx={{ order: 4, px: 4, py: 4, maxWidth: 900, mx: 'auto' }}>
    <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: '#1f2937', mb: 0.5 }}>Nos hebergements</Typography>
    <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 13, color: '#6b7280', mb: 3 }}>Decouvrez nos villas soigneusement selectionnees</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
      {VILLAS.map((villa) => (
        <Box key={villa.name} sx={{ borderRadius: 2, border: '1px solid #e5e7eb', overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ height: 120, bgcolor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 28, opacity: 0.15 }}>&#x1F3E0;</Typography>
          </Box>
          <Box sx={{ p: 1.5 }}>
            <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{villa.name}</Typography>
            <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 11, color: '#9ca3af', mb: 1 }}>{villa.type}</Typography>
            <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 700, color: '#667eea' }}>
              {villa.price} EUR
              <Typography component="span" sx={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}> /nuit</Typography>
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);

// ─── A propos ───────────────────────────────────────────────────────────────

const AboutSection: React.FC = () => (
  <Box id="a-propos" sx={{ order: 6, px: 4, py: 4, bgcolor: '#f9fafb' }}>
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: '#1f2937', mb: 2 }}>A propos</Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 280px' }}>
          <Box sx={{ height: 6, bgcolor: '#e5e7eb', borderRadius: 1, width: '100%', mb: 1 }} />
          <Box sx={{ height: 6, bgcolor: '#e5e7eb', borderRadius: 1, width: '90%', mb: 1 }} />
          <Box sx={{ height: 6, bgcolor: '#e5e7eb', borderRadius: 1, width: '75%', mb: 2 }} />
          <Box sx={{ height: 6, bgcolor: '#e5e7eb', borderRadius: 1, width: '95%', mb: 1 }} />
          <Box sx={{ height: 6, bgcolor: '#e5e7eb', borderRadius: 1, width: '60%' }} />
        </Box>
        <Box sx={{ flex: '1 1 280px', height: 140, bgcolor: '#e5e7eb', borderRadius: 2 }} />
      </Box>
    </Box>
  </Box>
);

// ─── Avis clients ───────────────────────────────────────────────────────────

const REVIEWS = [
  { initials: 'MC', stars: 5 },
  { initials: 'PD', stars: 4 },
  { initials: 'SL', stars: 5 },
];

const ReviewsSection: React.FC = () => (
  <Box id="avis" sx={{ order: 8, px: 4, py: 4, maxWidth: 900, mx: 'auto' }}>
    <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: '#1f2937', mb: 3 }}>Avis clients</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
      {REVIEWS.map((review, i) => (
        <Box key={i} sx={{ p: 2, borderRadius: 2, border: '1px solid #e5e7eb', bgcolor: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{review.initials}</Typography>
            </Box>
            <Box>
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <Typography key={j} sx={{ fontSize: 12, color: j < review.stars ? '#f59e0b' : '#d1d5db' }}>&#9733;</Typography>
                ))}
              </Box>
            </Box>
          </Box>
          <Box sx={{ height: 5, bgcolor: '#f3f4f6', borderRadius: 1, width: '100%', mb: 0.75 }} />
          <Box sx={{ height: 5, bgcolor: '#f3f4f6', borderRadius: 1, width: '85%', mb: 0.75 }} />
          <Box sx={{ height: 5, bgcolor: '#f3f4f6', borderRadius: 1, width: '65%' }} />
        </Box>
      ))}
    </Box>
  </Box>
);

// ─── Footer ─────────────────────────────────────────────────────────────────

const FooterSection: React.FC = () => (
  <Box id="footer" sx={{ order: 10, px: 4, py: 3, bgcolor: '#1f2937', mt: 2 }}>
    <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
      <Box>
        <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: 700, color: '#fff', mb: 1 }}>Villa Serena</Typography>
        <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 11, color: '#9ca3af' }}>123 Chemin des Lavandes</Typography>
        <Typography sx={{ fontFamily: FONT_FAMILY, fontSize: 11, color: '#9ca3af' }}>84000 Avignon, France</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 3 }}>
        {['Mentions legales', 'CGV', 'Contact'].map((label) => (
          <Typography key={label} sx={{ fontFamily: FONT_FAMILY, fontSize: 11, color: '#9ca3af', cursor: 'default' }}>{label}</Typography>
        ))}
      </Box>
    </Box>
  </Box>
);

// ─── FakeSiteContent (composed) ─────────────────────────────────────────────

const FakeSiteContent: React.FC = () => (
  <>
    <Navbar />
    <HeroSection />
    <HebergementsSection />
    <AboutSection />
    <ReviewsSection />
    <FooterSection />
  </>
);

export default FakeSiteContent;
