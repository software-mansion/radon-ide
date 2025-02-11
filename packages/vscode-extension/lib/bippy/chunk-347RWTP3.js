/**
 * @license bippy
 *
 * Copyright (c) Aiden Bai, Million Software, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// src/rdt-hook.ts
var version = "0.2.24";
var BIPPY_INSTRUMENTATION_STRING = `bippy-${version}`;
var objectDefineProperty = Object.defineProperty;
var objectHasOwnProperty = Object.prototype.hasOwnProperty;
var NO_OP = () => {
};
var checkDCE = (fn) => {
  try {
    const code = Function.prototype.toString.call(fn);
    if (code.indexOf("^_^") > -1) {
      setTimeout(() => {
        throw new Error(
          "React is running in production mode, but dead code elimination has not been applied. Read how to correctly configure React for production: https://reactjs.org/link/perf-use-production-build"
        );
      });
    }
  } catch {
  }
};
var isRealReactDevtools = (rdtHook = getRDTHook()) => {
  return "getFiberRoots" in rdtHook;
};
var isReactRefreshOverride = false;
var injectFnStr = void 0;
var isReactRefresh = (rdtHook = getRDTHook()) => {
  if (isReactRefreshOverride) return true;
  if (typeof rdtHook.inject === "function") {
    injectFnStr = rdtHook.inject.toString();
  }
  return Boolean(injectFnStr?.includes("(injected)"));
};
var onActiveListeners = /* @__PURE__ */ new Set();
var installRDTHook = (onActive) => {
  const renderers = /* @__PURE__ */ new Map();
  let i = 0;
  const rdtHook = {
    checkDCE,
    supportsFiber: true,
    supportsFlight: true,
    hasUnsupportedRendererAttached: false,
    renderers,
    onCommitFiberRoot: NO_OP,
    onCommitFiberUnmount: NO_OP,
    onPostCommitFiberRoot: NO_OP,
    inject(renderer) {
      const nextID = ++i;
      renderers.set(nextID, renderer);
      if (!rdtHook._instrumentationIsActive) {
        rdtHook._instrumentationIsActive = true;
        onActiveListeners.forEach((listener) => listener());
      }
      return nextID;
    },
    _instrumentationSource: BIPPY_INSTRUMENTATION_STRING,
    _instrumentationIsActive: false
  };
  try {
    objectDefineProperty(globalThis, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
      value: rdtHook,
      configurable: true,
      writable: true
    });
    const originalWindowHasOwnProperty = window.hasOwnProperty;
    let hasRanHack = false;
    objectDefineProperty(window, "hasOwnProperty", {
      value: function() {
        if (!hasRanHack && arguments[0] === "__REACT_DEVTOOLS_GLOBAL_HOOK__") {
          globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = void 0;
          hasRanHack = true;
          return -0;
        }
        return originalWindowHasOwnProperty.apply(this, arguments);
      },
      configurable: true,
      writable: true
    });
  } catch {
    patchRDTHook(onActive);
  }
  return rdtHook;
};
var patchRDTHook = (onActive) => {
  if (onActive) {
    onActiveListeners.add(onActive);
  }
  try {
    const rdtHook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!rdtHook) return;
    if (!rdtHook._instrumentationSource) {
      isReactRefreshOverride = isReactRefresh(rdtHook);
      rdtHook.checkDCE = checkDCE;
      rdtHook.supportsFiber = true;
      rdtHook.supportsFlight = true;
      rdtHook.hasUnsupportedRendererAttached = false;
      rdtHook._instrumentationSource = BIPPY_INSTRUMENTATION_STRING;
      rdtHook._instrumentationIsActive = false;
      if (rdtHook.renderers.size) {
        rdtHook._instrumentationIsActive = true;
        onActiveListeners.forEach((listener) => listener());
        return;
      }
      const prevInject = rdtHook.inject;
      if (isReactRefresh(rdtHook) && !isRealReactDevtools()) {
        isReactRefreshOverride = true;
        let nextID = rdtHook.inject(null);
        if (nextID) {
          rdtHook._instrumentationIsActive = true;
        }
        rdtHook.inject = () => nextID++;
      } else {
        rdtHook.inject = (renderer) => {
          const id = prevInject(renderer);
          rdtHook._instrumentationIsActive = true;
          onActiveListeners.forEach((listener) => listener());
          return id;
        };
      }
    }
    if (rdtHook.renderers.size || rdtHook._instrumentationIsActive || // depending on this to inject is unsafe, since inject could occur before and we wouldn't know
    isReactRefresh()) {
      onActive?.();
    }
  } catch {
  }
};
var hasRDTHook = () => {
  return objectHasOwnProperty.call(
    globalThis,
    "__REACT_DEVTOOLS_GLOBAL_HOOK__"
  );
};
var getRDTHook = (onActive) => {
  if (!hasRDTHook()) {
    return installRDTHook(onActive);
  }
  patchRDTHook(onActive);
  return globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
};
var isClientEnvironment = () => {
  return Boolean(
    typeof window !== "undefined" && (window.document?.createElement || window.navigator?.product === "ReactNative")
  );
};

