/**
 * Pays proposés dans onboarding / paramètres.
 * Afrique centrale = CEMAC + CD, AO, ST (marché restaurants francophones).
 */
export type CountryOption = {
  code: string;
  label: string;
  timezone: string;
  currency: string;
  region: 'central' | 'west' | 'north' | 'other';
};

export const CENTRAL_AFRICA_COUNTRIES: CountryOption[] = [
  { code: 'CM', label: 'Cameroun', timezone: 'Africa/Douala', currency: 'XAF', region: 'central' },
  {
    code: 'CG',
    label: 'Congo (Brazzaville)',
    timezone: 'Africa/Brazzaville',
    currency: 'XAF',
    region: 'central',
  },
  { code: 'CD', label: 'RD Congo', timezone: 'Africa/Kinshasa', currency: 'CDF', region: 'central' },
  { code: 'GA', label: 'Gabon', timezone: 'Africa/Libreville', currency: 'XAF', region: 'central' },
  {
    code: 'CF',
    label: 'République centrafricaine',
    timezone: 'Africa/Bangui',
    currency: 'XAF',
    region: 'central',
  },
  { code: 'TD', label: 'Tchad', timezone: 'Africa/Ndjamena', currency: 'XAF', region: 'central' },
  {
    code: 'GQ',
    label: 'Guinée équatoriale',
    timezone: 'Africa/Malabo',
    currency: 'XAF',
    region: 'central',
  },
  { code: 'AO', label: 'Angola', timezone: 'Africa/Luanda', currency: 'AOA', region: 'central' },
  {
    code: 'ST',
    label: 'Sao Tomé-et-Príncipe',
    timezone: 'Africa/Sao_Tome',
    currency: 'STN',
    region: 'central',
  },
];

export const OTHER_SUPPORTED_COUNTRIES: CountryOption[] = [
  { code: 'SN', label: 'Sénégal', timezone: 'Africa/Dakar', currency: 'XOF', region: 'west' },
  { code: 'CI', label: "Côte d'Ivoire", timezone: 'Africa/Abidjan', currency: 'XOF', region: 'west' },
  { code: 'BJ', label: 'Bénin', timezone: 'Africa/Porto-Novo', currency: 'XOF', region: 'west' },
  { code: 'BF', label: 'Burkina Faso', timezone: 'Africa/Ouagadougou', currency: 'XOF', region: 'west' },
  { code: 'ML', label: 'Mali', timezone: 'Africa/Bamako', currency: 'XOF', region: 'west' },
  { code: 'NE', label: 'Niger', timezone: 'Africa/Niamey', currency: 'XOF', region: 'west' },
  { code: 'TG', label: 'Togo', timezone: 'Africa/Lome', currency: 'XOF', region: 'west' },
  { code: 'GN', label: 'Guinée', timezone: 'Africa/Conakry', currency: 'GNF', region: 'west' },
  { code: 'MA', label: 'Maroc', timezone: 'Africa/Casablanca', currency: 'MAD', region: 'north' },
  { code: 'NG', label: 'Nigeria', timezone: 'Africa/Lagos', currency: 'NGN', region: 'other' },
];

/** Liste complète : Afrique centrale en premier, puis reste. */
export const COUNTRY_OPTIONS: CountryOption[] = [
  ...CENTRAL_AFRICA_COUNTRIES,
  ...OTHER_SUPPORTED_COUNTRIES,
];

export function getCountryOption(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((c) => c.code === code);
}
