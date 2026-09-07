/** Reject broken encoding rather than guessing a brand from a note title. */
export function validBrand(value: string): string {
  const text = value.trim();
  return [...text].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '\uFFFD') || /https?:\/\//i.test(text) ? '' : text;
}

export const invalidBrandSql = "(brand GLOB '*[' || char(1) || '-' || char(31) || char(127) || char(65533) || ']*' OR brand LIKE '%http://%' OR brand LIKE '%https://%')";