// src/install-hook-script-string.ts
var INSTALL_HOOK_SCRIPT_STRING = "(()=>{try{var t=()=>{};const n=new Map;let o=0;globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__={checkDCE:t,supportsFiber:!0,supportsFlight:!0,hasUnsupportedRendererAttached:!1,renderers:n,onCommitFiberRoot:t,onCommitFiberUnmount:t,onPostCommitFiberRoot:t,inject(t){var e=++o;return n.set(e,t),globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__._instrumentationIsActive=!0,e},_instrumentationIsActive:!1,_script:!0}}catch{}})()";

// src/core.ts
var FunctionComponentTag = 0;
var ClassComponentTag = 1;
var HostRootTag = 3;
var HostComponentTag = 5;
var HostTextTag = 6;
var FragmentTag = 7;
var ContextConsumerTag = 9;
var ForwardRefTag = 11;
var SuspenseComponentTag = 13;
var MemoComponentTag = 14;
var SimpleMemoComponentTag = 15;
var DehydratedSuspenseComponentTag = 18;
var OffscreenComponentTag = 22;
var LegacyHiddenComponentTag = 23;
var HostHoistableTag = 26;
var HostSingletonTag = 27;
var CONCURRENT_MODE_NUMBER = 60111;
var ELEMENT_TYPE_SYMBOL_STRING = "Symbol(react.element)";
var TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING = "Symbol(react.transitional.element)";
var CONCURRENT_MODE_SYMBOL_STRING = "Symbol(react.concurrent_mode)";
var DEPRECATED_ASYNC_MODE_SYMBOL_STRING = "Symbol(react.async_mode)";
var PerformedWork = 1;
var Placement = 2;
var Hydrating = 4096;
var Update = 4;
var Cloned = 8;
var ChildDeletion = 16;
var ContentReset = 32;
var Snapshot = 1024;
var Visibility = 8192;
var MutationMask = Placement | Update | ChildDeletion | ContentReset | Hydrating | Visibility | Snapshot;
var isValidElement = (element) => typeof element === "object" && element != null && "$$typeof" in element && // react 18 uses Symbol.for('react.element'), react 19 uses Symbol.for('react.transitional.element')
[
  ELEMENT_TYPE_SYMBOL_STRING,
  TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING
].includes(String(element.$$typeof));
var isValidFiber = (fiber) => typeof fiber === "object" && fiber != null && "tag" in fiber && "stateNode" in fiber && "return" in fiber && "child" in fiber && "sibling" in fiber && "flags" in fiber;
var isHostFiber = (fiber) => {
  switch (fiber.tag) {
    case HostComponentTag:
    // @ts-expect-error: it exists
    case HostHoistableTag:
    // @ts-expect-error: it exists
    case HostSingletonTag:
      return true;
    default:
      return typeof fiber.type === "string";
  }
};
var isCompositeFiber = (fiber) => {
  switch (fiber.tag) {
    case FunctionComponentTag:
    case ClassComponentTag:
    case SimpleMemoComponentTag:
    case MemoComponentTag:
    case ForwardRefTag:
      return true;
    default:
      return false;
  }
};
var traverseContexts = (fiber, selector) => {
  try {
    const nextDependencies = fiber.dependencies;
    const prevDependencies = fiber.alternate?.dependencies;
    if (!nextDependencies || !prevDependencies) return false;
    if (typeof nextDependencies !== "object" || !("firstContext" in nextDependencies) || typeof prevDependencies !== "object" || !("firstContext" in prevDependencies)) {
      return false;
    }
    let nextContext = nextDependencies.firstContext;
    let prevContext = prevDependencies.firstContext;
    while (nextContext && typeof nextContext === "object" && "memoizedValue" in nextContext || prevContext && typeof prevContext === "object" && "memoizedValue" in prevContext) {
      if (selector(nextContext, prevContext) === true) return true;
      nextContext = nextContext?.next;
      prevContext = prevContext?.next;
    }
  } catch {
  }
  return false;
};
var traverseState = (fiber, selector) => {
  try {
    let nextState = fiber.memoizedState;
    let prevState = fiber.alternate?.memoizedState;
    while (nextState || prevState) {
      if (selector(nextState, prevState) === true) return true;
      nextState = nextState?.next;
      prevState = prevState?.next;
    }
  } catch {
  }
  return false;
};
var traverseProps = (fiber, selector) => {
  try {
    const nextProps = fiber.memoizedProps;
    const prevProps = fiber.alternate?.memoizedProps || {};
    const allKeys = /* @__PURE__ */ new Set([
      ...Object.keys(prevProps),
      ...Object.keys(nextProps)
    ]);
    for (const propName of allKeys) {
      const prevValue = prevProps?.[propName];
      const nextValue = nextProps?.[propName];
      if (selector(propName, nextValue, prevValue) === true) return true;
    }
  } catch {
  }
  return false;
};
var didFiberRender = (fiber) => {
  const nextProps = fiber.memoizedProps;
  const prevProps = fiber.alternate?.memoizedProps || {};
  const flags = fiber.flags ?? fiber.effectTag ?? 0;
  switch (fiber.tag) {
    case ClassComponentTag:
    case FunctionComponentTag:
    case ContextConsumerTag:
    case ForwardRefTag:
    case MemoComponentTag:
    case SimpleMemoComponentTag: {
      return (flags & PerformedWork) === PerformedWork;
    }
    default:
      if (!fiber.alternate) return true;
      return prevProps !== nextProps || fiber.alternate.memoizedState !== fiber.memoizedState || fiber.alternate.ref !== fiber.ref;
  }
};
var didFiberCommit = (fiber) => {
  return Boolean(
    (fiber.flags & (MutationMask | Cloned)) !== 0 || (fiber.subtreeFlags & (MutationMask | Cloned)) !== 0
  );
};
var getMutatedHostFibers = (fiber) => {
  const mutations = [];
  const stack = [fiber];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (isHostFiber(node) && didFiberCommit(node) && didFiberRender(node)) {
      mutations.push(node);
    }
    if (node.child) stack.push(node.child);
    if (node.sibling) stack.push(node.sibling);
  }
  return mutations;
};
var getFiberStack = (fiber) => {
  const stack = [];
  let currentFiber = fiber;
  while (currentFiber.return) {
    stack.push(currentFiber);
    currentFiber = currentFiber.return;
  }
  return stack;
};
var shouldFilterFiber = (fiber) => {
  switch (fiber.tag) {
    case DehydratedSuspenseComponentTag:
      return true;
    case HostTextTag:
    case FragmentTag:
    case LegacyHiddenComponentTag:
    case OffscreenComponentTag:
      return true;
    case HostRootTag:
      return false;
    default: {
      const symbolOrNumber = typeof fiber.type === "object" && fiber.type !== null ? fiber.type.$$typeof : fiber.type;
      const typeSymbol = typeof symbolOrNumber === "symbol" ? symbolOrNumber.toString() : symbolOrNumber;
      switch (typeSymbol) {
        case CONCURRENT_MODE_NUMBER:
        case CONCURRENT_MODE_SYMBOL_STRING:
        case DEPRECATED_ASYNC_MODE_SYMBOL_STRING:
          return true;
        default:
          return false;
      }
    }
  }
};
var getNearestHostFiber = (fiber, ascending = false) => {
  let hostFiber = traverseFiber(fiber, isHostFiber, ascending);
  if (!hostFiber) {
    hostFiber = traverseFiber(fiber, isHostFiber, !ascending);
  }
  return hostFiber;
};
var getNearestHostFibers = (fiber) => {
  const hostFibers = [];
  const stack = [];
  if (isHostFiber(fiber)) {
    hostFibers.push(fiber);
  } else if (fiber.child) {
    stack.push(fiber.child);
  }
  while (stack.length) {
    const currentNode = stack.pop();
    if (!currentNode) break;
    if (isHostFiber(currentNode)) {
      hostFibers.push(currentNode);
    } else if (currentNode.child) {
      stack.push(currentNode.child);
    }
    if (currentNode.sibling) {
      stack.push(currentNode.sibling);
    }
  }
  return hostFibers;
};
var traverseFiber = (fiber, selector, ascending = false) => {
  if (!fiber) return null;
  if (selector(fiber) === true) return fiber;
  let child = ascending ? fiber.return : fiber.child;
  while (child) {
    const match = traverseFiber(child, selector, ascending);
    if (match) return match;
    child = ascending ? null : child.sibling;
  }
  return null;
};
var getTimings = (fiber) => {
  const totalTime = fiber?.actualDuration ?? 0;
  let selfTime = totalTime;
  let child = fiber?.child ?? null;
  while (totalTime > 0 && child != null) {
    selfTime -= child.actualDuration ?? 0;
    child = child.sibling;
  }
  return { selfTime, totalTime };
};
var hasMemoCache = (fiber) => {
  return Boolean(
    fiber.updateQueue?.memoCache
  );
};
var getType = (type) => {
  const currentType = type;
  if (typeof currentType === "function") {
    return currentType;
  }
  if (typeof currentType === "object" && currentType) {
    return getType(
      currentType.type || currentType.render
    );
  }
  return null;
};
var getDisplayName = (type) => {
  const currentType = type;
  if (typeof currentType !== "function" && !(typeof currentType === "object" && currentType)) {
    return null;
  }
  const name = currentType.displayName || currentType.name || null;
  if (name) return name;
  const unwrappedType = getType(currentType);
  if (!unwrappedType) return null;
  return unwrappedType.displayName || unwrappedType.name || null;
};
var detectReactBuildType = (renderer) => {
  try {
    if (typeof renderer.version === "string" && renderer.bundleType > 0) {
      return "development";
    }
  } catch {
  }
  return "production";
};
var isInstrumentationActive = () => {
  const rdtHook = getRDTHook();
  return Boolean(rdtHook._instrumentationIsActive) || isRealReactDevtools() || isReactRefresh();
};
var fiberId = 0;
var fiberIdMap = /* @__PURE__ */ new WeakMap();
var setFiberId = (fiber, id = fiberId++) => {
  fiberIdMap.set(fiber, id);
};
var getFiberId = (fiber) => {
  let id = fiberIdMap.get(fiber);
  if (!id && fiber.alternate) {
    id = fiberIdMap.get(fiber.alternate);
  }
  if (!id) {
    id = fiberId++;
    setFiberId(fiber, id);
  }
  return id;
};
var mountFiberRecursively = (onRender, firstChild, traverseSiblings) => {
  let fiber = firstChild;
  while (fiber != null) {
    if (!fiberIdMap.has(fiber)) {
      getFiberId(fiber);
    }
    const shouldIncludeInTree = !shouldFilterFiber(fiber);
    if (shouldIncludeInTree && didFiberRender(fiber)) {
      onRender(fiber, "mount");
    }
    if (fiber.tag === SuspenseComponentTag) {
      const isTimedOut = fiber.memoizedState !== null;
      if (isTimedOut) {
        const primaryChildFragment = fiber.child;
        const fallbackChildFragment = primaryChildFragment ? primaryChildFragment.sibling : null;
        if (fallbackChildFragment) {
          const fallbackChild = fallbackChildFragment.child;
          if (fallbackChild !== null) {
            mountFiberRecursively(onRender, fallbackChild, false);
          }
        }
      } else {
        let primaryChild = null;
        if (fiber.child !== null) {
          primaryChild = fiber.child.child;
        }
        if (primaryChild !== null) {
          mountFiberRecursively(onRender, primaryChild, false);
        }
      }
    } else if (fiber.child != null) {
      mountFiberRecursively(onRender, fiber.child, true);
    }
    fiber = traverseSiblings ? fiber.sibling : null;
  }
};
var updateFiberRecursively = (onRender, nextFiber, prevFiber, parentFiber) => {
  if (!fiberIdMap.has(nextFiber)) {
    getFiberId(nextFiber);
  }
  if (!prevFiber) return;
  if (!fiberIdMap.has(prevFiber)) {
    getFiberId(prevFiber);
  }
  const isSuspense = nextFiber.tag === SuspenseComponentTag;
  const shouldIncludeInTree = !shouldFilterFiber(nextFiber);
  if (shouldIncludeInTree && didFiberRender(nextFiber)) {
    onRender(nextFiber, "update");
  }
  const prevDidTimeout = isSuspense && prevFiber.memoizedState !== null;
  const nextDidTimeOut = isSuspense && nextFiber.memoizedState !== null;
  if (prevDidTimeout && nextDidTimeOut) {
    const nextFallbackChildSet = nextFiber.child?.sibling ?? null;
    const prevFallbackChildSet = prevFiber.child?.sibling ?? null;
    if (nextFallbackChildSet !== null && prevFallbackChildSet !== null) {
      updateFiberRecursively(
        onRender,
        nextFallbackChildSet,
        prevFallbackChildSet);
    }
  } else if (prevDidTimeout && !nextDidTimeOut) {
    const nextPrimaryChildSet = nextFiber.child;
    if (nextPrimaryChildSet !== null) {
      mountFiberRecursively(onRender, nextPrimaryChildSet, true);
    }
  } else if (!prevDidTimeout && nextDidTimeOut) {
    unmountFiberChildrenRecursively(onRender, prevFiber);
    const nextFallbackChildSet = nextFiber.child?.sibling ?? null;
    if (nextFallbackChildSet !== null) {
      mountFiberRecursively(onRender, nextFallbackChildSet, true);
    }
  } else if (nextFiber.child !== prevFiber.child) {
    let nextChild = nextFiber.child;
    while (nextChild) {
      if (nextChild.alternate) {
        const prevChild = nextChild.alternate;
        updateFiberRecursively(
          onRender,
          nextChild,
          prevChild);
      } else {
        mountFiberRecursively(onRender, nextChild, false);
      }
      nextChild = nextChild.sibling;
    }
  }
};
var unmountFiber = (onRender, fiber) => {
  const isRoot = fiber.tag === HostRootTag;
  if (isRoot || !shouldFilterFiber(fiber)) {
    onRender(fiber, "unmount");
  }
};
var unmountFiberChildrenRecursively = (onRender, fiber) => {
  const isTimedOutSuspense = fiber.tag === SuspenseComponentTag && fiber.memoizedState !== null;
  let child = fiber.child;
  if (isTimedOutSuspense) {
    const primaryChildFragment = fiber.child;
    const fallbackChildFragment = primaryChildFragment?.sibling ?? null;
    child = fallbackChildFragment?.child ?? null;
  }
  while (child !== null) {
    if (child.return !== null) {
      unmountFiber(onRender, child);
      unmountFiberChildrenRecursively(onRender, child);
    }
    child = child.sibling;
  }
};
var commitId = 0;
var rootInstanceMap = /* @__PURE__ */ new WeakMap();
var traverseRenderedFibers = (root, onRender) => {
  const fiber = "current" in root ? root.current : root;
  let rootInstance = rootInstanceMap.get(root);
  if (!rootInstance) {
    rootInstance = { prevFiber: null, id: commitId++ };
    rootInstanceMap.set(root, rootInstance);
  }
  const { prevFiber } = rootInstance;
  if (!fiber) {
    unmountFiber(onRender, fiber);
  } else if (prevFiber !== null) {
    const wasMounted = prevFiber && prevFiber.memoizedState != null && prevFiber.memoizedState.element != null && // A dehydrated root is not considered mounted
    prevFiber.memoizedState.isDehydrated !== true;
    const isMounted = fiber.memoizedState != null && fiber.memoizedState.element != null && // A dehydrated root is not considered mounted
    fiber.memoizedState.isDehydrated !== true;
    if (!wasMounted && isMounted) {
      mountFiberRecursively(onRender, fiber, false);
    } else if (wasMounted && isMounted) {
      updateFiberRecursively(onRender, fiber, fiber.alternate);
    } else if (wasMounted && !isMounted) {
      unmountFiber(onRender, fiber);
    }
  } else {
    mountFiberRecursively(onRender, fiber, true);
  }
  rootInstance.prevFiber = fiber;
};
var createFiberVisitor = ({
  onRender
}) => {
  return (_rendererID, root, _state) => {
    traverseRenderedFibers(root, onRender);
  };
};
var instrument = (options) => {
  return getRDTHook(() => {
    const rdtHook = getRDTHook();
    options.onActive?.();
    rdtHook._instrumentationSource = options.name ?? BIPPY_INSTRUMENTATION_STRING;
    const prevOnCommitFiberRoot = rdtHook.onCommitFiberRoot;
    if (options.onCommitFiberRoot) {
      rdtHook.onCommitFiberRoot = (rendererID, root, priority) => {
        if (prevOnCommitFiberRoot)
          prevOnCommitFiberRoot(rendererID, root, priority);
        options.onCommitFiberRoot?.(rendererID, root, priority);
      };
    }
    const prevOnCommitFiberUnmount = rdtHook.onCommitFiberUnmount;
    if (options.onCommitFiberUnmount) {
      rdtHook.onCommitFiberUnmount = (rendererID, root) => {
        if (prevOnCommitFiberUnmount)
          prevOnCommitFiberUnmount(rendererID, root);
        options.onCommitFiberUnmount?.(rendererID, root);
      };
    }
    const prevOnPostCommitFiberRoot = rdtHook.onPostCommitFiberRoot;
    if (options.onPostCommitFiberRoot) {
      rdtHook.onPostCommitFiberRoot = (rendererID, root) => {
        if (prevOnPostCommitFiberRoot)
          prevOnPostCommitFiberRoot(rendererID, root);
        options.onPostCommitFiberRoot?.(rendererID, root);
      };
    }
  });
};
var getFiberFromHostInstance = (hostInstance) => {
  const rdtHook = getRDTHook();
  for (const renderer of rdtHook.renderers.values()) {
    try {
      const fiber = renderer.findFiberByHostInstance?.(hostInstance);
      if (fiber) return fiber;
    } catch {
    }
  }
  if (typeof hostInstance === "object" && hostInstance != null) {
    if ("_reactRootContainer" in hostInstance) {
      return hostInstance._reactRootContainer?._internalRoot?.current?.child;
    }
    for (const key in hostInstance) {
      if (key.startsWith("__reactInternalInstance$") || key.startsWith("__reactFiber")) {
        return hostInstance[key] || null;
      }
    }
  }
  return null;
};
var INSTALL_ERROR = new Error();
var secure = (options, secureOptions = {}) => {
  const onActive = options.onActive;
  const isRDTHookInstalled = hasRDTHook();
  const isUsingRealReactDevtools = isRealReactDevtools();
  const isUsingReactRefresh = isReactRefresh();
  let timeout;
  let isProduction = secureOptions.isProduction ?? false;
  options.onActive = () => {
    clearTimeout(timeout);
    let isSecure = true;
    try {
      const rdtHook = getRDTHook();
      for (const renderer of rdtHook.renderers.values()) {
        const [majorVersion] = renderer.version.split(".");
        if (Number(majorVersion) < (secureOptions.minReactMajorVersion ?? 17)) {
          isSecure = false;
        }
        const buildType = detectReactBuildType(renderer);
        if (buildType !== "development") {
          isProduction = true;
          if (!secureOptions.dangerouslyRunInProduction) {
            isSecure = false;
          }
        }
      }
    } catch (err) {
      secureOptions.onError?.(err);
    }
    if (!isSecure) {
      options.onCommitFiberRoot = void 0;
      options.onCommitFiberUnmount = void 0;
      options.onPostCommitFiberRoot = void 0;
      options.onActive = void 0;
      return;
    }
    onActive?.();
    try {
      const onCommitFiberRoot2 = options.onCommitFiberRoot;
      if (onCommitFiberRoot2) {
        options.onCommitFiberRoot = (rendererID, root, priority) => {
          try {
            onCommitFiberRoot2(rendererID, root, priority);
          } catch (err) {
            secureOptions.onError?.(err);
          }
        };
      }
      const onCommitFiberUnmount = options.onCommitFiberUnmount;
      if (onCommitFiberUnmount) {
        options.onCommitFiberUnmount = (rendererID, root) => {
          try {
            onCommitFiberUnmount(rendererID, root);
          } catch (err) {
            secureOptions.onError?.(err);
          }
        };
      }
      const onPostCommitFiberRoot = options.onPostCommitFiberRoot;
      if (onPostCommitFiberRoot) {
        options.onPostCommitFiberRoot = (rendererID, root) => {
          try {
            onPostCommitFiberRoot(rendererID, root);
          } catch (err) {
            secureOptions.onError?.(err);
          }
        };
      }
    } catch (err) {
      secureOptions.onError?.(err);
    }
  };
  if (!isRDTHookInstalled && !isUsingRealReactDevtools && !isUsingReactRefresh) {
    timeout = setTimeout(() => {
      if (!isProduction) {
        secureOptions.onError?.(INSTALL_ERROR);
      }
      stop();
    }, secureOptions.installCheckTimeout ?? 100);
  }
  return options;
};
var onCommitFiberRoot = (handler) => {
  return instrument(
    secure({
      onCommitFiberRoot: (_, root) => {
        handler(root);
      }
    })
  );
};

