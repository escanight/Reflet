import { clear, h, announce } from "../dom.js";
import { button, card, checkbox, details, icon, notice, pageHeader } from "../components.js";
import { persistHistory, loadHistory, saveSettings, saveProfile, state, wipeAll } from "../../app/state.js";
import { go } from "../../app/router.js";
import { persistentStorageAvailable } from "../../storage/store.js";

export const APP_VERSION = "2.1.2";

let confirmWipe = false;

export function renderData(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageHeader("Mes données", "Ce que Reflet garde, où, et comment tout effacer."));

  // Preuve vérifiable : requêtes réseau effectuées par la page.
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const external = entries.filter((e) => {
    try {
      return new URL(e.name).origin !== location.origin;
    } catch {
      return false;
    }
  });
  root.appendChild(
    card(
      "Ce qui sort de ton téléphone",
      external.length === 0
        ? h("p", { class: "proof" }, icon("shield", 18), h("span", null, h("strong", null, "Aucune requête vers un autre site"), ` depuis l'ouverture de la page (${entries.length} fichier${entries.length > 1 ? "s" : ""} chargé${entries.length > 1 ? "s" : ""}, tous depuis ${location.host || "cette page"}).`))
        : notice("warn", h("p", null, `${external.length} requête(s) vers d'autres sites ont été détectées :`), h("ul", null, external.slice(0, 10).map((e) => h("li", null, new URL(e.name).host)))),
      h("p", { class: "muted small" }, "Ce compteur lit le journal de performances de ton navigateur. Tu peux aussi vérifier toi-même : outils de développement › Réseau, ou mode avion une fois la page chargée."),
    ),
  );

  const stored = h(
    "ul",
    { class: "stored" },
    h("li", null, h("strong", null, "Photos : "), "jamais enregistrées. Elles sont effacées de la mémoire quand tu quittes l'analyse."),
    h("li", null, h("strong", null, "Repères du visage : "), "jamais enregistrés."),
    h("li", null, h("strong", null, "Réponse sur l'âge et questionnaire : "), state.profileSet ? "enregistrés sur cet appareil." : "rien d'enregistré pour l'instant."),
    h("li", null, h("strong", null, "Habitudes : "), `${state.habits.length} habitude${state.habits.length > 1 ? "s" : ""}, sur cet appareil.`),
    h("li", null, h("strong", null, "Historique des mesures : "), state.settings.historyEnabled ? `activé, ${state.history.length} séance${state.history.length > 1 ? "s" : ""}, chiffré (AES-GCM) sur cet appareil.` : "désactivé."),
    h("li", null, h("strong", null, "Journal d'usage : "), "les dates de tes scans des 7 derniers jours, pour afficher un message de soutien en cas d'usage très répété. Jamais transmis."),
  );
  root.appendChild(
    card(
      "Ce qui est stocké sur cet appareil",
      stored,
      !persistentStorageAvailable() ? notice("info", h("p", null, "Le stockage de ce navigateur est indisponible (navigation privée ou cadre restreint) : tout sera oublié à la fermeture.")) : null,
    ),
  );

  root.appendChild(
    card(
      "Historique des mesures",
      checkbox(
        "Conserver mes mesures pour suivre l'évolution",
        state.settings.historyEnabled,
        async (on) => {
          saveSettings({ historyEnabled: on });
          if (on) {
            await loadHistory();
          } else {
            state.history = [];
            await persistHistory();
          }
          announce(on ? "Historique activé." : "Historique désactivé et effacé.");
          renderData(root);
        },
        "Seules les valeurs mesurées et leurs marges d'erreur sont gardées, chiffrées. Désactiver efface l'historique.",
      ),
    ),
  );

  root.appendChild(
    card(
      "Âge",
      h("p", null, state.settings.adult ? "Tu as indiqué avoir 18 ans ou plus." : "Tu as indiqué avoir moins de 18 ans : les mesures du visage ne sont pas proposées."),
      h("div", { class: "button-row" }, button("Modifier ma réponse", () => {
        const adult = !state.settings.adult;
        saveSettings({ adult });
        saveProfile({ ...state.profile, adult });
        renderData(root);
      }, { variant: "ghost" })),
    ),
  );

  const wipe = card("Tout supprimer", h("p", null, "Efface préférences, questionnaire, habitudes, historique et clé de chiffrement de cet appareil. Action irréversible."));
  if (!confirmWipe) {
    wipe.append(button("Supprimer toutes mes données", () => { confirmWipe = true; renderData(root); }, { variant: "danger", icon: "trash" }));
  } else {
    wipe.append(
      notice("warn", h("p", null, "Tu confirmes la suppression définitive de toutes les données de Reflet sur cet appareil ?")),
      h(
        "div",
        { class: "button-row" },
        button("Annuler", () => { confirmWipe = false; renderData(root); }, { variant: "ghost" }),
        button("Oui, tout supprimer", async () => {
          await wipeAll();
          confirmWipe = false;
          announce("Toutes les données ont été supprimées.");
          go("bienvenue");
        }, { variant: "danger", icon: "trash", id: "confirm-wipe" }),
      ),
    );
  }
  root.appendChild(wipe);

  root.appendChild(
    card(
      "Politique de confidentialité",
      h("p", { class: "muted small" }, `Version ${APP_VERSION} · mise à jour le 28 octobre 2026`),
      details(
        "Lire la politique complète",
        h("h3", null, "Traitement"), h("p", null, "L'analyse du visage est lancée par toi, sur ton appareil, dans ton navigateur. L'éditeur n'a accès ni à vos photos, ni aux repères, ni aux mesures, ni à vos réponses."),
        h("h3", null, "Données transmises"), h("p", null, "Aucune. L'application ne contient ni mesure d'audience, ni publicité, ni outil de suivi, ni rapport d'erreurs envoyé à un tiers. Une règle de sécurité du navigateur (Content Security Policy) interdit techniquement toute connexion vers un autre site."),
        h("h3", null, "Hébergement"), h("p", null, "Comme tout site web, le serveur qui distribue l'application peut enregistrer des journaux techniques (adresse IP, date, fichier demandé) ; ils ne contiennent aucune donnée de l'application. L'hébergeur doit en préciser la durée de conservation."),
        h("h3", null, "Ce que Reflet ne fait pas"), h("p", null, "Pas d'identification, pas de comparaison entre visages, pas de classement, pas de partage automatique, pas de déduction de l'âge, du sexe, de l'origine, de l'état de santé ou de l'orientation."),
        h("h3", null, "Tes droits"), h("p", null, "Toutes tes données sont sur ton appareil : tu peux les consulter ici et les supprimer à tout moment avec « Tout supprimer »."),
      ),
    ),
  );

  root.appendChild(
    card(
      "Diagnostic de cet appareil",
      h("p", { class: "muted small" }, "Utile si quelque chose ne fonctionne pas. Rien n'est envoyé."),
      h("ul", { class: "diag" }, diagnostics().map(([k, v]) => h("li", null, h("span", null, k), h("span", null, v)))),
    ),
  );

  root.appendChild(
    card(
      "À propos",
      h("p", null, "Reflet est gratuit, sans compte, sans publicité et sans abonnement. Les mesures sont descriptives et ne constituent ni un diagnostic ni un avis médical."),
      h("p", { class: "muted small" }, `Mode de repérage : ${state.detector?.available ? "automatique (MediaPipe, local) et manuel" : "manuel (modèle automatique non installé)"}.`),
    ),
  );
}

function diagnostics(): Array<[string, string]> {
  const yes = (b: boolean) => (b ? "oui" : "non");
  let framed = "non";
  try {
    framed = window.self !== window.top ? "oui" : "non";
  } catch {
    framed = "oui (restreint)";
  }
  let idb = "non";
  try {
    idb = yes(typeof indexedDB !== "undefined");
  } catch {
    /* accès refusé */
  }
  return [
    ["Version", APP_VERSION],
    ["Page intégrée dans un cadre", framed],
    ["Sélection de fichiers", yes(typeof File !== "undefined" && typeof FileReader !== "undefined")],
    ["createImageBitmap", yes(typeof createImageBitmap === "function")],
    ["Stockage local", yes(persistentStorageAvailable())],
    ["IndexedDB", idb],
    ["Chiffrement (Web Crypto)", yes(!!globalThis.crypto?.subtle)],
    ["WebAssembly", yes(typeof WebAssembly === "object")],
    ["Repérage automatique", state.detector === null ? "vérification…" : state.detector.available ? "installé" : "non installé"],
    ["Écran", `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`],
  ];
}
