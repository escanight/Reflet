/** Routage par fragment d'URL simple (#nom), compatible avec les cadres restreints. */
let renderer: () => Promise<void> = async () => undefined;

export function setRenderer(fn: () => Promise<void>): void {
  renderer = fn;
}

export function go(route: string): void {
  if (location.hash === `#${route}`) void renderer();
  else location.hash = route;
}

export function rerender(): Promise<void> {
  return renderer();
}
