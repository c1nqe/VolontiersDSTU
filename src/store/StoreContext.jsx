import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { ApiStore } from './ApiStore.js';
import { useUI } from '../components/UIContext.jsx';

export const appStore = new ApiStore();

// Для отладки из консоли браузера (window.appStore)
if (typeof window !== 'undefined') window.appStore = appStore;

const StoreContext = createContext(appStore);

export function StoreProvider({ store = appStore, children }) {
  useEffect(() => {
    if (store.status === 'idle') store.init();
  }, [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * Возвращает стор и подписывает компонент на его изменения:
 * любое обновление данных с сервера вызывает перерисовку.
 */
export function useStore() {
  const store = useContext(StoreContext);
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  return store;
}

/**
 * Запуск серверного действия с уведомлением:
 *   const run = useRun();
 *   await run(store.closeEvent(id), 'Событие закрыто');
 * Ошибка сервера (нет прав, неверный статус…) показывается тостом, возвращается результат.
 */
export function useRun() {
  const { showToast } = useUI();
  return useCallback(async (promise, successMessage, tone = 'success') => {
    const res = await promise;
    if (!res.success) showToast(res.message || 'Не удалось выполнить действие', 'error');
    else if (successMessage) showToast(typeof successMessage === 'function' ? successMessage(res) : successMessage, tone);
    return res;
  }, [showToast]);
}