export { BIPPY_INSTRUMENTATION_STRING, CONCURRENT_MODE_NUMBER, CONCURRENT_MODE_SYMBOL_STRING, ClassComponentTag, ContextConsumerTag, DEPRECATED_ASYNC_MODE_SYMBOL_STRING, DehydratedSuspenseComponentTag, ELEMENT_TYPE_SYMBOL_STRING, ForwardRefTag, FragmentTag, FunctionComponentTag, HostComponentTag, HostHoistableTag, HostRootTag, HostSingletonTag, HostTextTag, INSTALL_ERROR, INSTALL_HOOK_SCRIPT_STRING, LegacyHiddenComponentTag, MemoComponentTag, OffscreenComponentTag, SimpleMemoComponentTag, SuspenseComponentTag, TRANSITIONAL_ELEMENT_TYPE_SYMBOL_STRING, createFiberVisitor, detectReactBuildType, didFiberCommit, didFiberRender, fiberIdMap, getDisplayName, getFiberFromHostInstance, getFiberId, getFiberStack, getMutatedHostFibers, getNearestHostFiber, getNearestHostFibers, getRDTHook, getTimings, getType, hasMemoCache, hasRDTHook, installRDTHook, instrument, isClientEnvironment, isCompositeFiber, isHostFiber, isInstrumentationActive, isReactRefresh, isRealReactDevtools, isValidElement, isValidFiber, mountFiberRecursively, onCommitFiberRoot, patchRDTHook, secure, setFiberId, shouldFilterFiber, traverseContexts, traverseFiber, traverseProps, traverseRenderedFibers, traverseState, unmountFiber, unmountFiberChildrenRecursively, updateFiberRecursively, version };
