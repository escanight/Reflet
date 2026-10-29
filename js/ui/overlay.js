/** Dessin de la photo avec les repères, la ligne des yeux et l'axe médian. */
import { buildFrame } from "../analysis/geometry.js";
import { POINT_IDS } from "../analysis/points.js";
export const COLORS = {
    point: "#F4D9A6",
    ring: "#111214",
    active: "#7FD6C8",
    axis: "rgba(127,214,200,0.85)",
    mesh: "rgba(244,217,166,0.35)",
};
export function drawOverlay(canvas, source, points, opts = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    let sx = 0, sy = 0, sw = source.width, sh = source.height;
    const all = POINT_IDS.map((id) => points[id]).filter(Boolean);
    if (opts.crop && all.length >= 4) {
        const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const pad = w * 0.55;
        sx = Math.max(0, Math.min(...xs) - pad);
        sy = Math.max(0, Math.min(...ys) - pad * 1.1);
        sw = Math.min(source.width - sx, w + 2 * pad);
        sh = Math.min(source.height - sy, Math.max(...ys) - Math.min(...ys) + pad * 1.6);
    }
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    const tx = (p) => ({ x: p.x - sx, y: p.y - sy });
    const scale = Math.max(sw, sh) / 600;
    if (opts.mesh?.length) {
        ctx.fillStyle = COLORS.mesh;
        for (const p of opts.mesh) {
            const q = tx(p);
            ctx.fillRect(q.x - scale * 0.8, q.y - scale * 0.8, scale * 1.6, scale * 1.6);
        }
    }
    if (opts.axes && POINT_IDS.every((id) => points[id])) {
        const f = buildFrame(points);
        const o = tx(f.origin);
        const L = f.d * 1.6;
        ctx.strokeStyle = COLORS.axis;
        ctx.lineWidth = 1.5 * scale;
        ctx.setLineDash([6 * scale, 5 * scale]);
        ctx.beginPath();
        ctx.moveTo(o.x - f.ux.x * L, o.y - f.ux.y * L);
        ctx.lineTo(o.x + f.ux.x * L, o.y + f.ux.y * L);
        ctx.moveTo(o.x - f.uy.x * f.d * 0.7, o.y - f.uy.y * f.d * 0.7);
        ctx.lineTo(o.x + f.uy.x * f.d * 2.4, o.y + f.uy.y * f.d * 2.4);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    for (const id of POINT_IDS) {
        const p = points[id];
        if (!p)
            continue;
        const q = tx(p);
        const r = (id === opts.active ? 6 : 4.5) * scale;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r + 1.8 * scale, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.ring;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fillStyle = id === opts.active ? COLORS.active : COLORS.point;
        ctx.fill();
    }
}
