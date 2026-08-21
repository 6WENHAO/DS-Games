/**
 * Headless Chromium only produces animation frames when something consumes
 * them. Starting a CDP screencast forces continuous frame production, which is
 * required to test anything time-based (requestAnimationFrame otherwise drops
 * to ~1 fps and every simulation looks broken).
 */
export async function forceFrames(page) {
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (f) => {
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.enable');
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 4,
    maxWidth: 160,
    maxHeight: 100,
    everyNthFrame: 1,
  });
  return cdp;
}

/** Measured real animation-frame rate over ~1 s. */
export function measureFps(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let c = 0;
        const t0 = performance.now();
        const step = () => {
          c++;
          if (performance.now() - t0 < 1000) requestAnimationFrame(step);
          else resolve(Math.round((c * 1000) / (performance.now() - t0)));
        };
        requestAnimationFrame(step);
      }),
  );
}

export const CHROMIUM_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
  '--hide-scrollbars',
  '--mute-audio',
];

export const EXE =
  process.env.CHROMIUM_PATH ??
  `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe`;
