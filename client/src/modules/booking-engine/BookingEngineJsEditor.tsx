import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

interface BookingEngineJsEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const BookingEngineJsEditor: React.FC<BookingEngineJsEditorProps> = React.memo(
  ({ value, onChange }) => {
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
          placeholder={`// Tracking custom\nwindow.addEventListener('booking-confirmed', function(e) {\n  console.log('Reservation:', e.detail);\n  // gtag('event', 'purchase', { ... });\n});`}
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
          {t('bookingEngine.fields.customJsHelper')}
        </Typography>
      </Box>
    );
  }
);

BookingEngineJsEditor.displayName = 'BookingEngineJsEditor';

export default BookingEngineJsEditor;
