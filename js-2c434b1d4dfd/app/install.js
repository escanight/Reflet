let deferred = null;
const listeners = new Set();
export function isFramed() {
    try {
        return window.self !== window.top;
    }
    catch {
        return true;
    }
}
export function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}
export function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
export function canPromptInstall() {
    return deferred !== null;
}
export function onInstallChange(fn) {
    listeners.add(fn);
}
export async function promptInstall() {
    if (!deferred)
        return false;
    const e = deferred;
    deferred = null;
    await e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
    listeners.forEach((f) => f());
    return choice.outcome === "accepted";
}
export function setupInstall() {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferred = e;
        listeners.forEach((f) => f());
    });
    window.addEventListener("appinstalled", () => {
        deferred = null;
        listeners.forEach((f) => f());
    });
    const secure = location.protocol === "https:" || location.hostname === "127.0.0.1" || location.hostname === "localhost";
    if (!isFramed() && secure && "serviceWorker" in navigator) {
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).then((reg) => {
            void reg.update();
            // Une app installée est souvent seulement remise au premier plan, jamais rechargée :
            // on vérifie donc les mises à jour à chaque retour dans l'app (au plus toutes les 30 s).
            let last = Date.now();
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible" && Date.now() - last > 30_000) {
                    last = Date.now();
                    void reg.update().catch(() => undefined);
                }
            });
        }).catch(() => undefined);
        // Nouvelle version installée : on recharge une seule fois pour l'utiliser tout de suite.
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (hadController && !reloaded) {
                reloaded = true;
                location.reload();
            }
        });
    }
}
