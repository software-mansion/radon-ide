# Radon End-to-End Tests

We use the [vscode-extension-tester](https://github.com/redhat-developer/vscode-extension-tester/wiki) library, with standard assertion library `chai` to write tests

The entire test suite is divided into smaller parts (`describes`). Tests within a single `describe` block should cover similar themes or functionality.

## 1. Conventions and File Organization

- **File Naming:** Each `describe` block should be placed in a separate file inside `/ui-tests` named according to the following pattern:
  `[test suite number]-[test suite name].test.js`
  - **Test Suite Number:** A unique identifier that allows running specific test suites. When adding a new suite, use the next available natural number (e.g., if `19` is taken, use `20`).
- **Locators:** Elements in `vscode-extension-tester` are localized using the `data-testid` HTML attribute.

- **App Naming:** Test apps are named according to their React Native or Expo version, following the convention `react-native-{version}` or `expo-{version}` (e.g., `react-native-81`, `expo-53`).

## 2. Code Structure

### Directory Layout

```text
root/
├── data/                      # Storage for temporary test files
├── scripts/
│   ├── run_ui_tests.sh        # Running tests script
│   └── ...
├── screenshots/               # screenshots on test fail
├── server/                    # Server logic
│   └── webSocketServer.js     # WS server (communication with app)
├── services/                  # Reusable Service Classes
│   ├── AppManipulationService.js
│   ├── ElementHelperService.js
│   ├── RadonViewsService.js
│   └── RadonViewsService.js
├── ui-tests/                  # Test Suites
│   ├── 01-smoke.test.js
│   ├── 02-GUIButtons.test.js
│   ├── ...
│   └── setupTest.js           # Global test setup
├── utils/                     # utilities and common functions
│   ├── constants.test.js
│   ├── helpers.test.js
│   └── ...
├── configuration.js           # Global test configuration
└── package.json
```

## 3. Adding a New Test

### Test Template

Below is a template for starting a new test file. The `driver` object is an instance of the `WebDriver` class, which allows interactions with the opened VS Code instance (e.g., finding elements, clicking, waiting).

```js
import { get } from "./setupTest.js";

safeDescribe("19 - new tests", async () => {
  let driver;

  before(() => {
    driver = get().driver;
  });

  beforeEach(() => {});

  afterEach(() => {});

  after(() => {});

  it("test case name", () => {});
});
```

### Useful Functions and Services

The `/services/` directory contains Service Classes with frequently used functions. Every service class must be initialized with the `driver`.

**Key Methods:**

- **ElementHelperService**

  - `async ElementHelperService.findAndWaitForElementByTag(tagName)`
    - Finds an HTML element with the given tag (waits for it to appear).
  - `async ElementHelperService.findAndClickElementByTag(tagName)`
    - Clicks an element with the given tag.

- **RadonViewsService**

  - `async RadonViewsService.openRadonIDEPanel()`

    - Opens the main Radon IDE panel.

    - > **Note:** The Radon IDE view works inside an `iframe` within VS Code. To find an element inside the Radon view, you must switch to the correct iframe. This method handles that switch automatically.

- **AppManipulationService**
  - `async AppManipulationService.waitForAppToLoad()`
    - Waits for the application to load completely.

## 4. React Native Application

Test applications are available here: [radon-ide-test-apps](https://github.com/software-mansion-labs/radon-ide-test-apps).

### Communication with the App

Communication between the React Native app running in Radon and the tester app occurs via WebSocket.

Requests to the React Native app are sent as stringified JSON in the following format:

```json
{
  "message": "message_name",
  "id": "unique_request_id"
}
```

Where `id` is a unique request ID.

### Retrieving Coordinates and Data

Our React Native apps provide a `TrackableButton(id)` class. To get the button coordinates, send a request with the message: `getPosition:{id}`.

The response returns coordinates in the following format:

```json
{
  "x": 0.1,
  "y": 0.2,
  "width": 0.05,
  "height": 0.1
}
```

- The values are relative to the screen size.
- The origin (0,0) is the top-left corner.

**Some of other available endpoints include:**

- `getFontSize`
- `getOrientation`
- `getColorSchema`
- ...

## 4. Running Tests

### Local Execution

Tests can be run on a local machine using the command below.

> [!NOTE]
> **Note**: To run tests locally, you need a `.env` file in the root directory with the `RADON_IDE_LICENSE_KEY` variable containing an active Radon license key.

Syntax:
`npm run prepare-and-run-tests -- <app-name> <space-separated test numbers>`

Example (running tests 1, 2, 3, and 4 on the `react-native-81` app):

```bash
npm run prepare-and-run-tests -- react-native-81 1 2 3 4
```

> [!NOTE] 
> **Note**: side effect of running tests locally is fact that devices added in Radon IDE will be deleted.

### CI / GitHub Actions

We aim to run tests on a locally hosted CI runner.

- Tests run automatically nightly.
- Tests can be triggered manually via the **Actions** tab on GitHub.
