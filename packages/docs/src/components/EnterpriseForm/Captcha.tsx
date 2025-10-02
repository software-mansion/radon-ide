import { useEffect, forwardRef, useRef, useImperativeHandle } from "react";

declare global {
  interface Window {
    captchaOnLoad?: () => void;
    // Types taken from https://cloud.google.com/recaptcha/docs/api-ref-checkbox-keys
    grecaptcha?: {
      enterprise?: {
        render: (container: string | HTMLElement, parameters: Object) => number;
        reset: (widgetId: number) => void;
        execute: (widgetId: number) => Promise<string>;
        ready: (callback: Function) => number;
        getResponse: (widgetId: number) => string; // returns token
      };
      getPageId?: () => string;
    };
  }
}

export interface CaptchaRef {
  reset: () => void;
  getToken: () => string;
}

const CAPTCHA_ID = "recaptcha-container";

const isProduction = process.env.NODE_ENV === "production";

const reCaptchaSiteKey = isProduction
  ? "6Lcz8tsrAAAAANZ7zDBvT5u6YgjqVowQNBcV3MB8"
  : "6Lc49dsrAAAAAPaODuCn15YUCo_0tnrofIGE9pdy";

const Captcha = forwardRef((_, captchaRef) => {
  const captchaId = useRef<number | null>(null);

  useImperativeHandle(
    captchaRef,
    () => ({
      reset: () => {
        if (
          captchaId.current !== null &&
          window.grecaptcha?.enterprise &&
          window.grecaptcha.enterprise.getResponse(captchaId.current)
        ) {
          window.grecaptcha.enterprise.reset(captchaId.current);
        }
      },
      getToken: () => {
        if (captchaId.current !== null && window.grecaptcha?.enterprise) {
          return window.grecaptcha.enterprise.getResponse(captchaId.current);
        }
        return "";
      },
    }),
    []
  );

  useEffect(() => {
    window.captchaOnLoad = () => {
      const element = document.getElementById(CAPTCHA_ID);
      if (!element || element.hasChildNodes()) {
        return;
      }

      captchaId.current = window.grecaptcha.enterprise.render(CAPTCHA_ID, {
        sitekey: reCaptchaSiteKey,
      });
    };
    if (document.getElementById("grecaptcha-script") === null) {
      const script = document.createElement("script");
      script.id = "grecaptcha-script";
      script.async = true;
      script.defer = true;
      script.src =
        "https://www.google.com/recaptcha/enterprise.js?onload=captchaOnLoad&render=explicit";

      document.body.appendChild(script);
    } else if (window.grecaptcha?.enterprise) {
      window.captchaOnLoad();
    }
  }, []);
  return <div id={CAPTCHA_ID} />;
});

export default Captcha;
