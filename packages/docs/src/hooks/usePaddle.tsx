import { useEffect, useState } from "react";
import { initializePaddle, InitializePaddleOptions, Paddle } from "@paddle/paddle-js";
import { track } from "@vercel/analytics";

const eventCallback = (event) => {
  const { name, data } = event;
  const { items } = data;
  const [item] = items;
  const payload = { priceName: item.price_name, interval: item.billing_cycle.interval };

  switch (name) {
    case "checkout.loaded":
      track("Checkout loaded", payload);
      break;
    case "checkout.closed":
      track("Checkout closed", payload);
      break;
    case "checkout.completed":
      track("Checkout completed", payload);
      break;
    case "checkout.error":
      track("Checkout error", payload);
      break;
  }
};

const paddleOptions: InitializePaddleOptions =
  process.env.NODE_ENV === "production"
    ? {
        environment: "production",
        token: "live_66e3b794dd039b367ade77942ab",
        eventCallback,
      }
    : {
        environment: "sandbox",
        token: "test_e4f6457e74dffcba61da98c3e6e",
        eventCallback,
      };

function usePaddle() {
  // Create a local state to store Paddle instance
  const [paddle, setPaddle] = useState<Paddle>();

  // Download and initialize Paddle instance from CDN
  useEffect(() => {
    initializePaddle(paddleOptions).then((paddleInstance: Paddle | undefined) => {
      if (paddleInstance) {
        setPaddle(paddleInstance);
      }
    });
  }, []);

  return paddle;
}

export default usePaddle;
