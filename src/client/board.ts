import { getBoard, getComments, getMe, postComment, usingFixture } from "./api.js";
import { avatarSrc, type Board, type Comment, type Me } from "./types.js";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function paintFace(img: HTMLImageElement, avatar: string, name: string): void {
  img.src = avatarSrc(avatar);
  img.alt = "";
  img.width = 48;
  img.height = 48;
  img.decoding = "async";
  img.classList.add("ink-face");
  img.title = name;
}

function row(place: number, name: string, avatar: string, score: number, you: string | null): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "board-row" + (you && name === you ? " is-you" : "") + (place <= 3 ? ` place-${place}` : "");
  const rank = document.createElement("span");
  rank.className = "place";
  rank.textContent = String(place);
  const img = document.createElement("img");
  paintFace(img, avatar, name);
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = name || "—";
  const pts = document.createElement("span");
  pts.className = "pts";
  pts.textContent = String(score);
  li.append(rank, img, who, pts);
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

function commentItem(c: Comment): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "comment-row";
  const img = document.createElement("img");
  paintFace(img, c.avatar, c.username);
  const wrap = document.createElement("div");
  wrap.className = "comment-meta";
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = c.username;
  const body = document.createElement("p");
  body.className = "comment-body";
  body.textContent = c.body;
  wrap.append(who, body);
  li.append(img, wrap);
  return li;
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

  const form = $("comment-form") as HTMLFormElement;
  const body = $("comment-body") as HTMLTextAreaElement;
  const send = $("comment-send") as HTMLButtonElement;
  const err = $("comment-err");
  const hint = $("comment-hint");

  if (me) {
    paintFace($("you-face") as HTMLImageElement, me.avatar, me.username);
    $("you-name").textContent = me.username;
    $("score-today").textContent = String(me.scoreTotal);
    $("you-chip").hidden = false;
    if (me.doneToday) {
      $("today-line").textContent = `Today ${me.scoreToday}/${me.of}`;
    } else {
      $("today-line").textContent = `${me.round} / ${me.of}`;
    }
    hint.hidden = true;
    send.disabled = false;
  } else {
    $("you-chip").hidden = true;
    $("today-line").textContent = "today";
    hint.hidden = false;
    send.disabled = true;
    body.disabled = true;
  }

  const board: Board = await getBoard();
  const you = me?.username ?? null;
  fillList(
    "list-today",
    board.today.map((item, i) => row(i + 1, item.username, item.avatar, item.scoreToday, you)),
    "Nobody has a mark today.",
  );
  fillList(
    "list-alltime",
    board.alltime.map((item, i) => row(i + 1, item.username, item.avatar, item.scoreTotal, you)),
    "The all-time board is empty.",
  );

  const list = $("comment-list");
  const notes = await getComments();
  list.replaceChildren();
  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "board-empty";
    empty.textContent = "No notes yet.";
    list.append(empty);
  } else {
    list.append(...notes.map(commentItem));
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!me) return;
    err.hidden = true;
    send.disabled = true;
    const out = await postComment(body.value);
    send.disabled = false;
    if ("error" in out) {
      err.hidden = false;
      err.textContent = out.message;
      return;
    }
    body.value = "";
    const empty = list.querySelector(".board-empty");
    if (empty) empty.remove();
    list.prepend(commentItem(out));
  });
}

void boot();
