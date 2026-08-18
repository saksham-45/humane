/**
 * Layout-only stand-in used when /api/me, /api/next, /api/guess, or /api/board
 * return 404 (Lane B mid-flight) or the worker is not mounted.
 *
 * This is not a second API. Live play always talks to /api/*.
 */
import type {
  Board,
  GuessResponse,
  Me,
  NextResponse,
  Pair,
  Side,
} from "./types.js";

type FixturePair = Pair & { humanSide: Side; tell: string; source: string; model: string };

const FIXTURE_PAIRS: FixturePair[] = [
  {
    id: "fx-0",
    topic: "bread",
    humanSide: "left",
    left:
      "The loaf cracked along the ear before I cut it. Steam still lived in the crumb. I tore a heel, salted it with my fingers, and ate standing at the board while the knife cooled.",
    right:
      "Bread is a staple food enjoyed across cultures. Freshly baked loaves offer a delightful aroma and a satisfying texture, presenting both challenges and opportunities for the home baker seeking consistent results.",
    tell: "The human names a heel, a board, and a knife that cools.",
    source: "layout fixture (not a live pair)",
    model: "fixture-register",
  },
  {
    id: "fx-1",
    topic: "rain",
    humanSide: "right",
    left:
      "Rainfall plays a vital role in ecosystems worldwide. Understanding precipitation patterns helps communities plan, adapt, and appreciate the interconnected nature of weather and daily life.",
    right:
      "It hit the tin first, then the alley. I counted eight breaths under the awning before the gutter found its voice. My socks were already lost.",
    tell: "The human counts breaths and loses socks.",
    source: "layout fixture (not a live pair)",
    model: "fixture-register",
  },
  {
    id: "fx-2",
    topic: "letters",
    humanSide: "left",
    left:
      "I keep the unsent ones in a biscuit tin. The paper smells like the drawer. When I open it the folds remember my hands better than I do.",
    right:
      "Letter writing remains a meaningful form of communication. Taking time to compose thoughtful messages can strengthen relationships and preserve memories for future generations.",
    tell: "The human keeps unsent letters in a biscuit tin.",
    source: "layout fixture (not a live pair)",
    model: "fixture-register",
  },
  {
    id: "fx-3",
    topic: "tools",
    humanSide: "right",
    left:
      "A well-organized toolkit enables efficient work. Selecting the right instrument for each task is a key principle of craftsmanship and professional practice.",
    right:
      "The rasp still had yesterday's oak in its teeth. I knocked it on the bench twice, then once more because two felt unfinished.",
    tell: "The human knocks the rasp three times for a private reason.",
    source: "layout fixture (not a live pair)",
    model: "fixture-register",
  },
  {
    id: "fx-4",
    topic: "travel",
    humanSide: "left",
    left:
      "The ferry horn found us before the dock did. Someone's orange peeled in the wind and the peel stuck to my coat the whole crossing.",
    right:
      "Travel broadens perspective by exposing us to new environments. Ferries remain a practical and scenic option, combining convenience with an opportunity to reflect on the journey.",
    tell: "The human gets orange peel stuck to a coat.",
    source: "layout fixture (not a live pair)",
    model: "fixture-register",
  },
];

const STORE = "humane.fixture";
const scoreTotalBase = 11;

type FixtureState = { played: string[]; scoreToday: number };

function loadState(): FixtureState {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (!raw) return { played: [], scoreToday: 0 };
    const parsed = JSON.parse(raw) as FixtureState;
    return {
      played: Array.isArray(parsed.played) ? parsed.played.map(String) : [],
      scoreToday: Number(parsed.scoreToday) || 0,
    };
  } catch {
    return { played: [], scoreToday: 0 };
  }
}

function saveState(): void {
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ played: [...played], scoreToday }));
  } catch {
    /* ignore quota / private mode */
  }
}

const initial = loadState();
let played = new Set<string>(initial.played);
let scoreToday = initial.scoreToday;

function storedName(): string {
  try {
    return localStorage.getItem("humane.username") || "you";
  } catch {
    return "you";
  }
}

function storedAvatar(): string {
  try {
    const raw = localStorage.getItem("humane.avatar") || "ink-0";
    return /^ink-\d{1,2}$/.test(raw) ? raw : "ink-0";
  } catch {
    return "ink-0";
  }
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextUnplayed(): FixturePair | undefined {
  return FIXTURE_PAIRS.find((pair) => !played.has(pair.id));
}

export function fixtureMe(): Me {
  const pending = nextUnplayed();
  const done = !pending;
  const round = done ? 5 : played.size + 1;
  return {
    username: storedName(),
    avatar: storedAvatar(),
    date: utcDate(),
    scoreToday,
    scoreTotal: scoreTotalBase + scoreToday,
    round,
    of: 5,
    doneToday: done,
  };
}

export function fixtureNext(): NextResponse {
  const pending = nextUnplayed();
  if (!pending) {
    return { done: true, scoreToday, scoreTotal: scoreTotalBase + scoreToday };
  }
  return {
    id: pending.id,
    topic: pending.topic,
    left: pending.left,
    right: pending.right,
  };
}

export function fixtureGuess(pairId: string, side: Side): GuessResponse {
  const found = FIXTURE_PAIRS.find((item) => item.id === pairId);
  const pair = found ?? FIXTURE_PAIRS[0];
  if (!pair) {
    throw new Error("fixture deck is empty");
  }
  if (!played.has(pair.id)) {
    played.add(pair.id);
    if (side === pair.humanSide) scoreToday += 1;
    saveState();
  }
  const correct = side === pair.humanSide;
  const pending = nextUnplayed();
  const next = pending
    ? { id: pending.id, topic: pending.topic, left: pending.left, right: pending.right }
    : null;
  return {
    correct,
    humanSide: pair.humanSide,
    tell: pair.tell,
    source: pair.source,
    model: pair.model,
    pointsDelta: correct ? 1 : 0,
    scoreToday,
    scoreTotal: scoreTotalBase + scoreToday,
    round: played.size,
    of: 5,
    next,
  };
}

export function fixtureBoard(): Board {
  const you = storedName();
  const face = storedAvatar();
  return {
    today: [
      { username: you, avatar: face, scoreToday },
      { username: "mira", avatar: "ink-2", scoreToday: 4 },
      { username: "kel", avatar: "ink-6", scoreToday: 3 },
      { username: "otto", avatar: "ink-9", scoreToday: 2 },
    ].sort((a, b) => b.scoreToday - a.scoreToday),
    alltime: [
      { username: "mira", avatar: "ink-2", scoreTotal: 41 },
      { username: you, avatar: face, scoreTotal: scoreTotalBase + scoreToday },
      { username: "kel", avatar: "ink-6", scoreTotal: 28 },
      { username: "nori", avatar: "ink-11", scoreTotal: 22 },
      { username: "otto", avatar: "ink-9", scoreTotal: 17 },
    ].sort((a, b) => b.scoreTotal - a.scoreTotal),
  };
}

export function resetFixture(): void {
  played = new Set();
  scoreToday = 0;
  saveState();
}
