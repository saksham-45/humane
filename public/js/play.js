import { getBoard, getMe, getNext, postGuess, usingFixture } from "./api.js";
import { Sweep } from "./sweep.js";
import { avatarSrc, isNextDone } from "./types.js";
function $(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`missing #${id}`);
    return el;
}
function paintFace(img, avatar, name) {
    img.src = avatarSrc(avatar);
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.decoding = "async";
    img.classList.add("ink-face");
    img.dataset.avatar = avatar;
    img.title = name;
}
function markFixture(root) {
    if (!usingFixture())
        return;
    root.dataset.fixture = "1";
    const banner = $("fixture-note");
    banner.hidden = false;
}
function paintHeader(me) {
    const name = $("you-name");
    name.textContent = me.username;
    paintFace($("you-face"), me.avatar, me.username);
    paintFace($("rail-face"), me.avatar, me.username);
    $("rail-name").textContent = me.username;
    $("score-today").textContent = String(me.scoreToday);
    $("rail-score").textContent = String(me.scoreToday);
    $("round-now").textContent = String(me.round);
    $("round-of").textContent = String(me.of);
}
function popScore(next, delta) {
    const score = $("score-today");
    const rail = $("rail-score");
    score.textContent = String(next);
    rail.textContent = String(next);
    if (delta > 0) {
        const pop = $("score-pop");
        pop.textContent = `+${delta}`;
        pop.classList.remove("is-on");
        void pop.offsetWidth;
        pop.classList.add("is-on");
        score.classList.add("is-pop");
        window.setTimeout(() => score.classList.remove("is-pop"), 280);
    }
}
function showDone(scoreToday, of = 5) {
    const overlay = $("done-booth");
    $("done-score").textContent = `Today ${scoreToday}/${of}`;
    overlay.hidden = false;
    overlay.classList.add("is-in");
    $("pair").style.transform = "translateX(0)";
    $("desk").classList.add("is-closed");
    void fillPodium();
}
async function fillPodium() {
    const podium = $("podium");
    podium.replaceChildren();
    const board = await getBoard();
    const top = board.today.slice(0, 3);
    if (top.length === 0) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "Board is quiet. You still played.";
        podium.append(empty);
        return;
    }
    top.forEach((row, i) => {
        const li = document.createElement("li");
        li.className = "podium-row";
        const img = document.createElement("img");
        paintFace(img, row.avatar, row.username);
        const place = document.createElement("span");
        place.className = "place";
        place.textContent = String(i + 1);
        const who = document.createElement("span");
        who.className = "who";
        who.textContent = row.username;
        const pts = document.createElement("span");
        pts.className = "pts";
        pts.textContent = `${row.scoreToday}`;
        li.append(place, img, who, pts);
        podium.append(li);
    });
}
function sideFromKey(event) {
    if (event.key === "1" || event.key === "ArrowLeft")
        return "left";
    if (event.key === "2" || event.key === "ArrowRight")
        return "right";
    return null;
}
async function boot() {
    const root = $("play-root");
    const meResult = await getMe();
    if ("unclaimed" in meResult) {
        location.replace("/");
        return;
    }
    const me = "fixture" in meResult ? meResult.fixture : meResult;
    markFixture(root);
    paintHeader(me);
    if (me.doneToday) {
        showDone(me.scoreToday, me.of);
        return;
    }
    const incoming = await getNext();
    if (isNextDone(incoming)) {
        showDone(incoming.scoreToday, 5);
        return;
    }
    const sweep = new Sweep({
        desk: $("desk"),
        pair: $("pair"),
        cut: $("cut"),
        left: $("card-left"),
        right: $("card-right"),
        topic: $("topic"),
        leftText: $("text-left"),
        rightText: $("text-right"),
        leftMark: $("mark-left"),
        rightMark: $("mark-right"),
        tell: $("tell"),
    });
    let pair = incoming;
    let round = me.round;
    let busy = false;
    await sweep.deal(pair);
    $("topic").textContent = pair.topic;
    const pick = async (side) => {
        if (busy)
            return;
        busy = true;
        sweep.press(side);
        const result = await postGuess(pair.id, side);
        popScore(result.scoreToday, result.pointsDelta);
        $("score-today").textContent = String(result.scoreToday);
        $("rail-score").textContent = String(result.scoreToday);
        await sweep.resolve(side, result);
        if (!result.next || result.round >= result.of) {
            showDone(result.scoreToday, result.of);
            return;
        }
        pair = result.next;
        round = Math.min(result.of, result.round + 1);
        paintHeader({
            username: me.username,
            avatar: me.avatar,
            scoreToday: result.scoreToday,
            round,
            of: result.of,
        });
        await sweep.deal(pair);
        busy = false;
    };
    $("card-left").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        void pick("left");
    });
    $("card-right").addEventListener("pointerdown", (event) => {
        event.preventDefault();
        void pick("right");
    });
    $("card-left").addEventListener("pointerenter", () => {
        if (!busy)
            sweep.lean("left");
    });
    $("card-right").addEventListener("pointerenter", () => {
        if (!busy)
            sweep.lean("right");
    });
    $("pair").addEventListener("pointerleave", () => {
        if (!busy)
            sweep.lean(null);
    });
    window.addEventListener("keydown", (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey)
            return;
        const side = sideFromKey(event);
        if (!side)
            return;
        event.preventDefault();
        void pick(side);
    });
}
void boot();
