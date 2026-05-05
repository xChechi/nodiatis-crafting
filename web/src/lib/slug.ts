/**
 * Slugify an item name into a URL-safe form.
 * Handles Nodiatis quirks: roman-numeral brackets like "}I{", "}II{",
 * accented characters, etc.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/}/g, "-")
    .replace(/{/g, "-")
    .replace(/[éè]/g, "e")
    .replace(/[àâ]/g, "a")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
