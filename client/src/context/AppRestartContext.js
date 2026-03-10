import { createContext } from 'react';

// Calling this remounts the entire navigation tree so I18nManager direction
// changes take effect immediately — no manual app restart needed.
export const AppRestartContext = createContext(() => {});
