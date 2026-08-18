import { PlayError, getBoard, getMe, getNext, postGuess, usingFixture } from "./api.js";
import { Sweep } from "./sweep.js";
import { avatarSrc, isNextDone, type Me, type Pair, type Side } from "./types.js";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function paintFace(img: HTMLImageElement, avatar: string, name: string): void {
  img.src = avatarSrc(avatar);
  img.alt = "";
  img.width = 40;
  img.height = 40;
  img.decoding = "async";
  img.classList.add("ink-face");
  img.dataset.avatar = avatar;
  img.title = name;
}

function markFixture(root: HTMLElement): void {
  if (!usingFixture()) return;
  root.dataset.fixture = "1";
  const banner = $("fixture-note");
  banner.hidden = false;
}

function paintHeader(me: Pick<Me, "username" | "avatar" | "scoreToday" | "scoreTotal" | "round" | "of">): void {
  const name = $("you-name");
  name.textContent = me.username;
  paintFace($("you-face") as HTMLImageElement, me.avatar, me.username);
  paintFace($("rail-face") as HTMLImageElement, me.avatar, me.username);
  $("rail-name").textContent = me.username;
  $("score-today").textContent = String(me.scoreTotal);
  $("rail-score").textContent = String(me.scoreTotal);
  $("round-now").textContent = String(me.round);
  $("round-of").textContent = String(me.of);
}

function popScore(next: number, delta: number): void {
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

function showDone(scoreToday: number, of = 5, scoreTotal = scoreToday): void {
  const overlay = $("done-booth");
  $("done-score").textContent = `Today ${scoreToday}/${of}`;
  $("done-all").textContent = `All-time ${scoreTotal}`;
  const you = document.getElementById("you-face") as HTMLImageElement | null;
  const done = document.getElementById("done-face") as HTMLImageElement | null;
  if (you && done && you.src) {
    done.src = you.src;
    done.hidden = false;
  } else if (done) {
    done.hidden = true;
  }
  overlay.hidden = false;
  overlay.classList.add("is-in");
  $("pair").style.transform = "translateX(0)";
  $("desk").classList.add("is-closed");
  void fillPodium();
}

async function fillPodium(): Promise<void> {
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

function sideFromKey(event: KeyboardEvent): Side | null {
  if (event.key === "1" || event.key === "ArrowLeft") return "left";
  if (event.key === "2" || event.key === "ArrowRight") return "right";
  return null;
}

async function boot(): Promise<void> {
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
    showDone(me.scoreToday, me.of, me.scoreTotal);
    return;
  }

  const incoming = await getNext();
  if (isNextDone(incoming)) {
    if (incoming.unclaimed) {
      location.replace("/");
      return;
    }
    showDone(incoming.scoreToday, 5, incoming.scoreTotal);
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

  let pair: Pair = incoming;
  let round = me.round;
  let busy = true;

  const pick = async (side: Side) => {
    if (busy) return;
    busy = true;
    sweep.press(side);
    try {
      const result = await postGuess(pair.id, side);
      popScore(result.scoreTotal, result.pointsDelta);
      $("score-today").textContent = String(result.scoreTotal);
      $("rail-score").textContent = String(result.scoreTotal);
      await sweep.resolve(side, result);
      if (!result.next || result.round >= result.of) {
        showDone(result.scoreToday, result.of, result.scoreTotal);
        return;
      }
      pair = result.next;
      round = Math.min(result.of, result.round + 1);
      paintHeader({
        username: me.username,
        avatar: me.avatar,
        scoreToday: result.scoreToday,
        scoreTotal: result.scoreTotal,
        round,
        of: result.of,
      });
      await sweep.deal(pair);
    } catch (err) {
      const code = err instanceof PlayError ? err.code : "";
      if (code === "done_today") {
        showDone(me.scoreToday, me.of, me.scoreTotal);
        return;
      }
      if (code === "need_name") {
        location.replace("/");
        return;
      }
      const tell = $("tell");
      tell.hidden = false;
      tell.textContent =
        err instanceof PlayError ? err.message : "That cut did not land. Try the other card.";
      const chosen = side === "left" ? $("card-left") : $("card-right");
      chosen.classList.remove("is-pressed", "is-picking");
      sweep.lean(null);
    }
    busy = false;
  };

  const bindCard = (id: string, side: Side) => {
    const el = $(id);
    el.addEventListener("pointerup", (event) => {
      if ("button" in event && event.button !== 0) return;
      event.preventDefault();
      void pick(side);
    });
  };
  bindCard("card-left", "left");
  bindCard("card-right", "right");
  $("card-left").addEventListener("pointerenter", () => {
    if (!busy) sweep.lean("left");
  });
  $("card-right").addEventListener("pointerenter", () => {
    if (!busy) sweep.lean("right");
  });
  $("pair").addEventListener("pointerleave", () => {
    if (!busy) sweep.lean(null);
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const side = sideFromKey(event);
    if (!side) return;
    event.preventDefault();
    void pick(side);
  });

  await sweep.deal(pair);
  $("topic").textContent = pair.topic;
  busy = false;
}

void boot();
