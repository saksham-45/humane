export function prefersReducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
export function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
export function stampForPick(picked, humanSide) {
    return picked === humanSide ? "HUMAN" : "AI";
}
const STAMP_HIT = "/sfx/stamp.mp3";
const IMPACT_AT = 0.26;
let audioCtx = null;
let stampBuffer = null;
let stampClip = null;
function audioContext() {
    const AC = typeof window === "undefined"
        ? null
        : window.AudioContext ||
            window.webkitAudioContext;
    if (!AC)
        return null;
    if (!audioCtx)
        audioCtx = new AC();
    return audioCtx;
}
export async function unlockStampAudio() {
    if (typeof window === "undefined")
        return;
    const ctx = audioContext();
    if (ctx && ctx.state === "suspended")
        await ctx.resume();
    if (!stampClip) {
        stampClip = new Audio(STAMP_HIT);
        stampClip.preload = "auto";
        stampClip.volume = 0.9;
    }
    if (ctx && !stampBuffer) {
        try {
            const res = await fetch(STAMP_HIT);
            stampBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
        }
        catch {
            stampBuffer = null;
        }
    }
}
function synthStampHit(ctx) {
    const now = ctx.currentTime;
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = "sine";
    thud.frequency.setValueAtTime(88, now);
    thud.frequency.exponentialRampToValueAtTime(46, now + 0.12);
    thudGain.gain.setValueAtTime(0.7, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    thud.connect(thudGain).connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.15);
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const paper = ctx.createBufferSource();
    paper.buffer = n;
    const paperFilter = ctx.createBiquadFilter();
    paperFilter.type = "bandpass";
    paperFilter.frequency.value = 2800;
    paperFilter.Q.value = 0.7;
    const paperGain = ctx.createGain();
    paperGain.gain.setValueAtTime(0.45, now);
    paperGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    paper.connect(paperFilter).connect(paperGain).connect(ctx.destination);
    paper.start(now);
}
export function playStampHit() {
    if (typeof window === "undefined")
        return;
    if (prefersReducedMotion())
        return;
    const fire = () => {
        const ctx = audioContext();
        if (ctx && stampBuffer) {
            if (ctx.state === "suspended")
                void ctx.resume();
            const src = ctx.createBufferSource();
            src.buffer = stampBuffer;
            const gain = ctx.createGain();
            gain.gain.value = 0.95;
            src.connect(gain).connect(ctx.destination);
            src.start();
            return;
        }
        if (stampClip) {
            stampClip.currentTime = 0;
            void stampClip.play().catch(() => {
                if (ctx)
                    synthStampHit(ctx);
            });
            return;
        }
        if (ctx)
            synthStampHit(ctx);
    };
    window.setTimeout(fire, Math.round(IMPACT_AT * 1000));
}
function faceOf(stamp) {
    return stamp.querySelector(".ink-stamp-face") ?? stamp;
}
function clearStamp(stamp) {
    stamp.hidden = true;
    stamp.classList.remove("is-in", "is-human", "is-ai");
    faceOf(stamp).textContent = "";
}
function slamStamp(stamp, kind) {
    stamp.hidden = false;
    stamp.classList.remove("is-in", "is-human", "is-ai");
    stamp.classList.add(kind === "HUMAN" ? "is-human" : "is-ai");
    faceOf(stamp).textContent = kind;
    void stamp.offsetWidth;
    stamp.classList.add("is-in");
    playStampHit();
}
export class Sweep {
    handles;
    constructor(handles) {
        this.handles = handles;
    }
    lean(side) {
        this.handles.left.classList.toggle("is-lean", side === "left");
        this.handles.right.classList.toggle("is-lean", side === "right");
    }
    press(side) {
        const card = side === "left" ? this.handles.left : this.handles.right;
        this.handles.left.classList.remove("is-lean");
        this.handles.right.classList.remove("is-lean");
        card.classList.add("is-pressed", "is-picking");
        void unlockStampAudio();
    }
    async resolve(side, result) {
        const { left, right, leftStamp, rightStamp } = this.handles;
        const chosen = side === "left" ? left : right;
        const stamp = side === "left" ? leftStamp : rightStamp;
        const kind = stampForPick(side, result.humanSide);
        chosen.classList.toggle("is-hit", result.correct);
        chosen.classList.toggle("is-miss", !result.correct);
        slamStamp(stamp, kind);
        await wait(prefersReducedMotion() ? 180 : 900);
    }
    async deal(pair) {
        const h = this.handles;
        h.left.classList.remove("is-pressed", "is-picking", "is-hit", "is-miss", "is-lean");
        h.right.classList.remove("is-pressed", "is-picking", "is-hit", "is-miss", "is-lean");
        clearStamp(h.leftStamp);
        clearStamp(h.rightStamp);
        h.topic.textContent = pair.topic;
        h.leftText.textContent = pair.left;
        h.rightText.textContent = pair.right;
        h.pair.style.transform = "none";
        h.desk.style.opacity = "1";
        if (prefersReducedMotion())
            return;
        h.pair.classList.remove("is-fresh");
        void h.pair.offsetWidth;
        h.pair.classList.add("is-fresh");
        await wait(180);
    }
}
