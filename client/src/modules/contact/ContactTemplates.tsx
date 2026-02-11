import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemText,
  Typography,
  Divider,
  Box
} from '@mui/material';
import {
  Description as TemplateIcon
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';

interface MessageTemplate {
  id: string;
  label: string;
  text: string;
}

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'acknowledge',
    label: 'Accus\u00e9 de r\u00e9ception',
    text: 'Merci pour votre message. Nous avons bien re\u00e7u votre demande et nous vous r\u00e9pondrons dans les plus brefs d\u00e9lais.'
  },
  {
    id: 'schedule',
    label: 'Planification',
    text: 'Nous avons planifi\u00e9 une intervention pour r\u00e9pondre \u00e0 votre demande. Vous serez notifi\u00e9 des d\u00e9tails prochainement.'
  },
  {
    id: 'completed',
    label: 'Travaux termin\u00e9s',
    text: 'Les travaux demand\u00e9s ont \u00e9t\u00e9 effectu\u00e9s avec succ\u00e8s. N\'h\u00e9sitez pas \u00e0 nous contacter si vous avez des questions.'
  },
  {
    id: 'info_needed',
    label: 'Informations requises',
    text: 'Afin de traiter votre demande, nous aurions besoin d\'informations compl\u00e9mentaires. Pourriez-vous nous pr\u00e9ciser :'
  },
  {
    id: 'urgent',
    label: 'Urgence',
    text: 'Votre demande a \u00e9t\u00e9 class\u00e9e comme urgente. Notre \u00e9quipe d\'intervention va prendre en charge cette situation dans les plus brefs d\u00e9lais.'
  }
];

interface ContactTemplatesProps {
  onSelectTemplate: (text: string) => void;
}

const ContactTemplates: React.FC<ContactTemplatesProps> = ({ onSelectTemplate }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectTemplate = (template: MessageTemplate) => {
    onSelectTemplate(template.text);
    handleClose();
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<TemplateIcon />}
        onClick={handleClick}
        sx={{ minWidth: 'auto', whiteSpace: 'nowrap' }}
      >
        {t('contact.templates')}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { maxWidth: 400, maxHeight: 350 }
          }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {t('contact.templates')}
          </Typography>
        </Box>
        <Divider />
        {MESSAGE_TEMPLATES.map((template) => (
          <MenuItem
            key={template.id}
            onClick={() => handleSelectTemplate(template)}
            sx={{ whiteSpace: 'normal', py: 1.5 }}
          >
            <ListItemText
              primary={template.label}
              secondary={
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {template.text}
                </Typography>
              }
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ContactTemplates;
