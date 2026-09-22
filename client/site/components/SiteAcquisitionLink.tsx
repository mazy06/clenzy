import { forwardRef, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { useSiteLaunch } from '../lib/siteLaunch';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';

/** Tous les points d'entrée marketing suivent le même réglage serveur. */
const SiteAcquisitionLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof Link>
>(function SiteAcquisitionLink({ children, to, ...props }, ref) {
  const { paused } = useSiteLaunch();
  const { language } = useSiteLanguage();
  const ArrowIcon = language === 'ar' ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <Link
      {...props}
      ref={ref}
      to={paused ? `/bientot-disponible?lang=${language}` : to}
    >
      {paused ? (
        <>
          {PRELAUNCH_MESSAGES[language].cta}
          <ArrowIcon aria-hidden="true" />
        </>
      ) : (
        children
      )}
    </Link>
  );
});

export default SiteAcquisitionLink;
