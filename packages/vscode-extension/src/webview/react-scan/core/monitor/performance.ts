import { type Fiber } from 'react-reconciler';
import { getDisplayName } from 'bippy';
import { Store } from '../..';
import { getCompositeComponentFromElement } from '../web/inspect-element/utils';
import type {
  PerformanceInteraction,
  PerformanceInteractionEntry,
} from './types';

interface PathFilters {
  skipProviders: boolean;
  skipHocs: boolean;
  skipContainers: boolean;
  skipMinified: boolean;
  skipUtilities: boolean;
  skipBoundaries: boolean;
}

const DEFAULT_FILTERS: PathFilters = {
  skipProviders: true,
  skipHocs: true,
  skipContainers: true,
  skipMinified: true,
  skipUtilities: true,
  skipBoundaries: true,
};

const FILTER_PATTERNS = {
  providers: [/Provider$/, /^Provider$/, /^Context$/],

  hocs: [/^with[A-Z]/, /^forward(Ref)?$/i, /^Forward(Ref)?\(/],

  containers: [/^(App)?Container$/, /^Root$/, /^ReactDev/],

  utilities: [
    /^Fragment$/,
    /^Suspense$/,
    /^ErrorBoundary$/,
    /^Portal$/,
    /^Consumer$/,
    /^Layout$/,
    /^Router/,
    /^Hydration/,
  ],

  boundaries: [/^Boundary$/, /Boundary$/, /^Provider$/, /Provider$/],
};

function shouldIncludeInPath(
  name: string,
  filters: PathFilters = DEFAULT_FILTERS,
): boolean {
  const patternsToCheck: RegExp[] = [];

  if (filters.skipProviders) patternsToCheck.push(...FILTER_PATTERNS.providers);
  if (filters.skipHocs) patternsToCheck.push(...FILTER_PATTERNS.hocs);
  if (filters.skipContainers)
    patternsToCheck.push(...FILTER_PATTERNS.containers);
  if (filters.skipUtilities) patternsToCheck.push(...FILTER_PATTERNS.utilities);
  if (filters.skipBoundaries)
    patternsToCheck.push(...FILTER_PATTERNS.boundaries);

  return !patternsToCheck.some((pattern) => pattern.test(name));
}
const isMinified = (name: string): boolean => {
  if (!name || typeof name !== 'string') {
    return true;
  }

  const minifiedPatterns = [
    /^[a-z]$/, // Single lowercase letter
    /^[a-z][0-9]$/, // Lowercase letter followed by number
    /^_+$/, // Just underscores
    /^[A-Za-z][_$]$/, // Letter followed by underscore or dollar
    /^[a-z]{1,2}$/, // 1-2 lowercase letters
  ];

  if (minifiedPatterns.some((pattern) => pattern.test(name))) {
    return true;
  }

  const hasNoVowels = !/[aeiou]/i.test(name);
  const hasMostlyNumbers = (name.match(/\d/g)?.length ?? 0) > name.length / 2;
  const isSingleWordLowerCase = /^[a-z]+$/.test(name);
  const hasRandomLookingChars = /[\$_]{2,}/.test(name);

  const suspiciousTraits = [
    hasNoVowels,
    hasMostlyNumbers,
    isSingleWordLowerCase,
    hasRandomLookingChars,
  ].filter(Boolean).length;

  return suspiciousTraits >= 2;
};
export function getInteractionPath(
  fiber: Fiber | null,
  filters: PathFilters = DEFAULT_FILTERS,
): string {
  if (!fiber) return '';

  const fullPath: string[] = [];

  const currentName = getDisplayName(fiber.type);
  if (currentName) {
    fullPath.unshift(currentName);
  }

  let current = fiber.return;
  while (current) {
    if (current.type && typeof current.type === 'function') {
      const name = getCleanComponentName(current.type);
      if (name && !isMinified(name) && shouldIncludeInPath(name, filters)) {
        fullPath.unshift(name);
      }
    }
    current = current.return;
  }

  const normalized = normalizePath(fullPath);
  return normalized;
}

let currentMouseOver: Element;

function getCleanComponentName(component: any): string {
  const name = getDisplayName(component);
  if (!name) return '';

  return name.replace(/^(Memo|Forward(Ref)?|With.*?)\((.*?)\)$/, '$3');
}

function normalizePath(path: string[]): string {
  const cleaned = path.filter(Boolean);

  const deduped = cleaned.filter((name, i) => name !== cleaned[i - 1]);

  return deduped.join('.');
}
const handleMouseover = (event: Event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  currentMouseOver = event.target;
};

const getFirstNamedAncestorCompositeFiber = (element: Element) => {
  let curr: Element | null = element;
  let parentCompositeFiber: Fiber | null = null;
  while (!parentCompositeFiber && curr.parentElement) {
    curr = curr.parentElement;

    const { parentCompositeFiber: fiber } =
      getCompositeComponentFromElement(curr);

    if (!fiber) {
      continue;
    }
    if (getDisplayName(fiber?.type)) {
      parentCompositeFiber = fiber;
    }
  }
  return parentCompositeFiber;
};
// todo: update monitoring api to expose filters for component names
export function initPerformanceMonitoring(options?: Partial<PathFilters>) {
  const filters = { ...DEFAULT_FILTERS, ...options };
  const monitor = Store.monitor.value;
  if (!monitor) return;

  document.addEventListener('mouseover', handleMouseover);
  const disconnectPerformanceListener = setupPerformanceListener((entry) => {
    let target =
      entry.target ?? (entry.type === 'pointer' ? currentMouseOver : null);
    if (!target) {
      // most likely an invariant that we should log if its violated
      return;
    }
    let parentCompositeFiber = getFirstNamedAncestorCompositeFiber(target);
    if (!parentCompositeFiber) {
      return;
    }
    const displayName = getDisplayName(parentCompositeFiber.type);
    if (!displayName || isMinified(displayName)) {
      // invariant, we know its named based on getFirstNamedAncestorCompositeFiber implementation
      return;
    }

    const path = getInteractionPath(parentCompositeFiber, filters);

    monitor.interactions.push({
      componentName: displayName,
      componentPath: path,
      performanceEntry: entry,
      components: new Map(),
      route: Store.monitor.value?.route ?? null,
      url: window.location.toString(),
      uniqueInteractionId: entry.id,
    });
  });

  return () => {
    disconnectPerformanceListener();
    document.removeEventListener('mouseover', handleMouseover);
  };
}

const setupPerformanceListener = (
  onEntry: (interaction: PerformanceInteraction) => void,
) => {
  const longestInteractionList: PerformanceInteraction[] = [];
  const longestInteractionMap = new Map<string, PerformanceInteraction>();
  const interactionTargetMap = new Map<string, Element>();

  const processInteractionEntry = (entry: PerformanceInteractionEntry) => {
    if (!(entry.interactionId || entry.entryType === 'first-input')) return;

    if (
      entry.interactionId &&
      entry.target &&
      !interactionTargetMap.has(entry.interactionId)
    ) {
      interactionTargetMap.set(entry.interactionId, entry.target);
    }

    const existingInteraction = longestInteractionMap.get(entry.interactionId);

    if (existingInteraction) {
      if (entry.duration > existingInteraction.latency) {
        existingInteraction.entries = [entry];
        existingInteraction.latency = entry.duration;
      } else if (
        entry.duration === existingInteraction.latency &&
        entry.startTime === existingInteraction.entries[0].startTime
      ) {
        existingInteraction.entries.push(entry);
      }
    } else {
      const interactionType = getInteractionType(entry.name);
      if (!interactionType) {
        return;
      }
      const interaction: PerformanceInteraction = {
        id: entry.interactionId,
        latency: entry.duration,
        entries: [entry],
        target: entry.target,
        type: interactionType,
        startTime: entry.startTime,
        processingStart: entry.processingStart,
        processingEnd: entry.processingEnd,
        duration: entry.duration,
        inputDelay: entry.processingStart - entry.startTime,
        processingDuration: entry.processingEnd - entry.processingStart,
        presentationDelay:
          entry.duration - (entry.processingEnd - entry.startTime),
        timestamp: Date.now(),
      };
      longestInteractionMap.set(interaction.id, interaction);
      longestInteractionList.push(interaction);

      onEntry(interaction);
    }

    longestInteractionList.sort((a, b) => b.latency - a.latency);
  };

  const getInteractionType = (
    eventName: string,
  ): 'pointer' | 'keyboard' | null => {
    if (['pointerdown', 'pointerup', 'click'].includes(eventName)) {
      return 'pointer';
    }
    if (['keydown', 'keyup'].includes(eventName)) {
      return 'keyboard';
    }
    return null;
  };

  const po = new PerformanceObserver((list) => {
    list
      .getEntries()
      .forEach((entry) =>
        processInteractionEntry(entry as PerformanceInteractionEntry),
      );
  });

  try {
    po.observe({
      type: 'event',
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit);
    po.observe({
      type: 'first-input',
      buffered: true,
    });
  } catch {
    /* Should collect error logs*/
  }

  return () => {
    po.disconnect();
  };
};
