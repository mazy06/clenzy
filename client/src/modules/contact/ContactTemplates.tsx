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

interface MessageTemplate {
  id: string;
  label: string;
  text: string;
}

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'acknowledge',
    label: 'Accusé de réception',
    text: 'Merci pour votre message. Nous avons bien reçu votre demande et nous vous répondrons dans les plus brefs délais.'
  },
  {
    id: 'schedule',
    label: 'Planification',
    text: 'Nous avons planifié une intervention pour répondre à votre demande. Vous serez notifié des détails prochainement.'
  },
  {
    id: 'completed',
    label: 'Travaux terminés',
    text: 'Les travaux demandés ont été effectués avec succès. N\'hésitez pas à nous contacter si vous avez des questions.'
  },
  {
    id: 'info_needed',
    label: 'Informations requises',
    text: 'Afin de traiter votre demande, nous aurions besoin d\'informations complémentaires. Pourriez-vous nous préciser :'
  },
  {
    id: 'urgent',
    label: 'Urgence',
    text: 'Votre demande a été classée comme urgente. Notre équipe d\'intervention va prendre en charge cette situation dans les plus brefs délais.'
  }
];

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
        {MESSAGE_TEMPLATES.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onSelect={() => onSelectTemplate(template.text)}
            className="whitespace-normal items-start py-[9px]"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">{template.label}</span>
              <span className="text-xs text-muted-foreground line-clamp-2">
                {template.text}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ContactTemplates;
