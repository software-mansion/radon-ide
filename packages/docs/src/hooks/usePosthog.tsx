import PostHog, { PostHogConfig } from "posthog-js";
import { useEffect, useState } from "react";

const isProduction = process.env.NODE_ENV === "production";

const posthogOptions: Partial<PostHogConfig> = isProduction
  ? {
      // production api_host must match rewrites in vercel.json
      api_host: "/rnide-PsHg/",
      ui_host: "https://eu.posthog.com",
    }
  : {
      api_host: "https://eu.i.posthog.com",
    };

const commonPosthogOptions: Partial<PostHogConfig> = {
  person_profiles: "always",
  defaults: "2025-05-24",
};

function usePosthog() {
  const [posthog, setPosthog] = useState<typeof PostHog | undefined>();

  useEffect(() => {
    const p = PostHog.init("phc_tfuWCtrXJ8OFqvy3eT0ehYAoJWQ0KLQhGeOVqbPdIiJ", {
      ...posthogOptions,
      ...commonPosthogOptions,
    });

    setPosthog(p);
  }, []);

  return posthog;
}

export default usePosthog;
