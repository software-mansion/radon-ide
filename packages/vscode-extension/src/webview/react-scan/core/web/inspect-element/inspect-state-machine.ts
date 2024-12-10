import { didFiberRender } from 'bippy';
import { Store } from '../../index';
import { throttle } from '../utils';
import { restoreSizeFromLocalStorage } from '../toolbar';
import { renderPropsAndState } from './view-state';
import {
  currentLockIconRect,
  drawHoverOverlay,
  OVERLAY_DPR,
  updateCanvasSize,
} from './overlay';
import { getCompositeComponentFromElement, hasValidParent } from './utils';

export type States =
  | {
      kind: 'inspecting';
      hoveredDomElement: HTMLElement | null;
      propContainer: HTMLDivElement;
    }
  | {
      kind: 'inspect-off';
      propContainer: HTMLDivElement;
    }
  | {
      kind: 'focused';
      focusedDomElement: HTMLElement;
      propContainer: HTMLDivElement;
    }
  | {
      kind: 'uninitialized';
      propContainer?: HTMLDivElement;
    };

export const INSPECT_TOGGLE_ID = 'react-scan-inspect-element-toggle';
export const INSPECT_OVERLAY_CANVAS_ID = 'react-scan-inspect-canvas';
let lastHoveredElement: HTMLElement;
let animationId: ReturnType<typeof requestAnimationFrame>;

type Kinds = States['kind'];

