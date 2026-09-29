import { t } from './i18n';

/** Which fields appear in “My profile” per persona. */
export const PROFILE_SCHEMA = {
  industry: ['name', 'org', 'city', 'products', 'market', 'udyam'],
  foreign_exporter: ['name', 'org', 'city', 'products', 'country', 'air_name'],
  citizen: ['name', 'org', 'city'],
  gold_investor: ['name', 'org', 'city'],
  lab_testing: ['name', 'org', 'city', 'labScope', 'nabl'],
  academic: ['name', 'org', 'city', 'researchTopic'],
  enforcement: ['name', 'org', 'city', 'badgeId', 'region'],
  bis_admin: ['name', 'org', 'city', 'desk', 'role'],
};

export const FIELD_KEYS = {
  name: 'name',
  org: 'org',
  city: 'city',
  products: 'products',
  market: 'market',
  udyam: 'udyam',
  country: 'country',
  air_name: 'air_name',
  labScope: 'labScope',
  nabl: 'nabl',
  researchTopic: 'researchTopic',
  badgeId: 'badgeId',
  region: 'region',
  desk: 'desk',
  role: 'role',
};

export function profileLabel(lang, key) {
  const map = {
    labScope: lang === 'hi' ? 'परीक्षण क्षेत्र' : 'Testing scope',
    nabl: lang === 'hi' ? 'NABL संख्या' : 'NABL number',
    researchTopic: lang === 'hi' ? 'शोध विषय' : 'Research topic',
    badgeId: lang === 'hi' ? 'बैज / ID' : 'Badge / ID',
    region: lang === 'hi' ? 'क्षेत्र' : 'Region',
    desk: lang === 'hi' ? 'कार्य मेज' : 'Desk / queue',
    role: lang === 'hi' ? 'भूमिका' : 'Role',
    country: lang === 'hi' ? 'मूल देश' : 'Country of origin',
    air_name: lang === 'hi' ? 'भारतीय प्राधिकृत प्रतिनिधि' : 'Authorised Indian Representative',
  };
  if (map[key]) return map[key];
  return t(lang, key);
}
