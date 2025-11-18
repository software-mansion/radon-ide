const eventsStub = {
  addListener() {},
  removeListener() {},
};

interface Sender {
  tab: {
    id: string;
  };
}

interface Port {
  name: string;
  postMessage: (message: unknown) => void;
  onMessage: {
    addListener: (listener: (message: unknown) => void) => void;
    removeListener: (listener: (message: unknown) => void) => void;
  };
  onDisconnect: {
    addListener: (listener: () => void) => void;
    removeListener: (listener: () => void) => void;
  };
  sender: Sender;
}

type ConnectListener = (port: Port) => void;
const connectListeners: ConnectListener[] = [];
const onConnect = {
  addListener(listener: ConnectListener) {
    connectListeners.push(listener);
  },
  removeListener(listener: ConnectListener) {
    const idx = connectListeners.indexOf(listener);
    if (idx === -1) {
      return;
    }
    connectListeners.splice(idx, 1);
  },
};
export function addConnection(port: Port) {
  connectListeners.slice().forEach((listener) => listener(port));
}

type MessageListener = (request: unknown, sender: Sender) => void;
const messageListeners: MessageListener[] = [];
const onMessage = {
  addListener(listener: MessageListener) {
    messageListeners.push(listener);
  },
  removeListener(listener: MessageListener) {
    const idx = messageListeners.indexOf(listener);
    if (idx === -1) {
      return;
    }
    messageListeners.splice(idx, 1);
  },
};
export function postMessage(request: unknown, sender: Sender) {
  messageListeners.slice().forEach((listener) => listener(request, sender));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const chrome = {
  action: {
    enable() {},
    disable() {},
    setIcon() {},
  },
  commands: {
    onCommand: eventsStub,
    getAll(cb: unknown) {},
  },
  contextMenus: {
    create() {},
    removeAll() {},
    onClicked: eventsStub,
  },
  notifications: {
    clear() {},
    create() {},
    onClicked: eventsStub,
  },
  runtime: {
    onInstalled: eventsStub,
    openOptionsPage() {},
    onConnect,
    onMessage,
    onConnectExternal: eventsStub,
    onMessageExternal: eventsStub,
    id: "chrome-stub-runtime",
  },
  storage: {
    onChanged: eventsStub,
    local: {
      set() {},
      get(defaults: unknown, cb: (data: unknown) => void) {
        cb(defaults);
      },
    },
  },
  windows: {
    create() {},
    update() {},
  },
};
