import { createContext, useContext, useSyncExternalStore } from 'react';
import { DataStore } from './DataStore.js';
import { DataSpaceGraphQLClient } from '../api/graphqlClient.js';

export const appStore = new DataStore();
export const gqlClient = new DataSpaceGraphQLClient(appStore);

// Для отладки из консоли браузера (window.appStore / window.dsGqlClient)
if (typeof window !== 'undefined') {
  window.appStore = appStore;
  window.dsGqlClient = gqlClient;
}

const StoreContext = createContext(appStore);

export function StoreProvider({ store = appStore, children }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * Возвращает стор и подписывает компонент на его изменения:
 * любое сохранение данных вызывает перерисовку.
 */
export function useStore() {
  const store = useContext(StoreContext);
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return store;
}
