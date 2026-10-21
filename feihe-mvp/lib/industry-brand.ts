// Only exact brand or project-SPU aliases are equivalent; never merge arbitrary brand prefixes.
export function canonicalIndustryBrand(raw: string, brand: string, spu = ''): string {
  const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
  const value = normalize(raw);
  if (brand && value && (value === normalize(brand) || (spu && value === normalize(spu)))) return brand;
  return raw;
}
