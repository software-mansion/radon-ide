import { spawn } from 'node:child_process';
import {
  chromium,
  firefox,
  webkit,
  devices,
  type Browser,
  type BrowserContext,
} from 'playwright';
import mri from 'mri';
import { intro, confirm, isCancel, cancel, spinner } from '@clack/prompts';
import { bgMagenta, dim, red } from 'kleur';
import fs from 'node:fs';
import path from 'node:path';

const truncateString = (str: string, maxLength: number) => {
  str = str.replace('http://', '').replace('https://', '').replace('www.', '');
  if (str.endsWith('/')) {
    str = str.slice(0, -1);
  }
  if (str.length > maxLength) {
    const half = Math.floor(maxLength / 2);
    const start = str.slice(0, half);
    const end = str.slice(str.length - (maxLength - half));
    return start + '…' + end;
  }
  return str;
};

const inferValidURL = (maybeURL: string) => {
  try {
    return new URL(maybeURL).href;
  } catch {
    try {
      return new URL(`https://${maybeURL}`).href;
    } catch {
      return 'about:blank';
    }
  }
};

const getBrowserDetails = async (browserType: string) => {
  switch (browserType) {
    case 'firefox':
      return { browserType: firefox, channel: undefined, name: 'firefox' };
    case 'webkit':
      return { browserType: webkit, channel: undefined, name: 'webkit' };
    default:
      return { browserType: chromium, channel: 'chrome', name: 'chrome' };
  }
};

const userAgentStrings = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.2227.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.3497.92 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
];

const applyStealthScripts = async (context: BrowserContext) => {
  await context.addInitScript(() => {
    // Override the navigator.webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Mock languages and plugins to mimic a real browser
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Remove Playwright-specific properties
    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__PW_inspect;

    // Redefine the headless property
    Object.defineProperty(navigator, 'headless', {
      get: () => false,
    });

    // Override the permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({
            state: Notification.permission,
          } as PermissionStatus)
        : originalQuery(parameters);
  });
};

const init = async () => {
  intro(`${bgMagenta('[·]')} React Scan`);
  const args = mri(process.argv.slice(2));
  let browser: Browser | undefined;

  const device = devices[args.device];
  const { browserType, channel } = await getBrowserDetails(args.browser);

  const contextOptions = {
    headless: false,
    channel,
    ...device,
    acceptDownloads: true,
    viewport: null,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    args: [
      '--enable-webgl',
      '--use-gl=swiftshader',
      '--enable-accelerated-2d-canvas',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ],
    userAgent:
      userAgentStrings[Math.floor(Math.random() * userAgentStrings.length)],
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  };

  try {
    browser = await browserType.launch({
      headless: false,
      channel,
    });
  } catch {
    /**/
  }

  if (!browser) {
    try {
      browser = await browserType.launch({ headless: false });
    } catch {
      await new Promise<void>(async (resolve, reject) => {
        const shouldInstall = await confirm({
          message:
            'No drivers found. Install Playwright Chromium driver to continue?',
        });
        if (isCancel(shouldInstall)) {
          cancel('Operation cancelled.');
          process.exit(0);
        }
        if (!shouldInstall) return process.exit(0);

        const installProcess = spawn(
          'npx',
          ['playwright@latest', 'install', 'chromium'],
          { stdio: 'inherit' },
        );

        installProcess.on('close', (code) => {
          if (!code) return resolve();
          reject(new Error(`Installation process exited with code ${code}`));
        });

        installProcess.on('error', (err) => {
          reject(err);
        });
      });

      try {
        browser = await chromium.launch({ headless: false });
      } catch {
        cancel(
          'No browser could be launched. Please run `npx playwright install` to install browser drivers.',
        );
      }
    }
  }

  if (!browser) {
    cancel(
      'No browser could be launched. Please run `npx playwright install` to install browser drivers.',
    );
    return;
  }

  const context = await browser.newContext(contextOptions);
  await applyStealthScripts(context);

  await context.addInitScript({
    content: `(() => {
      const NO_OP = () => {};
      let i = 0;
      globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        checkDCE: NO_OP,
        supportsFiber: true,
        renderers: new Map(),
        onScheduleFiberRoot: NO_OP,
        onCommitFiberRoot: NO_OP,
        onCommitFiberUnmount: NO_OP,
        inject(renderer) {
          const nextID = ++i;
          this.renderers.set(nextID, renderer);
          return nextID;
        },
      };
    })();`,
  });

  const page = await context.newPage();

  const scriptContent = fs.readFileSync(
    path.resolve(__dirname, './auto.global.js'),
    'utf8',
  );

  const inputUrl = args._[0] || 'about:blank';

  const urlString = inferValidURL(inputUrl);

  await page.goto(urlString);
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);

  await page.addScriptTag({
    content: `${scriptContent}\n//# sourceURL=react-scan.js`,
  });

  const pollReport = async () => {
    if (page.url() !== currentURL) return;
    await page.evaluate(() => {
      const globalHook = globalThis.__REACT_SCAN__;
      if (!globalHook) return;
      let count = 0;
      globalHook.ReactScanInternals.onRender = (fiber, renders) => {
        let localCount = 0;
        for (const render of renders) {
          localCount += render.count;
        }
        count = localCount;
      };
      const reportData = globalHook.ReactScanInternals.Store.reportData;
      if (!Object.keys(reportData).length) return;

      console.log('REACT_SCAN_REPORT', count);
    });
  };

  let count = 0;
  let currentSpinner: ReturnType<typeof spinner> | undefined;
  let currentURL = urlString;

  let interval: ReturnType<typeof setInterval>;

  const inject = async (url: string) => {
    if (interval) clearInterval(interval);
    currentURL = url;
    const truncatedURL = truncateString(url, 50);
    currentSpinner?.stop(`${truncatedURL}${count ? ` (×${count})` : ''}`);
    currentSpinner = spinner();
    currentSpinner.start(dim(`Scanning: ${truncatedURL}`));
    count = 0;

    try {
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);

      const hasReactScan = await page.evaluate(() => {
        return Boolean(globalThis.__REACT_SCAN__);
      });

      if (!hasReactScan) {
        await page.addScriptTag({
          content: scriptContent,
        });
      }

      await page.waitForTimeout(100);

      await page.evaluate(() => {
        if (typeof globalThis.reactScan !== 'function') return;
        globalThis.reactScan({ report: true });
      });

      interval = setInterval(() => {
        pollReport().catch(() => {});
      }, 1000);
    } catch (e) {
      currentSpinner?.stop(red(`Error: ${truncatedURL}`));
    }
  };

  await inject(urlString);

  page.on('framenavigated', async (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    inject(url);
  });

  page.on('console', async (msg) => {
    const text = msg.text();
    if (!text.startsWith('REACT_SCAN_REPORT')) {
      return;
    }
    const reportDataString = text.replace('REACT_SCAN_REPORT', '').trim();
    try {
      count = parseInt(reportDataString, 10);
    } catch {
      return;
    }

    const truncatedURL = truncateString(currentURL, 50);
    if (currentSpinner) {
      currentSpinner.message(
        dim(`Scanning: ${truncatedURL}${count ? ` (×${count})` : ''}`),
      );
    }
  });
};

void init();
