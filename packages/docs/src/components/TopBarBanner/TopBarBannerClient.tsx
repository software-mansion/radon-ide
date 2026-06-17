"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  MIN_VISIBLE_HEIGHT,
  cacheKey,
  varNames,
  type BannerZone,
} from "./shared";

export type { BannerZone };

const DEFAULT_ROTATE_INTERVAL_MS = 4000;
const SLIDE_MS = 700;

const rotateLeft = <T,>(arr: T[], k: number): T[] =>
  arr.slice(k).concat(arr.slice(0, k));
const rotateRight = <T,>(arr: T[], k: number): T[] =>
  arr.slice(arr.length - k).concat(arr.slice(0, arr.length - k));

const SCRIPT_SRC = "https://swm-delivery.com/www/assets/js/lib.js";

const FALLBACK_BG_COLOR = "#2a47ff";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// Wait for the live banner before treating a slot as empty; shorter once
// Revive signals done (data-content-loaded).
const BANNER_SETTLE_MS = 4000;
const BANNER_CONFIRM_MS = 500;

type TopBarBannerCache = { height: number; bgColor: string; timestamp: number };

const writeCache = (key: string, height: number, bgColor: string) => {
  if (typeof window === "undefined") return;
  try {
    const entry: TopBarBannerCache = { height, bgColor, timestamp: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
};

const clearCache = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
};

// null height clears the reservation (bar collapses via the var fallback).
const setReservation = (
  vars: { height: string; bg: string },
  height: number | null,
  bgColor?: string
) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (height === null) {
    root.style.removeProperty(vars.height);
  } else {
    root.style.setProperty(vars.height, `${height}px`);
  }
  if (bgColor) root.style.setProperty(vars.bg, bgColor);
};

const isTransparent = (color: string) =>
  !color ||
  color === "transparent" ||
  /^rgba?\([^)]*,\s*0\s*\)$/.test(color.replace(/\s+/g, " "));

const findOpaqueBg = (nodes: HTMLElement[]): string | null => {
  for (const node of nodes) {
    const bg = getComputedStyle(node).backgroundColor;
    if (!isTransparent(bg)) return bg;
  }
  return null;
};

// First opaque bg-color in the banner DOM, descending into same-origin
// iframes (Revive serves inside one; cross-origin access throws → skip).
const extractBgColor = (root: HTMLElement): string | null => {
  const direct = findOpaqueBg([
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>("*")),
  ]);
  if (direct) return direct;

  for (const frame of Array.from(root.querySelectorAll("iframe"))) {
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) continue;
      const fromFrame = findOpaqueBg([
        doc.body,
        ...Array.from(doc.body.querySelectorAll<HTMLElement>("*")),
      ]);
      if (fromFrame) return fromFrame;
    } catch {}
  }
  return null;
};

/** Per-zone measured state lifted to the rotating parent. */
type ZoneState = { height: number; hasBanner: boolean };

interface BannerZoneSlotProps {
  zone: BannerZone;
  index: number;
  /** Must be stable — the reconcile effect depends on it. */
  onChange: (index: number, state: ZoneState) => void;
}

