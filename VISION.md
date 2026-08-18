# HUMANE — captain vision (current)

This is the product. Older ideas below are dead. If a screen disagrees with this file, this file wins.

## What it is

A public website. People make a simple profile (unique name + a face) and play a daily game: five pairs of writing. Each pair is two cards, left and right. Either side can be the human. You pick the side you think a person wrote. Right guess = 1 point. Wrong = 0. The board is the sum of those points, every day, five texts at a time.

Not a chat Turing test. Not a ten-question quiz. Not one puzzle a day. Not an endless deck.

## The door (do this exactly like skribbl.io)

The name page is their home screen. Placement, color, type, motion. Our name and our faces. Do not invent a third layout.

- Full-screen navy `#124DA5` with a repeating tiled doodle wallpaper (pixel-crisp). Draw our own tile. Do not steal their image files.
- HUMANE wordmark above the booth, centered, crayon-colored letters, hard `3px 3px 0` shadow. Not inside the glass.
- One glass booth, about 400px, `rgba(12, 44, 150, 0.75)`, 3px corners, 15px pad.
- Top row only: name field + language dropdown (English is enough).
- Avatar well: 96px pixel face, three arrow hits on the left, three on the right, shuffle in the well. Click the face and it pops (scale 1.2 in 125ms).
- Fat green **Play!** `#53E237`, full width, 54px, white extra-bold, text-shadow. Hover `#38C41C` in 80ms. Press: `#30AA19` and `padding-top: 2px`.
- One blue **Board** under Play, same press physics, `#2C8DE7`.
- Nothing else on this page. No About / How / Today footer. No grape night. No cream paper. No lecture.

Type: Nunito 800 on the logo and Play. Inputs are white, dark text, grey border, blue focus ring `#56B2FD`.

Play stays dim until the name is valid (3–16 `a-z0-9_`). Then Play takes you into the game.

## After Play — the table

Skribbl lobby-to-rounds, not a blog.

- Header: your face, your name, SCORE, round `2 / 5`.
- Two fat cards. You pick the side you think is human.
- Keep the full sweep already liked: press, the cut covers that side, then it sweeps off.
- Two new cards come in. Repeat.
- After pair 5: stop. Show **Today n/5** and the board. Come back tomorrow for five new pairs.

A side or bottom strip like their player list: you highlighted, score under the name.

## Scoring

- +1 for each correct human pick. +0 for a miss. No “streak”. No SIGNAL. No Blood.
- Five official pairs per UTC day, same five for everyone that day.
- Board = all points ever, plus today’s n/5.
- Name is required to keep points. Face is saved with the name.

## Motion that stays

- Door: Play/Board physically press. Face bounce 125ms. Wallpaper does not crawl.
- Table: the full sweep they already said was cool, then the next pair. Not a thin static divider as the result.

## What this is not (killed)

- Wordle once-a-day single pair.
- Win-streak as the only score.
- Proof-desk cream / iron-oxide stamp / “SIGNAL” / “Blood.”
- Endless pairs until the deck dies.
- Guest play with no name.
- Grape-night “enhanced” booth as the name page. The name page is their door.

## Host

Public site. Private source. Free host (Cloudflare). No email, no password, no OAuth.
