import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

interface BookingEngineCssEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const BookingEngineCssEditor: React.FC<BookingEngineCssEditorProps> = React.memo(
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
          placeholder={`.booking-widget {\n  border-radius: 12px;\n  box-shadow: 0 4px 12px rgba(0,0,0,0.1);\n}\n\n.booking-widget .price {\n  color: #e74c3c;\n  font-weight: bold;\n}`}
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
          {t('bookingEngine.fields.customCssHelper')}
        </Typography>
      </Box>
    );
  }
);

BookingEngineCssEditor.displayName = 'BookingEngineCssEditor';

export default BookingEngineCssEditor;
