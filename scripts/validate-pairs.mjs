#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(join(root, "content/pairs.json"), "utf8");
const data = JSON.parse(raw);
const pairs = data.pairs;

const RESERVED = [
  "admin",
  "humane",
  "api",
  "null",
  "undefined",
];

const MIN = 30;
const LO = 80;
const HI = 180;
const errors = [];

if (!Array.isArray(pairs)) {
  fail("pairs.json must have a pairs array");
}

if (pairs.length < MIN) {
  errors.push(`need at least ${MIN} pairs, have ${pairs.length}`);
}

const ids = new Set();
const dates = new Set();

for (const [i, p] of pairs.entries()) {
  const loc = p.id || `#${i}`;
  for (const key of ["id", "topic", "human", "ai", "human_source", "ai_model", "tell", "play_date"]) {
    if (typeof p[key] !== "string" || !p[key].trim()) {
      errors.push(`${loc}: missing ${key}`);
    }
  }
  if (p.id) {
    if (ids.has(p.id)) errors.push(`${loc}: duplicate id`);
    ids.add(p.id);
  }
  if (p.play_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.play_date)) errors.push(`${loc}: bad play_date`);
    if (dates.has(p.play_date)) errors.push(`${loc}: duplicate play_date ${p.play_date}`);
    dates.add(p.play_date);
  }
  const hw = words(p.human);
  const aw = words(p.ai);
  if (hw < LO || hw > HI) errors.push(`${loc}: human word count ${hw} outside ${LO}–${HI}`);
  if (aw < LO || aw > HI) errors.push(`${loc}: ai word count ${aw} outside ${LO}–${HI}`);
  if (norm(p.human) === norm(p.ai)) errors.push(`${loc}: sides are identical`);
  const dump = `${p.human}\n${p.ai}\n${p.topic}\n${p.tell}\n${p.human_source}`;
  for (const word of RESERVED) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(dump)) errors.push(`${loc}: reserved word "${word}" in text dump`);
  }
}

if (errors.length) {
  console.error(`pairs invalid (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`ok: ${pairs.length} pairs`);

function words(s) {
  return String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
