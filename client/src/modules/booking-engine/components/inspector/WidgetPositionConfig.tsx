import React from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Collapse } from '@mui/material';

export interface SectionTarget {
  /** CSS selector to identify the element (e.g. "#hero", "section:nth-of-type(2)", "main > section.services") */
  selector: string;
  /** Human-readable label for the dropdown */
  label: string;
}

interface WidgetPositionConfigProps {
  siteUrl: string;
  onSiteUrlChange: (url: string) => void;
  widgetPosition: 'bottom' | 'top' | 'inline';
  onWidgetPositionChange: (position: 'bottom' | 'top' | 'inline') => void;
  inlinePlacement: 'before' | 'after';
  onInlinePlacementChange: (placement: 'before' | 'after') => void;
  inlineTargetId: string;
  onInlineTargetIdChange: (id: string) => void;
  /** Dynamic section targets extracted from the site DOM */
  sectionTargets?: SectionTarget[];
}

const FALLBACK_SECTIONS: SectionTarget[] = [
  { selector: '#hero', label: '#hero' },
  { selector: '#hebergements', label: '#hebergements' },
  { selector: '#a-propos', label: '#a-propos' },
  { selector: '#avis', label: '#avis' },
  { selector: '#footer', label: '#footer' },
];

const WidgetPositionConfig: React.FC<WidgetPositionConfigProps> = ({
  siteUrl,
  onSiteUrlChange,
  widgetPosition,
  onWidgetPositionChange,
  inlinePlacement,
  onInlinePlacementChange,
  inlineTargetId,
  onInlineTargetIdChange,
  sectionTargets,
}) => {
  const sections = sectionTargets && sectionTargets.length > 0 ? sectionTargets : FALLBACK_SECTIONS;

  return (
  <>
    {/* Section header */}
    <Box sx={{
      px: 1.5, py: 0.75, fontSize: 10, fontWeight: 700, color: '#8b8fa3',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      borderBottom: '1px solid #2a2d3a', bgcolor: '#151821',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#8b8fa3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Intégration
      </Typography>
    </Box>

    <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #2a2d3a' }}>
      {/* Site URL input */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Box
          component="input"
          value={siteUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSiteUrlChange(e.target.value)}
          placeholder="https://votre-site.com"
          spellCheck={false}
          sx={{
            flex: 1, border: '1px solid #2a2d3a', borderRadius: '4px',
            px: 1, py: 0.5, fontSize: 11, fontFamily: '"SF Mono", monospace',
            bgcolor: '#151821', color: '#fff', outline: 'none',
            '&:focus': { borderColor: '#635BFF' },
            '&::placeholder': { color: '#3a3f52' },
          }}
        />
      </Box>
      <Typography sx={{ fontSize: 9, color: '#3a3f52', mt: 0.5 }}>
        URL du site cible (prochainement)
      </Typography>

      {/* Widget position */}
      <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#8b8fa3' }}>
          Position du widget
        </Typography>
        <ToggleButtonGroup
          value={widgetPosition}
          exclusive
          onChange={(_, v) => v && onWidgetPositionChange(v)}
          size="small"
          sx={{
            width: '100%',
            '& .MuiToggleButton-root': {
              flex: 1, color: '#8b8fa3', border: '1px solid #2a2d3a',
              fontSize: 11, fontWeight: 600, py: 0.5, textTransform: 'none',
              '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(99,91,255,0.2)', borderColor: '#635BFF' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            },
          }}
        >
          <ToggleButton value="bottom">Bas</ToggleButton>
          <ToggleButton value="top">Haut</ToggleButton>
          <ToggleButton value="inline">Inline</ToggleButton>
        </ToggleButtonGroup>

        {/* Inline options */}
        <Collapse in={widgetPosition === 'inline'}>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Box
                component="select"
                value={inlinePlacement}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onInlinePlacementChange(e.target.value as 'before' | 'after')}
                sx={{
                  width: 70, border: '1px solid #2a2d3a', borderRadius: '4px',
                  px: 0.5, py: 0.5, fontSize: 11, fontFamily: '"SF Mono", monospace',
                  bgcolor: '#151821', color: '#fff', outline: 'none', cursor: 'pointer',
                  '&:focus': { borderColor: '#635BFF' },
                  '& option': { bgcolor: '#1a1d27', color: '#fff' },
                }}
              >
                <option value="before">Avant</option>
                <option value="after">Apres</option>
              </Box>
              <Box
                component="select"
                value={inlineTargetId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onInlineTargetIdChange(e.target.value)}
                sx={{
                  flex: 1, border: '1px solid #2a2d3a', borderRadius: '4px',
                  px: 0.5, py: 0.5, fontSize: 11, fontFamily: '"SF Mono", monospace',
                  bgcolor: '#151821', color: '#fff', outline: 'none', cursor: 'pointer',
                  '&:focus': { borderColor: '#635BFF' },
                  '& option': { bgcolor: '#1a1d27', color: '#fff' },
                }}
              >
                {sections.map((s) => (
                  <option key={s.selector} value={s.selector}>{s.label}</option>
                ))}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 9, color: '#3a3f52' }}>
              Positionner le widget avant ou apres la section ciblee
            </Typography>
          </Box>
        </Collapse>
      </Box>
    </Box>
  </>
  );
};

export default WidgetPositionConfig;
