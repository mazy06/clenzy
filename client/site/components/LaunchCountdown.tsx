import { useEffect, useState } from 'react';
import type { PrelaunchMessages } from '../lib/messages/prelaunch';
import type { SiteLanguage } from '../lib/siteLanguage';

export function remainingLaunchTime(launchAt: string, now: number) {
  const remaining = Math.max(0, Math.ceil((Date.parse(launchAt) - now) / 1000));
  if (!Number.isFinite(remaining)) return null;
  return [
    Math.floor(remaining / 86400),
    Math.floor(remaining / 3600) % 24,
    Math.floor(remaining / 60) % 60,
    remaining % 60,
  ];
}

export default function LaunchCountdown({
  launchAt,
  language,
  messages: m,
}: {
  launchAt: string;
  language: SiteLanguage;
  messages: PrelaunchMessages;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const values = remainingLaunchTime(launchAt, now);
  const formatter = new Intl.NumberFormat(language, {
    minimumIntegerDigits: 2,
    useGrouping: false,
    numberingSystem: language === 'ar' ? 'arab' : 'latn',
  });
  if (!values || values.every((value) => value === 0)) {
    return (
      <div className="prelaunch-date-note">
        <strong>{m.imminent}</strong>
        <p>{m.imminentHint}</p>
      </div>
    );
  }
  return (
    <dl className="prelaunch-countdown" role="timer" aria-live="off">
      {values.map((value, index) => (
        <div key={m.units[index]}>
          <dt>{m.units[index]}</dt>
          <dd>{formatter.format(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
