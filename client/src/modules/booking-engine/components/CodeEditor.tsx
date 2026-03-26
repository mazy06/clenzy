import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'css' | 'js';
}

const PLACEHOLDERS: Record<string, string> = {
  css: `.booking-widget {\n  border-radius: 12px;\n  box-shadow: 0 4px 12px rgba(0,0,0,0.1);\n}\n\n.booking-widget .price {\n  color: #e74c3c;\n  font-weight: bold;\n}`,
  js: `// Tracking custom\nwindow.addEventListener('booking-confirmed', function(e) {\n  console.log('Reservation:', e.detail);\n  // gtag('event', 'purchase', { ... });\n});`,
};

const HELPER_KEYS: Record<string, string> = {
  css: 'bookingEngine.fields.customCssHelper',
  js: 'bookingEngine.fields.customJsHelper',
};

const CodeEditor: React.FC<CodeEditorProps> = React.memo(
  ({ value, onChange, language }) => {
    const { t } = useTranslation();

    return (
      <Box>
        <TextField
          fullWidth
          multiline
          minRows={6}
          maxRows={16}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDERS[language]}
          size="small"
          InputProps={{
            sx: {
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t(HELPER_KEYS[language])}
        </Typography>
      </Box>
    );
  }
);

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
