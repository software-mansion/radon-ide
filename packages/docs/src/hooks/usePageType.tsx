import { useLocation } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";

const usePageType = () => {
  const location = useLocation();
  const baseUrl = useBaseUrl("/");

  return {
    isDocumentation: location.pathname.startsWith(`${baseUrl}docs`),
    isLanding: location.pathname === baseUrl,
    isFeatures: location.pathname.startsWith(`${baseUrl}features`),
    isEnterprise: location.pathname.startsWith(`${baseUrl}enterprise`),
  };
};

export default usePageType;
