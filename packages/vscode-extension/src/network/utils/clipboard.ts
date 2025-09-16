export async function copyToClipboard(text: string | undefined): Promise<void> {
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    throw error;
  }
}
