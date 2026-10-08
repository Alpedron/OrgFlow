export async function copyTextToClipboard(text) {
  if (!text) throw new Error("There is no invite code to copy.");

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Clipboard API can be unavailable or denied; try the legacy browser API.
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    field.remove();
  }

  if (!copied) throw new Error("Clipboard access is unavailable.");
}
