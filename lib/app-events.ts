// Lightweight window events to decouple global UI (e.g. the notification bell)
// from feature state living elsewhere in the tree.

export const TRIPS_CHANGED_EVENT = 'trips:changed';
export const NAVIGATE_TAB_EVENT = 'app:navigate-tab';

export function emitTripsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TRIPS_CHANGED_EVENT));
}

export function emitNavigateTab(tab: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<string>(NAVIGATE_TAB_EVENT, { detail: tab }));
}

export const DATA_CHANGED_EVENT = 'app:data-changed';

/** Tells the main page to reload its data (e.g. after the base currency was reconverted). */
export function emitDataChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}