// One Revive slot: own detection observer, cache, and per-instance CSS-var
// reservation. Reports {@link ZoneState} up to drive the bar height/slide.
const BannerZoneSlot = ({ zone, index, onChange }: BannerZoneSlotProps) => {
  const fallbackBgColor = zone.fallbackBgColor ?? FALLBACK_BG_COLOR;
  const contentRef = useRef<HTMLDivElement>(null);
  const insRef = useRef<HTMLModElement | null>(null);

  const keyRef = useRef(cacheKey(zone.zoneId, zone.contentId));
  const varsRef = useRef(varNames(zone.zoneId, zone.contentId));

  const [hasBanner, setHasBanner] = useState(false);
  const [reviveDone, setReviveDone] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const getIns = () => {
      const current = content.querySelector("ins");
      if (current && current !== insRef.current) {
        insRef.current = current as HTMLModElement;
      }
      return insRef.current;
    };

    const detectBanner = () => {
      const height = Math.max(content.scrollHeight, content.offsetHeight);
      return height >= MIN_VISIBLE_HEIGHT;
    };

    const updateState = () => {
      setHasBanner(detectBanner());
      if (getIns()?.getAttribute("data-content-loaded") === "1") {
        setReviveDone(true);
      }
    };

    const containerObserver = new MutationObserver(updateState);
    containerObserver.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    const ins = getIns();
    let insObserver: MutationObserver | null = null;
    if (ins) {
      insObserver = new MutationObserver(updateState);
      insObserver.observe(ins, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-content-loaded", "style", "class", "id"],
      });
    }

    updateState();

    return () => {
      containerObserver.disconnect();
      if (insObserver) insObserver.disconnect();
    };
  }, []);

  // Reconcile the live banner against the reserved size, then persist.
  useEffect(() => {
    if (hasBanner) {
      const content = contentRef.current;
      if (!content) return;

      const raf = requestAnimationFrame(() => {
        // Stretch <ins>/iframe to full width so their `width:100%` has a
        // definite containing block (else collapses to the 300px default).
        const ins = content.querySelector("ins");
        if (ins) {
          ins.style.display = "block";
          ins.style.width = "100%";
        }
        const iframe = content.querySelector("iframe");
        if (iframe) {
          iframe.style.display = "block";
          iframe.style.width = "100%";
          iframe.style.maxWidth = "100%";
        }
        const height = Math.max(content.scrollHeight, content.offsetHeight);
        const bg = extractBgColor(content) ?? fallbackBgColor;
        setReservation(varsRef.current, height, bg);
        writeCache(keyRef.current, height, bg);
        onChange(index, { height, hasBanner: true });
      });
      return () => cancelAnimationFrame(raf);
    }

    const delay = reviveDone ? BANNER_CONFIRM_MS : BANNER_SETTLE_MS;
    const settle = window.setTimeout(() => {
      const content = contentRef.current;
      if (!content) return;
      const height = Math.max(content.scrollHeight, content.offsetHeight);
      if (height < MIN_VISIBLE_HEIGHT) {
        clearCache(keyRef.current);
        setReservation(varsRef.current, null);
        onChange(index, { height: 0, hasBanner: false });
      }
    }, delay);
    return () => window.clearTimeout(settle);
  }, [hasBanner, reviveDone, fallbackBgColor, onChange, index]);

  return (
    <div
      ref={contentRef}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        opacity: hasBanner ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
      suppressHydrationWarning
    >
      <ins
        data-content-zoneid={zone.zoneId}
        data-content-id={zone.contentId}
        style={{ display: "block" }}
        suppressHydrationWarning
      />
    </div>
  );
};

export interface TopBarBannerProps {
  /** Zones to rotate through. Falls back to the zoneId/contentId shorthand. */
  zones?: BannerZone[];
  /** Single-zone shorthand (back-compat). Ignored when `zones` is set. */
  zoneId?: string;
  contentId?: string;
  fallbackBgColor?: string;
  /** Active zone's measured height (px), or 0 when empty. */
  setBannerHeight?: (height: number) => void;
  /** Hold time per banner before the next slide. Floored at SLIDE_MS. */
  rotateIntervalMs?: number;
  /** `"up"` (default) pulls the next in from below; `"down"` from above. */
  direction?: "up" | "down";
}

type SliderView = {
  order: number[];
  offset: number;
  animate: boolean;
  active: number;
};

/**
 * Revive Adserver banner in a collapsible top bar, rotating through one or more
 * {@link BannerZone}s. Height/bg are driven by per-instance CSS vars (not React
 * state) so the headScript.js reservation script can reserve the first zone's
 * cached size in `<head>` before hydration → no content shift. Rotation is a
 * vertical slide driven by CSS flex `order` (DOM order stays fixed so Revive
 * iframes are never moved/reloaded); empty zones are skipped.
 */
