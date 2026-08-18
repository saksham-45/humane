import { getBoard, getMe, usingFixture } from "./api.js";
import { avatarSrc, type Board, type Me } from "./types.js";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function paintFace(img: HTMLImageElement, avatar: string, name: string): void {
  img.src = avatarSrc(avatar);
  img.alt = "";
  img.width = 32;
  img.height = 32;
  img.decoding = "async";
  img.classList.add("ink-face");
  img.title = name;
}

function row(name: string, avatar: string, score: number, you: string | null): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "board-row" + (you && name === you ? " is-you" : "");
  const img = document.createElement("img");
  paintFace(img, avatar, name);
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = name || "—";
  const pts = document.createElement("span");
  pts.className = "pts";
  pts.textContent = String(score);
  li.append(img, who, pts);
  return li;
}

function fillList(id: string, rows: HTMLLIElement[], empty: string): void {
  const list = $(id);
  list.replaceChildren();
  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "board-empty";
    li.textContent = empty;
    list.append(li);
    return;
  }
  list.append(...rows);
}

async function boot(): Promise<void> {
  const root = $("board-root");
  const meResult = await getMe();
  let me: Me | null = null;
  if ("fixture" in meResult) me = meResult.fixture;
  else if (!("unclaimed" in meResult)) me = meResult;

  if (usingFixture()) {
    root.dataset.fixture = "1";
    $("fixture-note").hidden = false;
  }

  if (me) {
    paintFace($("you-face") as HTMLImageElement, me.avatar, me.username);
    $("you-name").textContent = me.username;
    $("score-today").textContent = String(me.scoreToday);
    $("you-chip").hidden = false;
    if (me.doneToday) {
      $("today-line").textContent = `Today ${me.scoreToday}/${me.of}`;
    } else {
      $("today-line").textContent = `${me.round} / ${me.of}`;
    }
  } else {
    $("you-chip").hidden = true;
    $("today-line").textContent = "today";
  }

  const board: Board = await getBoard();
  const you = me?.username ?? null;
  fillList(
    "list-today",
    board.today.map((item) => row(item.username, item.avatar, item.scoreToday, you)),
    "Nobody has a mark today.",
  );
  fillList(
    "list-alltime",
    board.alltime.map((item) => row(item.username, item.avatar, item.scoreTotal, you)),
    "The all-time board is empty.",
  );
}

void boot();
