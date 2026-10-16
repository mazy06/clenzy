import React, { useState, useMemo } from 'react';
import {
  Alert, AlertDescription, Button, Field, FieldLabel, Input,
  NativeSelect, NativeSelectOption, Textarea, Spinner,
} from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowBack, CheckCircle } from '../../icons';
import apiClient from '../../services/apiClient';
import AuthLayout from './AuthLayout';

export default function Support() {
  const { t } = useTranslation();
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
      { value: 'access', label: t('auth.support.subjects.access') },
      { value: 'technical', label: t('auth.support.subjects.technical') },
      { value: 'billing', label: t('auth.support.subjects.billing') },
      { value: 'feature', label: t('auth.support.subjects.feature') },
      { value: 'other', label: t('auth.support.subjects.other') },
    ], [t],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/public/support', { name, email, phone, subject, message }, { skipAuth: true });
      setSubmitted(true);
    } catch {
      setError(t('auth.support.submitError'));
    } finally {
      setLoading(false);
    }
  };

  const presentation = (
    <div className="baitly-support-guide">
      <div>
        <span className="baitly-auth-kicker">{t('auth.support.guide.kicker')}</span>
        <h2>{t('auth.support.guide.title')}</h2>
        <p className="baitly-support-guide-intro">{t('auth.support.guide.body')}</p>
      </div>
      <ol className="baitly-support-guide-list">
        {(['context', 'details', 'privacy'] as const).map((item, index) => (
          <li key={item}>
            <span className="baitly-support-guide-number" aria-hidden="true">0{index + 1}</span>
            <div>
              <h3>{t(`auth.support.guide.${item}Title`)}</h3>
              <p>{t(`auth.support.guide.${item}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="baitly-support-guide-note">
        <p>{t('auth.support.guide.note')}</p>
        <Link to="/forgot-password" className="inline-flex mt-2 underline font-medium text-foreground">{t('auth.login.forgotPassword')}</Link>
      </div>
    </div>
  );

  return (
    <AuthLayout maxFormWidth={520} presentation={presentation} presentationLabel={t('auth.support.guide.kicker')}>
      <Link to="/login" className="baitly-support-back">
        <ArrowBack size={16} aria-hidden="true" />
        {t('auth.support.backToLogin')}
      </Link>

      {submitted ? (
        <section className="baitly-support-success" aria-live="polite">
          <CheckCircle size={32} strokeWidth={1.75} className="text-success-ink" aria-hidden="true" />
          <h1>{t('auth.support.submittedTitle')}</h1>
          <p>{t('auth.support.submittedBody')}</p>
          <p className="baitly-support-reply-address">{email}</p>
          <Button asChild size="lg"><Link to="/login">{t('auth.support.backToLogin')}</Link></Button>
        </section>
      ) : (
        <>
          <div className="mb-7">
            <span className="baitly-auth-form-kicker">{t('auth.support.headerSubtitle')}</span>
            <h1 className="font-semibold mb-3">{t('auth.support.title')}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('auth.support.intro')}</p>
          </div>
          <form onSubmit={handleSubmit} aria-busy={loading} className="baitly-support-form">
            <div className="baitly-support-contact">
              <Field>
                <FieldLabel htmlFor="support-name">{t('auth.support.fields.nameLabel')}</FieldLabel>
                <Input id="support-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required disabled={loading} />
              </Field>
              <Field>
                <FieldLabel htmlFor="support-email">{t('auth.support.fields.emailLabel')}</FieldLabel>
                <Input id="support-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="support-phone">{t('auth.support.fields.phoneLabel')}</FieldLabel>
              <Input id="support-phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={loading} />
            </Field>
            <Field>
              <FieldLabel htmlFor="support-subject">{t('auth.support.fields.subjectLabel')}</FieldLabel>
              <NativeSelect id="support-subject" className="w-full" value={subject} onChange={e => setSubject(e.target.value)} required disabled={loading}>
                <NativeSelectOption value="">{t('auth.support.fields.subjectPlaceholder')}</NativeSelectOption>
                {subjects.map(option => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="support-message">{t('auth.support.fields.messageLabel')}</FieldLabel>
              <Textarea id="support-message" rows={5} value={message} onChange={e => setMessage(e.target.value)} required disabled={loading}
                placeholder={t('auth.support.fields.messagePlaceholder')} aria-describedby="support-message-help" />
              <p id="support-message-help" className="baitly-support-field-help">{t('auth.support.messageHelp')}</p>
            </Field>
            {error && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading && <Spinner className="size-4" />}
              {t(loading ? 'auth.support.sending' : 'auth.support.submit')}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
