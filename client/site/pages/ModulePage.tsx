import { useParams } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import BaitlyPmsPage from './BaitlyPmsPage';
import BaitlyProductPage from './BaitlyProductPage';
import BaitlyBookingPage from './BaitlyBookingPage';
import BaitlyWelcomePage from './BaitlyWelcomePage';
import BaitlyAgentsPage from './BaitlyAgentsPage';
import { productStoryKind } from '../data/baitlyProductStories';

/** Each product route has its own demonstration and editorial journey. */
export default function ModulePage() {
  const { slug } = useParams();
  if (slug === 'agents-ia') return <BaitlyAgentsPage />;
  const storyKind = productStoryKind(slug);
  if (storyKind) return <BaitlyProductPage key={storyKind} kind={storyKind} />;
  if (slug === 'booking-engine') return <BaitlyBookingPage />;
  if (slug === 'pms-channel-manager') return <BaitlyPmsPage />;
  if (slug === 'livret-accueil') return <BaitlyWelcomePage />;
  return <NotFoundPage />;
}
