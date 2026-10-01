import { academyTranscript } from '../../lib/academyTranscript';
import { BAITLY_ACADEMY_MESSAGES } from '../../lib/messages/baitlyAcademy';
import type { SiteLanguage } from '../../lib/siteLanguage';

export default function AcademyTranscript({
  slug,
  language,
}: {
  slug: string;
  language: SiteLanguage;
}) {
  const transcript = academyTranscript(slug, language);
  if (!transcript) return null;
  return (
    <details className="bac-transcript">
      <summary>{BAITLY_ACADEMY_MESSAGES[language].ui.transcript}</summary>
      <div
        lang={transcript.language}
        dir={transcript.language === 'ar' ? 'rtl' : 'ltr'}
      >
        {transcript.text.split(/\n\s*\n/).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}
