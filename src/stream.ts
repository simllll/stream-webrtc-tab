import {
  launch as puppeteerLaunch,
  LaunchOptions,
  Browser,
  Page,
  BrowserLaunchArgumentOptions,
  BrowserConnectOptions,
} from "puppeteer";
import * as path from "path";
import * as url from "url";

type PageWithExtension = Omit<Page, "browser"> & {
  browser(): BrowserWithExtension;
};

let currentIndex = 0;

declare module "puppeteer" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Page {
    index: number;
    startStream(): Promise<string>;
  }
}

type BrowserWithExtension = Browser & { videoCaptureExtension?: Page };

export async function launch(
  arg1:
    | (LaunchOptions & BrowserLaunchArgumentOptions & BrowserConnectOptions)
    | any,
  opts?: LaunchOptions & BrowserLaunchArgumentOptions & BrowserConnectOptions
): Promise<Browser> {
  // if puppeteer library is not passed as first argument, then first argument is options
  if (typeof arg1.launch !== "function") {
    opts = arg1;
  }

  if (!opts) opts = {};

  if (!opts.args) opts.args = [];

  const extensionPath = path.join(
    url.fileURLToPath(new URL(".", import.meta.url)),
    "..",
    "extension"
  );
  const extensionId = "kbjabgdnooobcmmkfahbjmgndhabibkd";
  let loadExtension = false;
  let loadExtensionExcept = false;
  let whitelisted = false;

  opts.args = opts.args.map((x) => {
    if (x.includes("--load-extension=")) {
      loadExtension = true;
      return `${x},${extensionPath}`;
    }
    if (x.includes("--disable-extensions-except=")) {
      loadExtensionExcept = true;
      return `--disable-extensions-except=${extensionPath},${x.split("=")[1]}`;
    }
    if (x.includes("--whitelisted-extension-id")) {
      whitelisted = true;
      return `${x},${extensionId}`;
    }

    return x;
  });

  if (!loadExtension) opts.args.push(`--load-extension=${extensionPath}`);
  if (!loadExtensionExcept)
    opts.args.push(`--disable-extensions-except=${extensionPath}`);
  if (!whitelisted) opts.args.push(`--whitelisted-extension-id=${extensionId}`);
  if (opts.defaultViewport?.width && opts.defaultViewport?.height)
    opts.args.push(
      `--window-size=${opts.defaultViewport?.width}x${opts.defaultViewport?.height}`
    );
  /* if (opts.defaultViewport?.deviceScaleFactor) {
		// opts.args.push(`--device-scale-factor=${opts.defaultViewport?.deviceScaleFactor}`);
		opts.args.push(
			// --device-scale-factor=${opts.defaultViewport?.deviceScaleFactor}
			`--force-device-scale-factor=${opts.defaultViewport?.deviceScaleFactor}`
		);
	} */
  // opts.args.push('--enable-use-zoom-for-dsf');

  opts.headless = false;

  let browser: BrowserWithExtension;
  if (typeof arg1.launch === "function") {
    browser = await arg1.launch(opts);
  } else {
    browser = await puppeteerLaunch(opts);
  }

  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (t) =>
      t._getTargetInfo().title === "Video Capture" &&
      t.type() === "background_page"
  );

  if (!extensionTarget) {
    throw new Error("cannot load extension");
  }

  const videoCaptureExtension = await extensionTarget.page();

  if (!videoCaptureExtension) {
    throw new Error("cannot get page of extension");
  }

  browser.videoCaptureExtension = videoCaptureExtension;

  await browser.videoCaptureExtension.exposeFunction(
    "log",
    (...parameters: any) => {
      console.log("videoCaptureExtension", ...parameters);
    }
  );

  return browser;
}

export async function startStream(
  page: PageWithExtension,
  room?: string,
  zoom?: number
) {
  await page.bringToFront();

  if (page.index === undefined) {
    page.index = currentIndex++;
  }

  await page.browser().videoCaptureExtension?.evaluate(
    (settings) => {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return START_RECORDING(settings);
      } catch (err) {
        return err;
      }
    },
    { index: page.index, room, zoom }
  );
  // page.browser().encoders?.set(page.index, encoder);

  return room || `room${page.index}`;
}