export const TopBarBanner = ({
  zones,
  zoneId,
  contentId,
  fallbackBgColor = FALLBACK_BG_COLOR,
  setBannerHeight,
  rotateIntervalMs = DEFAULT_ROTATE_INTERVAL_MS,
  direction = "up",
}: TopBarBannerProps) => {
  const normalizedZones: BannerZone[] =
    zones && zones.length > 0
      ? zones
      : zoneId && contentId
      ? [{ zoneId, contentId, fallbackBgColor }]
      : [];

  const [zoneStates, setZoneStates] = useState<ZoneState[]>(() =>
    normalizedZones.map(() => ({ height: 0, hasBanner: false }))
  );
  const [view, setView] = useState<SliderView>(() => ({
    order: normalizedZones.map((_, i) => i),
    offset: 0,
    animate: false,
    active: 0,
  }));
  // Off until after first paint so a pre-reserved bar doesn't animate on load.
  const [animateIn, setAnimateIn] = useState(false);
  // Gates `bannerLoaded` so it isn't stamped "false" before any zone settles.
  const [anyReported, setAnyReported] = useState(false);

  // Latest values the rotation timer reads without re-arming on every update.
  const zoneStatesRef = useRef(zoneStates);
  zoneStatesRef.current = zoneStates;
  const viewRef = useRef(view);
  viewRef.current = view;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  // True while a slide is mid-flight, so ticks can't overlap.
  const busyRef = useRef(false);

  const handleZoneChange = useCallback((i: number, state: ZoneState) => {
    setAnyReported(true);
    setZoneStates((prev) => {
      const cur = prev[i];
      // Bail when unchanged so a filled slot doesn't spin the reconcile loop.
      if (
        cur &&
        cur.height === state.height &&
        cur.hasBanner === state.hasBanner
      ) {
        return prev;
      }
      const next = prev.slice();
      next[i] = state;
      return next;
    });
  }, []);

  // Inject the Revive loader once; it drives every zone's <ins>.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = SCRIPT_SRC;
    document.body.appendChild(script);
  }, []);

  // Arm transition only after the first frame is painted (double rAF), so the
  // reserved bar appears instantly but later size changes still animate.
  useIsoLayoutEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnimateIn(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  // One rotation step: slide one direction, then re-home the slot order so the
  // loop is seamless. Empty zones skipped.
  useEffect(() => {
    if (normalizedZones.length <= 1) return;

    let pendingTimer = 0;
    let pendingRaf = 0;

    const step = () => {
      if (busyRef.current) return;
      const v = viewRef.current;
      const n = v.order.length;
      const states = zoneStatesRef.current;
      const heights = v.order.map((zi) => states[zi]?.height ?? 0);

      if (directionRef.current === "down") {
        // Pull the previous banner zone in from above.
        let j = 0;
        for (let s = 1; s < n; s++) {
          if (states[v.order[(n - s) % n]]?.hasBanner) {
            j = s;
            break;
          }
        }
        if (j === 0) return;
        const newOrder = rotateRight(v.order, j);
        const moving = heights.slice(n - j).reduce((sum, h) => sum + h, 0);
        const active = newOrder[0];
        busyRef.current = true;
        // Place the incoming slot just above the viewport, then slide it down.
        setView({ order: newOrder, offset: -moving, animate: false, active });
        pendingRaf = requestAnimationFrame(() => {
          pendingRaf = requestAnimationFrame(() => {
            setView({ order: newOrder, offset: 0, animate: true, active });
            pendingTimer = window.setTimeout(() => {
              busyRef.current = false;
            }, SLIDE_MS);
          });
        });
        return;
      }

      // up: push the active slot out the top, pull the next in from below.
      let k = 0;
      for (let s = 1; s < n; s++) {
        if (states[v.order[s]]?.hasBanner) {
          k = s;
          break;
        }
      }
      if (k === 0) return;
      const moving = heights.slice(0, k).reduce((sum, h) => sum + h, 0);
      const active = v.order[k];
      busyRef.current = true;
      setView({ order: v.order, offset: -moving, animate: true, active });
      pendingTimer = window.setTimeout(() => {
        // Re-home: rotate so the now-visible slot is first, reset the offset.
        setView({
          order: rotateLeft(v.order, k),
          offset: 0,
          animate: false,
          active,
        });
        busyRef.current = false;
      }, SLIDE_MS);
    };

    // Floor at SLIDE_MS — ticks during an in-flight slide are dropped anyway.
    const interval = Math.max(rotateIntervalMs, SLIDE_MS);
    const id = window.setInterval(step, interval);
    return () => {
      window.clearInterval(id);
      if (pendingTimer) window.clearTimeout(pendingTimer);
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      busyRef.current = false;
    };
  }, [normalizedZones.length, rotateIntervalMs]);

  // Report active zone height + global loaded flag, once a zone has settled.
  useEffect(() => {
    if (typeof document === "undefined" || !anyReported) return;
    const anyBanner = zoneStates.some((s) => s.hasBanner);
    document.documentElement.dataset.bannerLoaded = anyBanner
      ? "true"
      : "false";
    setBannerHeight?.(zoneStates[view.active]?.height ?? 0);
  }, [zoneStates, view.active, setBannerHeight, anyReported]);

  if (normalizedZones.length === 0) return null;

  const activeZone = normalizedZones[view.active] ?? normalizedZones[0];
  const activeVars = varNames(activeZone.zoneId, activeZone.contentId);
  const activeFallback = activeZone.fallbackBgColor ?? FALLBACK_BG_COLOR;

  // Visual stacking position per zone. DOM order stays fixed (so Revive's
  // iframes are never moved — moving an iframe reloads it); only the CSS flex
  // `order` reshuffles, which the slide + re-home rely on.
  const slotOrder: number[] = [];
  view.order.forEach((zi, pos) => {
    slotOrder[zi] = pos;
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        transition: animateIn
          ? "height 500ms ease-in-out, background-color 200ms ease-out"
          : "none",
        height: `var(${activeVars.height}, 0px)`,
        overflow: "hidden",
        willChange: "height",
        backgroundColor: `var(${activeVars.bg}, ${activeFallback})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          willChange: "transform",
          transform: `translateY(${view.offset}px)`,
          transition: view.animate
            ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
            : "none",
        }}
      >
        {normalizedZones.map((zone, zi) => (
          <div
            key={`${zone.zoneId}.${zone.contentId}`}
            style={{ order: slotOrder[zi], width: "100%", flexShrink: 0 }}
          >
            <BannerZoneSlot zone={zone} index={zi} onChange={handleZoneChange} />
          </div>
        ))}
      </div>
    </div>
  );
};
