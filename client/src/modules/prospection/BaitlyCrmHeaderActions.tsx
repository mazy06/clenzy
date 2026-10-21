import type {ReactNode} from 'react';
import {usePageHeaderActions} from '../../components/PageHeaderActionsContext';

/** Actions du CRM dans le PageHeader, avec repli pour les usages autonomes. */
export default function BaitlyCrmHeaderActions({children}:{children:ReactNode}){
  const portal=usePageHeaderActions(children);
  return portal??(children?<div className="bcrm-workflow-toolbar">{children}</div>:null);
}
