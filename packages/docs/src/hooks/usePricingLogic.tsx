import { useState } from "react";
import usePaddle from "@site/src/hooks/usePaddle";

const isProduction = process.env.NODE_ENV === "production";

const INDIVIDUAL_MONTHLY_PRICE_ID = isProduction
  ? "pri_01hx944ht3wnpvgktatj6v5k4b"
  : "pri_01j0tjqzqhv6vezhf14pwtxfm0";
const INDIVIDUAL_YEARLY_PRICE_ID = isProduction
  ? "pri_01hzf02s579nwrwb756enh8r7g"
  : "pri_01jb1ajv7btj3cbnshrdq4ncjf";
const BUSINESS_MONTHLY_PRICE_ID = isProduction
  ? "pri_01jdyc0j8wkfqx3a7nbf6tsaxy"
  : "pri_01jdyap7jcydxvewmek2r0e35q";
const BUSINESS_YEARLY_PRICE_ID = isProduction
  ? "pri_01jdyc1z1nh3pgp01ya4h8g075"
  : "pri_01jdyaqnwf3w4pm6hsgwehm1by";

export const usePricingLogic = () => {
  const paddle = usePaddle();

  const [isMonthly, setIsMonthly] = useState(true);
  const openIndividualCheckout = () => {
    paddle?.Checkout.open({
      items: [
        {
          priceId: isMonthly ? INDIVIDUAL_MONTHLY_PRICE_ID : INDIVIDUAL_YEARLY_PRICE_ID,
          quantity: 1,
        },
      ],
    });
  };
  const openBusinessCheckout = () => {
    paddle?.Checkout.open({
      items: [
        { priceId: isMonthly ? BUSINESS_MONTHLY_PRICE_ID : BUSINESS_YEARLY_PRICE_ID, quantity: 1 },
      ],
    });
  };

  const scrollToForm = <T extends HTMLElement>(ref: React.RefObject<T>) => {
    ref.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return {
    isMonthly,
    setIsMonthly,
    openIndividualCheckout,
    openBusinessCheckout,
    scrollToForm,
  };
};
