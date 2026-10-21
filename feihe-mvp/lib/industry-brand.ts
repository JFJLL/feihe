// Only exact brand or project-SPU aliases are equivalent; never merge arbitrary brand prefixes.
export function canonicalIndustryBrand(raw: string, brand: string, spu = ''): string {
  const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, '');
  const value = normalize(raw);
  if (brand && value && (value === normalize(brand) || (spu && value === normalize(spu)))) return brand;
  const platformLabels: Record<string, string[]> = { '美菱': ['美菱电商'], '稳健': ['稳健医疗'] };
  if (platformLabels[brand]?.some(alias => normalize(alias) === value)) return brand;
  return raw;
}
