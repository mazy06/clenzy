import React from 'react';
import {
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Select,
  FormControl,
} from '@mui/material';
import {
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useTranslation } from '../hooks/useTranslation';

interface LanguageSwitcherProps {
  variant?: 'menu' | 'select';
  onClose?: () => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'select',
  onClose 
}) => {
  const { changeLanguage, currentLanguage, t } = useTranslation();

  const handleLanguageChange = (event: any) => {
    const newLang = event.target.value as 'fr' | 'en';
    changeLanguage(newLang);
    if (onClose) {
      onClose();
    }
  };

  if (variant === 'menu') {
    return (
      <>
        <MenuItem onClick={() => {
          changeLanguage('fr');
          if (onClose) onClose();
        }} selected={currentLanguage === 'fr'}>
          <ListItemIcon>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('navigation.languages.fr')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          changeLanguage('en');
          if (onClose) onClose();
        }} selected={currentLanguage === 'en'}>
          <ListItemIcon>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('navigation.languages.en')}</ListItemText>
        </MenuItem>
      </>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={currentLanguage}
        onChange={handleLanguageChange}
        displayEmpty
        sx={{
          '& .MuiSelect-select': {
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          },
        }}
      >
        <MenuItem value="fr">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageIcon fontSize="small" />
            <span>{t('navigation.languages.fr')}</span>
          </Box>
        </MenuItem>
        <MenuItem value="en">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LanguageIcon fontSize="small" />
            <span>{t('navigation.languages.en')}</span>
          </Box>
        </MenuItem>
      </Select>
    </FormControl>
  );
};

export default LanguageSwitcher;
