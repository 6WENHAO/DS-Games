// ===========================================================================
//  Head-less smoke test for the single-file WebGPU build.
//
//    node tools/webgpu_smoketest.mjs [--seconds 25] [--show]
//
//  Launches Edge/Chrome with the DevTools protocol, opens ice_cave.html, lets
//  it render for a while, then reads back the page's own status line (adapter,
//  accumulated spp, ms/frame) and saves a screenshot to out/web_shot.png.
//  Exits non-zero if WebGPU failed or no samples were accumulated.
// ===========================================================================
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const page = "file:///" + join(root, "ice_cave.html").replace(/\\/g, "/");
const shot = join(root, "out", "web_shot.png");

const args = process.argv.slice(2);
const seconds = Number(args[args.indexOf("--seconds") + 1]) || 25;
const show = args.includes("--show");
const force = args.includes("--force");   // add the WebGPU/GPU-sandbox flags

const CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const { existsSync } = await import("node:fs");
const exe = CANDIDATES.find((p) => existsSync(p));
if (!exe) {
  console.error("no Edge/Chrome found in the usual locations");
  process.exit(2);
}

const port = 9222 + (process.pid % 500);
const profile = join(tmpdir(), "wgpu-smoke-" + process.pid);
mkdirSync(profile, { recursive: true });
mkdirSync(join(root, "out"), { recursive: true });

const flags = [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  // No --allow-file-access-from-files and (unless --force) no WebGPU flags:
  // this is exactly what happens when the user double-clicks ice_cave.html.
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--window-size=900,420",
  "about:blank",
];
if (force) flags.splice(2, 0, "--enable-unsafe-webgpu", "--disable-gpu-sandbox");
if (!show) flags.unshift("--headless=new");

console.log("launching " + exe.split("\\").pop() +
            (show ? " (visible)" : " (headless)") + (force ? " +webgpu flags" : " with no special flags"));
const proc = spawn(exe, flags, { stdio: "ignore", detached: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const t = list.find((x) => x.type === "page");
      if (t) return t;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error("DevTools endpoint never came up");
}

let id = 0;
function rpc(ws, method, params = {}) {
  return new Promise((res, rej) => {
    const mid = ++id;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== mid) return;
      ws.removeEventListener("message", onMsg);
      m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result);
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

let code = 0;
try {
  const t = await targets();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

  // collect console output and uncaught exceptions from the page
  const console_lines = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.consoleAPICalled") {
      const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      console_lines.push(`[${m.params.type}] ${txt}`);
    } else if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      console_lines.push(`[exception] ${d.text} ${d.exception?.description || ""}`);
    } else if (m.method === "Log.entryAdded") {
      console_lines.push(`[${m.params.entry.level}] ${m.params.entry.text}`);
    }
  });
  await rpc(ws, "Page.enable");
  await rpc(ws, "Runtime.enable");
  await rpc(ws, "Log.enable");
  await rpc(ws, "Page.navigate", { url: page });

  console.log(`rendering for ${seconds}s ...`);
  await sleep(Math.max(2000, seconds * 700));

  const evalJs = async (expr) =>
    (await rpc(ws, "Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;

  // exercise the refraction-chain probe the way a user does: click the canvas
  await evalJs(`(() => { const c = document.getElementById('cv'); const r = c.getBoundingClientRect();
      c.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width*0.47, clientY: r.top + r.height*0.62 }));
      return 1; })()`);
  await sleep(Math.max(1500, seconds * 300));

  const err = await evalJs("document.getElementById('errmsg').textContent");
  const stats = await evalJs("document.getElementById('stats').textContent");
  const probe = await evalJs("document.getElementById('log').textContent.slice(0,900)");
  const spp = await evalJs("(document.getElementById('stats').textContent.match(/累计 (\\d+) spp/)||[0,0])[1]");

  const cap = await rpc(ws, "Page.captureScreenshot", { format: "png" });
  writeFileSync(shot, Buffer.from(cap.data, "base64"));

  console.log("\n--- page status ------------------------------------------------");
  console.log(stats);
  if (err) console.log("errmsg: " + err);
  if (console_lines.length) {
    console.log("--- browser console --------------------------------------------");
    console.log(console_lines.slice(-25).join("\n"));
  }
  console.log("--- probe panel ------------------------------------------------");
  console.log(probe.split("\n").slice(0, 9).join("\n"));
  console.log("----------------------------------------------------------------");
  console.log("screenshot -> " + shot);

  const probed = /个界面事件/.test(probe);
  if (err) { console.error("\nFAIL: page reported a WebGPU failure"); code = 1; }
  else if (!Number(spp)) { console.error("\nFAIL: no samples accumulated (spp = 0)"); code = 1; }
  else if (!probed) { console.error("\nFAIL: refraction probe produced no output"); code = 1; }
  else console.log(`\nPASS: WebGPU rendered ${spp} spp and the refraction probe answered`);
  ws.close();
} catch (e) {
  console.error("FAIL: " + e.message);
  code = 1;
} finally {
  try { proc.kill(); } catch {}
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.exit(code);
