# Radon End-to-End Tests

We use the [vscode-extension-tester](https://github.com/redhat-developer/vscode-extension-tester) library, together with the standard `chai` assertion library to write tests.  
This library provides extensive capabilities for interacting with VS Code, such as opening editors, executing commands, manipulating UI elements, or managing workspaces.  
Documentation: https://github.com/redhat-developer/vscode-extension-tester/wiki

The entire test suite is divided into smaller parts (describes). Tests within a single describe block should cover similar themes or functionality. Each describe block is placed in a separate file to keep the structure modular and easy to navigate.

## 1. Conventions and File Organization

- **File Naming:** Each `describe` block should be placed in a separate file inside `/ui-tests` named according to the following pattern:
  `[test suite number]-[test suite name].test.js` (e.g. 05-networkPanel.test.js)
- **Test Suite Number:** A unique identifier that allows running specific test suites. When adding a new suite, use the next available natural number (e.g., if `19` is taken, use `20`).
- **Locators:** Elements in `vscode-extension-tester` are localized using the `data-testid` HTML attribute.

- **App Naming:** Test apps are named according to their React Native or Expo version, following the convention `react-native-{version}` or `expo-{version}` (e.g., `react-native-81`, `expo-53`).

## 2. Code Structure

The diagram shows code structure

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
├── .env                       # env variables (e.g. Radon license key)
└── package.json
```

## 3. Adding a New Test

### Test Template

Below is a template for starting a new test file. The `driver` object is an instance of the WebDriver class, which provides high-level control over the running VS Code instance — for example, locating UI elements, clicking, typing, or waiting for specific conditions.

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

The actual test logic should be placed inside an `it` block. The hooks `before`, `beforeEach`, `after`, and `afterEach` can be used to define actions that run before or after each test or the entire `describe`. If they are not needed, they can simply be removed.

`/utils/helpers` provides two additional functions:

- `itIF(condition, testName, function)`
- `describeIf(condition, testName, function)`

These can be used to run specific tests only if a certain condition is met (e.g., the app is running on iOS).

### Useful Functions and Services

The `/services/` directory contains Service Classes with frequently used functions. Every service class must be initialized with the `driver`. Initialization should be done in `before` block inside `describe`.

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

  - `async RadonViewsService.activateRadonIDELicense()`
    - Activates Radon IDE license with key provided as enviromental variable.

- **AppManipulationService**

  - `async AppManipulationService.waitForAppToLoad()`
    - Waits for the application to load completely (is active for user).

- **ManagingDevicesService**
  - `async ManagingDevicesService.addNewDevice(newDeviceName)`
    - adds new device with given name and OS defined in `configuration.js`.

These are some of the most important and frequently used methods. There are additional functions as well, but their names are mostly self-explanatory and do not require detailed descriptions.

## 4. React Native Application

Test applications are available here: [radon-ide-test-apps](https://github.com/software-mansion-labs/radon-ide-test-apps).

### Communication with the App

Communication between the React Native app running in Radon and the tester app occurs via WebSocket. The tester app maintains an open WebSocket connection with the currently running app.

Requests to the React Native app are sent as stringified JSON in the following format:

```json
{
  "message": "message_name",
  "id": "unique request id"
}
```

`id` is a unique identifier for the request.
Some functionalities may require additional fields.


The app resopnds with the following format

```json
{
  "pos/value": "returned value",
  "id": "rewritten request id"
}
```

### Retrieving Coordinates and Data

`TrackableButton(id)` class is provided in React Native apps and allows retrieving its location on screen. To get the button’s coordinates, send a request with the message: `getPosition:{id}`.

The app returns coordinates in the following format:

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

**Other available endpoints include:**

- `getFontSize` - returns the device’s font size.
- `getOrientation` - returns the device orientation (`landscape`, `portrait`)
- `getColorSchema` - returns the device color scheme (`light`, `dark`)
- `getAppState` - returns the app state (`active`, `inactive`, `background`)
- `fetchData` - fetches data from a given URL, body and headers can also be provided if needed

  - correct format:

  ```json
  {
    "message": "fetchData",
    "url": "https://example.com",
    "body": {},
    "headers": {},
    "id": "unique request id"
  }
  ```

---

> [!NOTE]
> **Note:** Some specific tests may require changes in test apps.

## 5. Running Tests

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

> [!WARNING]
> **Note**: Running tests locally will remove any devices added in Radon IDE.

### CI / GitHub Actions

We aim to run tests on a locally hosted CI runner.

- Tests run automatically nightly.
- Tests can be triggered manually via the **Actions** tab on GitHub.
