import type { ReactNode } from 'react';
import EmptyState from '../../components/EmptyState';
import { Button } from '../../components/ui';

type GuidanceAction = { label: string; onClick: () => void };

/** Une prochaine étape concrète, sans déclencher de création ni de publication. */
export default function BaitlyCrmEmptyState({ icon, title, description, action, secondaryAction }: {
  icon: ReactNode; title: string; description: string;
  action?: GuidanceAction; secondaryAction?: GuidanceAction;
}) {
  return <div className="bcrm-guidance">
    <EmptyState icon={icon} title={title} description={description} variant="transparent" minHeight={280}
      action={action && <Button onClick={action.onClick}>{action.label}</Button>}
      secondaryAction={secondaryAction && <Button variant="outline" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>} />
  </div>;
}