export const createInspectElementStateMachine = () => {
  if (typeof window === 'undefined') {
    return;
  }
  let canvas = document.getElementById(
    INSPECT_OVERLAY_CANVAS_ID,
  ) as HTMLCanvasElement | null;

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = INSPECT_OVERLAY_CANVAS_ID;
    canvas.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 214748367;
  `;
    document.documentElement.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      return;
    }
    updateCanvasSize(canvas, ctx);
    window.addEventListener(
      'resize',
      () => {
        updateCanvasSize(canvas!, ctx);
      },
      { capture: true },
    ); // todo add cleanup/dispose logic for createInspectElementStateMachine
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    // 2d context not available, just bail
    return;
  }

  const clearCanvas = () => {
    cancelAnimationFrame(animationId);
    ctx.save();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.restore();
  };
  const unsubscribeFns: Partial<{ [_ in keyof States as Kinds]: () => void }> =
    {};

  const unsubscribeAll = () => {
    Object.entries(unsubscribeFns).forEach(([_, unSub]) => {
      unSub();
    });
  };

  const recursiveRaf = (cb: () => void) => {
    const helper = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      animationId = requestAnimationFrame(() => {
        cb();
        helper();
      });
    };
    helper();
  };
  const repaint = throttle(() => {
    unsubscribeAll(); // potential optimization: only unSub if inspectStateKind transitioned
    const unSub = (() => {
      const inspectState = Store.inspectState.value;
      switch (inspectState.kind) {
        case 'uninitialized': {
          return;
        }
        case 'inspect-off': {
          clearCanvas();
          // the canvas doesn't get cleared when the mouse move overlaps with the clear
          // i can't figure out why this happens, so this is an unfortunate hack
          const mouseMove = () => {
            clearCanvas();
            updateCanvasSize(canvas, ctx);
          };
          window.addEventListener('mousemove', mouseMove, { capture: true });

          return () => {
            window.removeEventListener('mousemove', mouseMove, {
              capture: true,
            });
          };
        }
        case 'inspecting': {
          recursiveRaf(() => {
            if (!inspectState.hoveredDomElement) {
              return;
            }
            drawHoverOverlay(
              inspectState.hoveredDomElement,
              canvas,
              ctx,
              'inspecting',
            );
          });
          // we want to allow the user to be able to inspect pointerdownable things
          const eventCatcher = document.createElement('div');
          eventCatcher.style.cssText = `
              position: fixed;
              left: 0;
              top: 0;
              width: 100vw;
              height: 100vh;
              z-index: ${parseInt(canvas.style.zIndex) - 1};
              pointer-events: auto;
            `;

          canvas.parentNode!.insertBefore(eventCatcher, canvas);
          let currentHoveredElement: HTMLElement | null = null;
          const mouseMove = throttle((e: MouseEvent) => {
            if (Store.inspectState.value.kind !== 'inspecting') {
              return;
            }

            // temp hide event catcher to get real target
            eventCatcher.style.pointerEvents = 'none';
            const el = document.elementFromPoint(
              e.clientX,
              e.clientY,
            ) as HTMLElement;
            eventCatcher.style.pointerEvents = 'auto';

            if (!el) return;
            lastHoveredElement = el;

            currentHoveredElement = el;
            inspectState.hoveredDomElement = el;
            drawHoverOverlay(el, canvas, ctx, 'inspecting');
          }, 16);

          window.addEventListener('mousemove', mouseMove, { capture: true });

          const pointerdown = (e: MouseEvent) => {
            e.stopPropagation();

            eventCatcher.style.pointerEvents = 'none';
            const el =
              currentHoveredElement ??
              document.elementFromPoint(e.clientX, e.clientY) ??
              lastHoveredElement;
            eventCatcher.style.pointerEvents = 'auto';

            if (!el) {
              return;
            }

            drawHoverOverlay(el as HTMLElement, canvas, ctx, 'locked');

            inspectState.propContainer.style.width = `${restoreSizeFromLocalStorage()}px`;
            Store.inspectState.value = {
              kind: 'focused',
              focusedDomElement: el as HTMLElement,
              propContainer: inspectState.propContainer,
            };
            if (!hasValidParent()) {
              const previousFocusBtn = document.getElementById(
                'react-scan-previous-focus',
              )!;
              const parentFocusBtn = document.getElementById(
                'react-scan-next-focus',
              )!;

              previousFocusBtn.style.display = 'none';
              parentFocusBtn.style.display = 'none';
            }
          };
          window.addEventListener('pointerdown', pointerdown, {
            capture: true,
          });

          const keyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              Store.inspectState.value = {
                kind: 'inspect-off',
                propContainer: inspectState.propContainer,
              };
              clearCanvas();
            }
          };
          window.addEventListener('keydown', keyDown, { capture: true });
          let cleanup = () => {
            /**/
          };
          if (inspectState.hoveredDomElement) {
            cleanup = trackElementPosition(
              inspectState.hoveredDomElement,
              () => {
                drawHoverOverlay(
                  inspectState.hoveredDomElement!,
                  canvas,
                  ctx,
                  'inspecting',
                );
              },
            );
          }

          return () => {
            window.removeEventListener('pointerdown', pointerdown, {
              capture: true,
            });
            window.removeEventListener('mousemove', mouseMove, {
              capture: true,
            });
            window.removeEventListener('keydown', keyDown, { capture: true });
            eventCatcher.parentNode?.removeChild(eventCatcher);
            cleanup();
          };
        }
        case 'focused': {
          recursiveRaf(() => {
            drawHoverOverlay(
              inspectState.focusedDomElement,
              canvas,
              ctx,
              'locked',
            );
          });
          if (!document.contains(inspectState.focusedDomElement)) {
            setTimeout(() => {
              // potential race condition solution for some websites
              clearCanvas();
            }, 500);
            inspectState.propContainer.style.maxHeight = '0';
            inspectState.propContainer.style.width = 'fit-content';
            inspectState.propContainer.innerHTML = '';
            Store.inspectState.value = {
              kind: 'inspect-off',
              propContainer: inspectState.propContainer,
            };
            return;
          }
          drawHoverOverlay(
            inspectState.focusedDomElement,
            canvas,
            ctx,
            'locked',
          );
          const element = inspectState.focusedDomElement;

          const { parentCompositeFiber } =
            getCompositeComponentFromElement(element);
          if (!parentCompositeFiber) {
            return;
          }

          const reportDataFiber =
            Store.reportData.get(parentCompositeFiber) ??
            (parentCompositeFiber.alternate
              ? Store.reportData.get(parentCompositeFiber.alternate)
              : null);

          const didRender = didFiberRender(parentCompositeFiber); // because we react to any change, not just this fibers change, we need this check to know if the current fiber re-rendered for this publish

          renderPropsAndState(
            didRender,
            parentCompositeFiber,
            reportDataFiber,
            inspectState.propContainer,
          );

          const keyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              clearCanvas();
              drawHoverOverlay(
                (e.target as HTMLElement) ?? inspectState.focusedDomElement,
                canvas,
                ctx,
                'inspecting',
              );
              inspectState.propContainer.style.maxHeight = '0';
              inspectState.propContainer.style.width = 'fit-content';
              inspectState.propContainer.innerHTML = '';
              Store.inspectState.value = {
                kind: 'inspecting',
                hoveredDomElement:
                  (e.target as HTMLElement) ?? inspectState.focusedDomElement,
                propContainer: inspectState.propContainer,
              };
            }
          };
          window.addEventListener('keydown', keyDown, { capture: true });

          const onpointerdownCanvasLockIcon = (e: MouseEvent) => {
            if (!currentLockIconRect) {
              return;
            }

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            const adjustedX = x / OVERLAY_DPR;
            const adjustedY = y / OVERLAY_DPR;

            if (
              adjustedX >= currentLockIconRect.x &&
              adjustedX <= currentLockIconRect.x + currentLockIconRect.width &&
              adjustedY >= currentLockIconRect.y &&
              adjustedY <= currentLockIconRect.y + currentLockIconRect.height
            ) {
              inspectState.propContainer.innerHTML = '';
              inspectState.propContainer.style.maxHeight = '0';
              clearCanvas();

              drawHoverOverlay(
                e.target as HTMLElement,
                canvas,
                ctx,
                'inspecting',
              );
              e.stopPropagation();
              Store.inspectState.value = {
                kind: 'inspecting',
                hoveredDomElement: e.target as HTMLElement,
                propContainer: inspectState.propContainer,
              };

              return;
            }
          };
          window.addEventListener('pointerdown', onpointerdownCanvasLockIcon, {
            capture: true,
          });

          const cleanup = trackElementPosition(
            inspectState.focusedDomElement,
            () => {
              drawHoverOverlay(
                inspectState.focusedDomElement,
                canvas,
                ctx,
                'locked',
              );
            },
          );

          return () => {
            cleanup();

            window.removeEventListener('keydown', keyDown, { capture: true });
            window.removeEventListener(
              'pointerdown',
              onpointerdownCanvasLockIcon,
              { capture: true },
            );
          };
        }
      }
    })();

    if (unSub) {
      (unsubscribeFns as any)[Store.inspectState.value.kind] = unSub;
    }
  }, 16);

  Store.inspectState.subscribe(repaint);
  Store.lastReportTime.subscribe(repaint);

  return () => {
    /**/
  };
};
type CleanupFunction = () => void;
type PositionCallback = (element: Element) => void;

const trackElementPosition = (
  element: Element,
  callback: PositionCallback,
): CleanupFunction => {
  const handleAnyScroll = () => {
    callback(element);
  };

  document.addEventListener('scroll', handleAnyScroll, {
    passive: true,
    capture: true, // catch all scroll events
  });

  return () => {
    document.removeEventListener('scroll', handleAnyScroll, { capture: true });
  };
};
