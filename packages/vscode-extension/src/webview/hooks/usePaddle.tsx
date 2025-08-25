import { useEffect, useState } from "react";
import { initializePaddle, InitializePaddleOptions, Paddle } from "@paddle/paddle-js";

const paddleOptions: InitializePaddleOptions = window.RNIDE_isDev
  ? {
      environment: "sandbox",
      token: "test_e4f6457e74dffcba61da98c3e6e",
    }
  : {
      environment: "production",
      token: "live_66e3b794dd039b367ade77942ab",
    };

function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle>();

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
