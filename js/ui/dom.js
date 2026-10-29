/** Mini utilitaire DOM sans dépendance. N'utilise jamais innerHTML avec des données. */
export function h(tag, attrs = null, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null || v === false)
                continue;
            if (k.startsWith("on") && typeof v === "function") {
                el.addEventListener(k.slice(2).toLowerCase(), v);
            }
            else if (k === "class") {
                el.className = String(v);
            }
            else if (v === true) {
                el.setAttribute(k, "");
            }
            else {
                el.setAttribute(k, String(v));
            }
        }
    }
    append(el, children);
    return el;
}
export function append(el, children) {
    for (const c of children) {
        if (c === null || c === undefined || c === false)
            continue;
        if (Array.isArray(c))
            append(el, c);
        else
            el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
}
const SVG_NS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs))
        el.setAttribute(k, String(v));
    children.forEach((c) => el.appendChild(c));
    return el;
}
export function clear(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
}
/** Annonce pour lecteurs d'écran (région aria-live globale). */
export function announce(message) {
    const live = document.getElementById("live");
    if (!live)
        return;
    live.textContent = "";
    window.setTimeout(() => (live.textContent = message), 30);
}
