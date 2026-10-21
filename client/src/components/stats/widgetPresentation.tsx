import * as React from 'react';

/** Report data stays shared; the dashboard gives it its own reading density. */
export const WidgetPresentationContext = React.createContext(false);
export const useWidgetPresentation = () => React.useContext(WidgetPresentationContext);
