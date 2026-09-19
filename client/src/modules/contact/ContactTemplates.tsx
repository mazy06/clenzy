import React from 'react';
import { cn } from '../../utils/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  buttonVariants,
} from '../../components/ui';
import {
  Description as TemplateIcon
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';

/** Libelles et corps en locales : `contact.messageTemplates.<id>.{label,text}`. */
const MESSAGE_TEMPLATE_IDS = ['acknowledge', 'schedule', 'completed', 'info_needed', 'urgent'];

interface ContactTemplatesProps {
  onSelectTemplate: (text: string) => void;
}

const ContactTemplates: React.FC<ContactTemplatesProps> = ({ onSelectTemplate }) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      {/* Trigger natif (pas de Button asChild) : le declencheur Radix pose une ref
          DOM que le Button du kit, simple fonction React 18, ne transmet pas. */}
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'whitespace-nowrap')}
      >
        <TemplateIcon />
        {t('contact.templates')}
      </DropdownMenuTrigger>
      {/* anchorOrigin top / transformOrigin bottom MUI = menu ouvert VERS LE HAUT. */}
      <DropdownMenuContent
        side="top"
        align="start"
        // Le gabarit du kit cale la largeur sur celle du declencheur : on la libere.
        className="w-auto max-w-[400px] max-h-[350px] overflow-y-auto"
      >
        <DropdownMenuLabel className="text-muted-foreground">
          {t('contact.templates')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MESSAGE_TEMPLATE_IDS.map((id) => {
          const label = t(`contact.messageTemplates.${id}.label`);
          const text = t(`contact.messageTemplates.${id}.text`);
          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => onSelectTemplate(text)}
              className="whitespace-normal items-start py-[9px]"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{text}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ContactTemplates;
