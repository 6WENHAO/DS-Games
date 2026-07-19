# 深夜勤務 — Night Shift

A web-based Japanese horror game inspired by **Chilla's Art**.
First-person, PS1/VHS aesthetic, set during a night shift at a lonely convenience store (コンビニ).

Built with **Three.js** (WebGL). All audio is generated procedurally with the Web Audio API,
and all textures/the ghost are drawn on `<canvas>` at runtime — no external asset files.

## How to run

**Just double-click `index.html`.** That's it — it opens in your browser and plays.

(It loads Three.js from a CDN, so you need an internet connection the first time.
Everything else — audio, textures, the ghost — is generated in-code, no asset files.)

> Optional: if you prefer a local server, run `node serve.js` (or double-click
> `start.bat`) and open http://localhost:8080

## Controls

| Key | Action |
|-----|--------|
| WASD | 移動 / Move |
| Mouse | 視点 / Look |
| E | 調べる / Interact |
| F | 懐中電灯 / Flashlight |
| Shift | 走る / Run |
| Esc | 一時停止 / Pause (click to resume) |

Headphones recommended.

## Objective

Complete the night-shift tasks: turn on the lights, clock in, stock the shelves,
check the refrigerators, and inspect the back room… before you can leave.
Something in the store is watching. Keep your 正気 (sanity) up.

## Features

- First-person controller with collision, head-bob, footsteps, flashlight
- Procedural convenience-store interior (shelves, drink coolers, register, back room)
- PS1 look: low-res render, vertex snapping, dithered upscale
- VHS/CRT post-processing: chromatic aberration, scanlines, grain, tracking distortion, vignette
- Camcorder HUD (REC, timestamp, battery, tape label)
- Task/objective system with Japanese UI, readable notes
- Escalating horror: flickering fluorescent lights, entrance chime, whispers,
  creaking doors, a stalking ghost (幽霊), heartbeat, and a jump-scare finale
- Two endings + restart

## Structure

```
index.html          markup + overlays
css/style.css        UI / VHS overlays
js/main.js           game loop, state, tasks, events
js/world.js          environment builder + colliders
js/player.js         first-person controller
js/ghost.js          ghost AI / apparitions
js/audio.js          procedural Web Audio engine
js/postprocess.js    PS1/VHS render pipeline
serve.js / start.bat local server
```

Credits: fan project inspired by Chilla's Art. WebGL tech demo.
