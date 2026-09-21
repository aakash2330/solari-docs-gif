import { chromium, type Page } from "playwright";

export async function openBrowser({ headless = true, cdpUrl = "" } = {}) {
  const browser = cdpUrl
    ? await chromium.connectOverCDP(cdpUrl)
    : await chromium.launch({ headless });
  const page = await (await browser.newContext()).newPage();
  return {
    page,
    navigate: (url: string) => page.goto(url, { waitUntil: "domcontentloaded" }),
    // mode "ai" is what adds the [ref=eN] handles that ref2loc resolves.
    tree: () => page.locator("body").ariaSnapshot({ mode: "ai" }),
    click: (ref: string) => ref2loc(page, ref).click(),
    center: async (ref: string) => {
      const b = await ref2loc(page, ref).boundingBox();
      return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
    type: (ref: string, text: string) => ref2loc(page, ref).fill(text),
    screenshot: () => page.screenshot(),
    rasterize: async (svg: string, width: number, height: number) => {
      const p = await page.context().newPage();
      await p.setViewportSize({ width, height });
      await p.setContent(`<body style="margin:0">${svg}</body>`);
      const png = await p.screenshot({ omitBackground: true });
      await p.close();
      return png;
    },
    close: () => browser.close(),
  };
}

const ref2loc = (page: Page, ref: string) =>
  page.locator(`aria-ref=${ref.replace(/^\[?ref=|\]$/g, "")}`);
