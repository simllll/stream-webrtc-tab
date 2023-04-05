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

type StreamLaunchOptions = LaunchOptions &
  BrowserLaunchArgumentOptions &
  BrowserConnectOptions & {
    allowIncognito?: boolean;
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

const extensionPath = path.join(
  url.fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "extension"
);
const extensionId = "ohjhakbncjlkfjihjcoibikidbgccmoc";

export async function launch(
  arg1:
    | (StreamLaunchOptions &
        BrowserLaunchArgumentOptions &
        BrowserConnectOptions)
    | any,
  opts?: StreamLaunchOptions &
    BrowserLaunchArgumentOptions &
    BrowserConnectOptions
): Promise<Browser> {
  // if puppeteer library is not passed as first argument, then first argument is options
  if (typeof arg1.launch !== "function") {
    opts = arg1;
  }

  if (!opts) opts = {};

  if (!opts.args) opts.args = [];

  function addToArgs(arg: string, value?: string) {
    if (!value) {
      if (opts.args.includes(arg)) return;
      opts.args.push(arg);
      return;
    }
    let found = false;
    opts.args = opts.args.map((x) => {
      if (x.includes(arg)) {
        found = true;
        return `${x},${value}`;
      }
      return x;
    });
    if (!found) opts.args.push(arg + value);
  }

  addToArgs("--load-extension=", extensionPath);
  addToArgs("--disable-extensions-except=", extensionPath);
  addToArgs("--allowlisted-extension-id=", extensionId);
  addToArgs("--autoplay-policy=no-user-gesture-required");

  if (opts.defaultViewport?.width && opts.defaultViewport?.height)
    opts.args.push(
      `--window-size=${opts.defaultViewport.width}x${opts.defaultViewport.height}`
    );

  opts.headless = false;

  /*
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

  // opts.headless = false;

  let browser: BrowserWithExtension;
  if (typeof arg1.launch === "function") {
    browser = await arg1.launch(opts);
  } else {
    browser = await puppeteerLaunch(opts);
  }

  if (opts.allowIncognito) {
    const settings = await browser.newPage();
    await settings.goto(`chrome://extensions/?id=${extensionId}`);
    await settings.evaluate(() => {
      (document as any)
        .querySelector("extensions-manager")
        .shadowRoot.querySelector(
          "#viewManager > extensions-detail-view.active"
        )
        .shadowRoot.querySelector(
          "div#container.page-container > div.page-content > div#options-section extensions-toggle-row#allow-incognito"
        )
        .shadowRoot.querySelector("label#label input")
        .click();
    });
    await settings.close();
  }

  const extensionTarget = await browser.waitForTarget(
    (t) =>
      t.url() === `chrome-extension://${extensionId}/options.html` &&
      t.type() === "page"
  );

  if (!extensionTarget) {
    throw new Error("cannot load extension");
  }

  const videoCaptureExtension = await extensionTarget.page();

  if (!videoCaptureExtension) {
    throw new Error("cannot get page of extension");
  }

  browser.videoCaptureExtension = videoCaptureExtension;

  /*await browser.videoCaptureExtension.exposeFunction(
    "log",
    (...parameters: any) => {
      console.log("videoCaptureExtension", ...parameters);
    }
  );*/

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

  console.log('start recording', page.index, room, zoom);

  await page.bringToFront();

  await page.browser().videoCaptureExtension?.evaluate(
    (settings) => {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return START_RECORDING(settings);
      } catch (err) {
        console.error('err', err);
        return err;
      }
    },
    { index: page.index, room, zoom }
  );
  // page.browser().encoders?.set(page.index, encoder);

  return room || `room${page.index}`;
}
