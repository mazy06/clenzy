import React, { useEffect, useMemo, useState } from 'react';
import { Spinner } from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, Button, Card, CardContent } from '../../components/ui';
import { MarkEmailRead, ErrorOutline, Send as SendIcon } from '../../icons';
import { useGeoAuthLanguage } from '../../hooks/useGeoAuthLanguage';
import BaitlyMarkLogo from '../../components/BaitlyMarkLogo';
import apiClient from '../../services/apiClient';

export default function InscriptionSuccess() {
  const { t } = useTranslation();
  // Geo-detected language (pas les prefs user) : pays arabes -> ar / Maghreb-France -> fr / autres -> en
  const { isRtl } = useGeoAuthLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Recuperer l'email depuis le sessionStorage (stocke a l'inscription)
  const inscriptionEmail = sessionStorage.getItem('inscription_email') || '';

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    // Le webhook Stripe s'occupe de confirmer le paiement et d'envoyer l'email.
    // On attend un court instant puis on affiche la page "verifiez vos emails".
    const timer = setTimeout(() => {
      setStatus('success');
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId]);

  const handleResend = async () => {
    if (!inscriptionEmail) {
      setResendMessage(t('auth.inscriptionSuccess.resendMissingEmail', 'Impossible de renvoyer sans adresse email.'));
      return;
    }
    setResending(true);
    setResendMessage(null);
    try {
      await apiClient.post('/public/inscription/resend-confirmation', {
        email: inscriptionEmail,
      }, { skipAuth: true });
      setResendMessage(t('auth.inscriptionSuccess.resendSuccess', 'Un nouveau lien de confirmation a ete envoye.'));
    } catch {
      setResendMessage(t('auth.inscriptionSuccess.resendSuccess', 'Un nouveau lien de confirmation a ete envoye.'));
    } finally {
      setResending(false);
    }
  };

  return (
    // Montee hors du shell applicatif : elle porte son propre mode clair.
    <div data-theme="light" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="min-h-[100vh] flex items-center justify-center p-3 bg-background">
        <Card className="w-full max-w-[480px] shadow-sm">
          <CardContent className="p-[18px] min-[600px]:p-6 text-center">
          {/* Logo */}
          <div className="mb-3">
            <BaitlyMarkLogo scale={1.1} />
          </div>

          {status === 'loading' && (
            <div className="py-6">
              <Spinner className="size-10 text-primary mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {t('auth.inscriptionSuccess.loading', 'Finalisation de votre paiement...')}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4">
              {/* Le rebond du keyframe maison n'a pas d'equivalent en classe :
                  l'entree zoom+fade du kit rend la meme intention. */}
              <span className="inline-flex text-primary mb-3 animate-in zoom-in-50 fade-in-0 duration-[400ms] ease-out">
                <MarkEmailRead size={72} strokeWidth={1.75} />
              </span>
              <h5 className="text-base font-semibold tracking-tight text-balance text-foreground mb-1.5">
                {t('auth.inscriptionSuccess.successTitle', 'Verifiez votre boite email')}
              </h5>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t('auth.inscriptionSuccess.paymentConfirmed', 'Votre paiement a ete confirme avec succes.')}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {t(
                  'auth.inscriptionSuccess.checkEmail',
                  `Un email de confirmation a ete envoye${inscriptionEmail ? ` a ${inscriptionEmail}` : ''}. Cliquez sur le lien dans l'email pour creer votre mot de passe et finaliser votre inscription.`,
                  {
                    toEmail: inscriptionEmail
                      ? t('auth.inscriptionSuccess.toEmail', ` a ${inscriptionEmail}`, { email: inscriptionEmail })
                      : '',
                  },
                )}
              </p>

              {resendMessage && (
                <Alert variant="success" className="mb-3 text-start">
                  <AlertDescription>{resendMessage}</AlertDescription>
                </Alert>
              )}

              <Button
                size="lg"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? <Spinner className="size-[18px]" /> : <SendIcon />}
                {resending
                  ? t('auth.inscriptionSuccess.resending', 'Envoi...')
                  : t('auth.inscriptionSuccess.resend', "Renvoyer l'email")}
              </Button>

              <div className="mt-3">
                <span className="text-xs text-muted-foreground">
                  {t('auth.inscriptionSuccess.checkSpam', "Verifiez vos spams si vous ne trouvez pas l'email.")}
                </span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4">
              <span className="inline-flex text-destructive mb-3"><ErrorOutline size={64} strokeWidth={1.75} /></span>
              <h6 className="text-sm font-semibold mb-1.5">
                {t('auth.inscriptionSuccess.errorTitle', 'Session introuvable')}
              </h6>
              <p className="text-xs text-muted-foreground mb-4">
                {t('auth.inscriptionSuccess.errorBody', "Aucune session de paiement n'a ete trouvee. Si vous avez deja paye, verifiez vos emails.")}
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/login')}
              >
                {t('auth.common.backToLogin', 'Retour a la connexion')}
              </Button>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
