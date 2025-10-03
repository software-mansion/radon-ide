import { useEffect, useRef } from "react";

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

interface CaptchaProps {
  onSolve: (token: string) => void;
}

const CAPTCHA_ID = "recaptcha-container";
const isProduction = process.env.NODE_ENV === "production";

const reCaptchaSiteKey = isProduction
  ? "6Lcz8tsrAAAAANZ7zDBvT5u6YgjqVowQNBcV3MB8"
  : "6Lf81tsrAAAAAJmwn8scgOHiSCIutG-l9GjMrTLt";

const Captcha = ({ onSolve }: CaptchaProps) => {
  const widgetId = useRef<number | null>(null);

  useEffect(() => {
    window.captchaOnLoad = () => {
      const element = document.getElementById(CAPTCHA_ID);
      if (!element || element.hasChildNodes()) {
        return;
      }

      widgetId.current = window.grecaptcha.enterprise.render(CAPTCHA_ID, {
        sitekey: reCaptchaSiteKey,
        callback: onSolve,
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
};

export default Captcha;
