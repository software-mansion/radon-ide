import { useEffect, useState } from "react";

const RADON_IDE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=swmansion.react-native-ide";
const RADON_IDE_OPEN_VSX_API = "https://open-vsx.org/api/swmansion/react-native-ide";

async function fetchInstallCount(): Promise<number | null> {
  try {
    const marketplaceResponse = await fetch(RADON_IDE_MARKETPLACE_URL);
    let installsCount = 0;
    if (marketplaceResponse.ok) {
      const htmlString = await marketplaceResponse.text();
      const regex = /<span class="installs-text"[^>]*>\s*([\d,]+)\s*installs\s*<\/span>/i;
      const match = htmlString.match(regex);
      if (match) installsCount = parseInt(match[1].replace(/,/g, ""));
    }

    const openvsxResponse = await fetch(RADON_IDE_OPEN_VSX_API);
    let downloadsCount = 0;
    if (openvsxResponse.ok) {
      const data = await openvsxResponse.json();
      downloadsCount = parseInt(data.downloadCount ?? 0);
    }

    const sum = installsCount + downloadsCount;
    if (marketplaceResponse.ok && openvsxResponse.ok) {
      return sum;
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

interface UseInstallCountResult {
  data: number | null;
  error: Error | null;
  isLoading: boolean;
}

export default function useInstallCount(): UseInstallCountResult {
  const [data, setData] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const count = await fetchInstallCount();
        if (count !== null) {
          setData(count);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch install count"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return { data, error, isLoading };
}
