/** Routage par fragment d'URL simple (#nom), compatible avec les cadres restreints. */
let renderer = async () => undefined;
export function setRenderer(fn) {
    renderer = fn;
}
export function go(route) {
    if (location.hash === `#${route}`)
        void renderer();
    else
        location.hash = route;
}
export function rerender() {
    return renderer();
}
