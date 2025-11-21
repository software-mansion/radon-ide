import { useState } from "react";
import usePaddle from "@site/src/hooks/usePaddle";

const isProduction = process.env.NODE_ENV === "production";

const RADON_PRO_MONTHLY_PRICE_ID = isProduction
  ? "pri_01k8aqbvbzyz1stf8wbaf9z04y"
  : "pri_01k1g12g3y3tqvpzw8tcyrsd1y";
const RADON_PRO_YEARLY_PRICE_ID = isProduction
  ? "pri_01k8aqd6hs0fsj84vdk9y512tm"
  : "pri_01k1g8d3h0mhbtr5hfd9e4n8yg";
const RADON_TEAM_MONTHLY_PRICE_ID = isProduction
  ? "pri_01k8aqe9fxteqjn4ak2geqgyr4"
  : "pri_01k7s70594cg2nwgczecz1r6qv";
const RADON_TEAM_YEARLY_PRICE_ID = isProduction
  ? "pri_01k8aqfv007g6c1y6z353rb3jk"
  : "pri_01k7s7s2syga55fjkx8f0wcszr";

export const usePricingLogic = () => {
  const paddle = usePaddle();

  const [isMonthly, setIsMonthly] = useState(false);
  const openRadonProCheckout = () => {
    paddle?.Checkout.open({
      items: [
        {
          priceId: isMonthly ? RADON_PRO_MONTHLY_PRICE_ID : RADON_PRO_YEARLY_PRICE_ID,
          quantity: 1,
        },
      ],
    });
  };
  const openRadonTeamCheckout = () => {
    paddle?.Checkout.open({
      items: [
        {
          priceId: isMonthly ? RADON_TEAM_MONTHLY_PRICE_ID : RADON_TEAM_YEARLY_PRICE_ID,
          quantity: 1,
        },
      ],
    });
  };

  return {
    isMonthly,
    setIsMonthly,
    openRadonProCheckout,
    openRadonTeamCheckout,
  };
};
