import { forwardRef, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { useSiteLaunch } from '../lib/siteLaunch';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRELAUNCH_MESSAGES } from '../lib/messages/prelaunch';
import {
  acquisitionSearch,
  readAcquisitionContext,
} from '../../src/services/publicAcquisitionContext';

/** Tous les points d'entrée marketing suivent le même réglage serveur. */
const SiteAcquisitionLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof Link>
>(function SiteAcquisitionLink({ children, to, ...props }, ref) {
  const { paused } = useSiteLaunch();
  const { language } = useSiteLanguage();
  const ArrowIcon = language === 'ar' ? ArrowLeftIcon : ArrowRightIcon;
  const search =
    typeof to === 'string'
      ? new URL(to, 'https://baitly.fr').search
      : (to.search ?? '');
  const prelaunch = `/bientot-disponible${acquisitionSearch(readAcquisitionContext(search), language)}`;
  return (
    <Link {...props} ref={ref} to={paused ? prelaunch : to}>
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
