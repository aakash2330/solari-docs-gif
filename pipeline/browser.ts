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
    // Client-rendered docs are an empty shell at domcontentloaded; poll until the walk finds content.
    sections: async () => {
      await page.waitForFunction(`(${readSections})().sections.length > 0`);
      return page.evaluate(readSections);
    },
    close: () => browser.close(),
  };
}

const ref2loc = (page: Page, ref: string) =>
  page.locator(`aria-ref=${ref.replace(/^\[?ref=|\]$/g, "")}`);

function readSections() {
  const root = document.querySelector("main, article, [role=main]") ?? document.body;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const sections: { heading: string; level: number; anchor: string; text: string }[] = [];
  let current = { heading: "", level: 0, anchor: "", text: "" };

  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.textContent?.trim();
      if (t) current.text += (current.text ? " " : "") + t;
      continue;
    }
    const el = n as HTMLElement;
    if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|NAV)$/.test(el.tagName)) {
      walk.currentNode = el.lastChild ?? el;
      continue;
    }
    const level = /^H([1-6])$/.exec(el.tagName)?.[1];
    if (!level) continue;
    if (current.heading || current.text) sections.push(current);
    current = {
      heading: el.innerText.replace(/[\u200b-\u200d\ufeff]/g, "").trim(),
      level: +level,
      // No closest("[id]") fallback: a wrapper id links to the top of the page.
      anchor:
        el.id ||
        el.querySelector("[id]")?.id ||
        el.querySelector("a[href^='#']")?.getAttribute("href")?.slice(1) ||
        "",
      text: "",
    };
    walk.currentNode = el.lastChild ?? el;
  }
  if (current.heading || current.text) sections.push(current);
  return { title: document.title, sections };
}
