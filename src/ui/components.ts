import { h, svg } from "./dom.js";
import type { SourceLink } from "../analysis/metrics.js";
import { LEVEL_LABEL, type Level } from "../analysis/observations.js";
import { EVIDENCE_HELP, EVIDENCE_LABEL, type Evidence } from "../recommendations/catalog.js";

const ICON_PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  check: "M20 6 9 17l-5-5",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  book: "M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2zM12 6.5v14",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
  heart: "M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  eyeoff: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3.2 4.2M6.6 6.6C4.3 8 2.7 10.2 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1",
  camera: "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  image: "M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  plus: "M12 5v14M5 12h14",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 18l-6-6 6-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
};

export function icon(name: keyof typeof ICON_PATHS | string, size = 20): SVGElement {
  return svg(
    "svg",
    { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "icon" },
    svg("path", { d: ICON_PATHS[name] ?? ICON_PATHS.info }),
  );
}

export function levelBadge(level: Level): HTMLElement {
  const iconName = level === "reliable" ? "check" : level === "confirm" ? "info" : "eyeoff";
  return h("span", { class: `badge badge-${level}` }, icon(iconName, 14), LEVEL_LABEL[level]);
}

export function evidenceBadge(e: Evidence): HTMLElement {
  return h("span", { class: `badge badge-ev-${e}`, title: EVIDENCE_HELP[e] }, EVIDENCE_LABEL[e]);
}

export function sourceList(sources: readonly SourceLink[]): HTMLElement | null {
  if (!sources.length) return null;
  return h(
    "ul",
    { class: "sources" },
    sources.map((s) =>
      h("li", null, h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.label, " ", icon("external", 12))),
    ),
  );
}

export function button(label: string | Node, onClick: (e: Event) => void, opts: { variant?: "primary" | "ghost" | "danger" | "quiet"; icon?: string; type?: "button" | "submit"; disabled?: boolean; id?: string } = {}): HTMLButtonElement {
  return h(
    "button",
    { type: opts.type ?? "button", class: `btn btn-${opts.variant ?? "primary"}`, onclick: onClick as EventListener, disabled: opts.disabled, id: opts.id },
    opts.icon ? icon(opts.icon, 18) : null,
    typeof label === "string" ? h("span", null, label) : label,
  );
}

export function linkButton(label: string, href: string, opts: { variant?: "primary" | "ghost" | "quiet"; icon?: string } = {}): HTMLAnchorElement {
  return h("a", { href, class: `btn btn-${opts.variant ?? "primary"}` }, opts.icon ? icon(opts.icon, 18) : null, h("span", null, label));
}

export function card(title: string | null, ...children: Array<Node | null | false | string | Node[]>): HTMLElement {
  return h("section", { class: "card" }, title ? h("h2", { class: "card-title" }, title) : null, ...children);
}

export function details(summary: string, ...children: Array<Node | null | false | string>): HTMLDetailsElement {
  return h("details", { class: "disclosure" }, h("summary", null, summary), h("div", { class: "disclosure-body" }, ...children));
}

export function notice(kind: "info" | "warn" | "block", ...children: Array<Node | string | null>): HTMLElement {
  return h("div", { class: `notice notice-${kind}`, role: kind === "block" ? "alert" : "note" }, icon(kind === "info" ? "info" : "alert", 18), h("div", null, ...children));
}

export function pageHeader(title: string, lead?: string, back?: string): HTMLElement {
  return h(
    "header",
    { class: "page-header" },
    back ? h("a", { href: back, class: "back-link" }, icon("back", 16), "Retour") : null,
    h("h1", { tabindex: "-1", id: "page-title" }, title),
    lead ? h("p", { class: "lead" }, lead) : null,
  );
}

export function choiceGroup<T extends string>(
  name: string,
  legend: string,
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>,
  current: T | null,
  onChange: (v: T) => void,
): HTMLFieldSetElement {
  return h(
    "fieldset",
    { class: "choices" },
    h("legend", null, legend),
    options.map((o) =>
      h(
        "label",
        { class: "choice" },
        h("input", {
          type: "radio", name, value: o.value, checked: current === o.value,
          onchange: (() => onChange(o.value)) as EventListener,
        }),
        h("span", { class: "choice-body" }, h("span", { class: "choice-label" }, o.label), o.hint ? h("span", { class: "choice-hint" }, o.hint) : null),
      ),
    ),
  );
}

export function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string): HTMLLabelElement {
  return h(
    "label",
    { class: "check" },
    h("input", { type: "checkbox", checked, onchange: ((e: Event) => onChange((e.target as HTMLInputElement).checked)) as EventListener }),
    h("span", { class: "choice-body" }, h("span", { class: "choice-label" }, label), hint ? h("span", { class: "choice-hint" }, hint) : null),
  );
}
