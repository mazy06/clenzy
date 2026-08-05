import React, { useState, useMemo } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Button, Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Textarea } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowBack, CheckCircle } from '../../icons';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import apiClient from '../../services/apiClient';

export default function Support() {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en.
  // Le hook change la langue i18n GLOBALE : la racine de l'app recalcule alors
  // sa typographie (Tajawal) et sa direction. Rien a habiller localement, l'ecran
  // est passe aux primitives Baitly UI, qui lisent les jetons CSS.
  useGeoAuthLanguage();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = useMemo(
    () => [
      { value: 'access', label: t('auth.support.subjects.access', "Problème d'accès / connexion") },
      { value: 'technical', label: t('auth.support.subjects.technical', 'Problème technique') },
      { value: 'billing', label: t('auth.support.subjects.billing', 'Facturation / abonnement') },
      { value: 'feature', label: t('auth.support.subjects.feature', 'Demande de fonctionnalité') },
      { value: 'other', label: t('auth.support.subjects.other', 'Autre') },
    ],
    [t],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiClient.post('/public/support', {
        name,
        email,
        phone,
        subject,
        message,
      }, { skipAuth: true });

      setSubmitted(true);
    } catch {
      setError(t('auth.support.submitError', "Une erreur est survenue lors de l'envoi. Veuillez réessayer ou nous contacter à info@clenzy.fr."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100vh] flex items-center justify-center p-3 bg-background">
      <Card className="gap-0 py-0 p-3.5 w-full max-w-[440px] shadow-sm">
        {/* Header avec logo */}
        <div className="text-center mb-3">
          <div className="flex justify-center mb-2">
            <BaitlyMarkLogo variant="full" size={42} />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {t('auth.support.headerSubtitle', 'Contactez notre support')}
          </p>
        </div>

        {submitted ? (
          /* Message de confirmation */
          <div className="text-center py-4">
            <span className="inline-flex text-success-ink mb-2"><CheckCircle size={56} strokeWidth={1.75} /></span>
            <h6 className="text-base font-semibold tracking-tight text-balance mb-1.5">
              {t('auth.support.submittedTitle', 'Message envoyé !')}
            </h6>
            <p className="text-xs text-muted-foreground mb-3.5">
              {t('auth.support.submittedBody', 'Notre équipe vous contactera dans les 24 heures.')}
            </p>
            <Button onClick={() => navigate('/login')}>
              {t('auth.support.backToLogin', 'Retour à la connexion')}
            </Button>
          </div>
        ) : (
          /* Formulaire de contact */
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-[9px]">
              <Field>
                <FieldLabel htmlFor="support-name">{t('auth.support.fields.nameLabel', 'Nom complet')}</FieldLabel>
                <Input
                  id="support-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="support-email">{t('auth.support.fields.emailLabel', 'Email')}</FieldLabel>
                <Input
                  id="support-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="support-phone">{t('auth.support.fields.phoneLabel', 'Téléphone (optionnel)')}</FieldLabel>
                <Input
                  id="support-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="support-subject">{t('auth.support.fields.subjectLabel', 'Sujet')}</FieldLabel>
                <NativeSelect
                  id="support-subject"
                  className="w-full"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  disabled={loading}
                >
                  {/* Option vide obligatoire : un select natif sans valeur vide
                      selectionnerait le 1er sujet a l'affichage alors que l'etat
                      reste '', et `required` ne bloquerait plus l'envoi. */}
                  <NativeSelectOption value="">
                    {t('auth.support.fields.subjectPlaceholder', 'Choisissez un sujet')}
                  </NativeSelectOption>
                  {subjects.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field>
                <FieldLabel htmlFor="support-message">{t('auth.support.fields.messageLabel', 'Votre message')}</FieldLabel>
                <Textarea
                  id="support-message"
                  rows={4}
                  // field-sizing:content neutralise `rows` : la hauteur de
                  // depart se garantit en min-h.
                  className="min-h-[4lh]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={loading}
                  placeholder={t('auth.support.fields.messagePlaceholder', 'Décrivez votre problème ou votre demande...')}
                />
              </Field>

              {error && (
                <Alert variant="destructive" className="py-1">
                  <TriangleAlert />
                  <AlertDescription><p className="text-xs">{error}</p></AlertDescription>
                </Alert>
              )}

              {/* `shrink` neutralise le shrink-0 du gabarit : le bouton doit
                  occuper toute la largeur de la colonne, comme dans le Stack. */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full shrink"
              >
                {loading ? (
                  <Spinner className="size-5" />
                ) : (
                  t('auth.support.submit', 'Envoyer')
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Lien retour */}
        {!submitted && (
          <div className="mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <ArrowBack size={'0.9rem'} strokeWidth={1.75} />
              {t('auth.support.backToLogin', 'Retour à la connexion')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
