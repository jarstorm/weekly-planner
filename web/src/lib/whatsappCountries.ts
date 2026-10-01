// Prefijos para el selector de país del contacto de WhatsApp (ContactInput).
// Reutiliza la lista completa de países de countries.ts (los mismos 243
// códigos ISO 3166-1 que organizations.country, con el nombre traducido vía
// Intl.DisplayNames y ordenado alfabéticamente en el idioma activo) y le
// suma el prefijo de marcación (código de llamada E.164), que esa lista no
// trae porque no lo necesita para el campo "país" de la organización.
import { COUNTRY_CODES, countryOptions } from './countries';

// Código de llamada internacional por país (sin el "+"). Territorios sin
// infraestructura telefónica propia (Antártida, islas deshabitadas) llevan
// el código de quien administra el territorio o el más cercano conocido —
// aproximado a propósito, nadie va a registrar un WhatsApp real desde ahí,
// pero así ningún país del selector queda sin prefijo.
const DIAL_CODES: Record<string, string> = {
  AF: '93', AL: '355', DZ: '213', AS: '1', AD: '376', AO: '244', AI: '1', AQ: '672', AG: '1', AR: '54',
  AM: '374', AW: '297', AU: '61', AT: '43', AZ: '994',
  BS: '1', BH: '973', BD: '880', BB: '1', BY: '375', BE: '32', BZ: '501', BJ: '229', BM: '1', BT: '975',
  BO: '591', BQ: '599', BA: '387', BW: '267', BV: '47',
  BR: '55', IO: '246', BN: '673', BG: '359', BF: '226', BI: '257', CV: '238', KH: '855', CM: '237', CA: '1',
  KY: '1', CF: '236', TD: '235', CL: '56', CN: '86',
  CX: '61', CC: '61', CO: '57', KM: '269', CG: '242', CD: '243', CK: '682', CR: '506', CI: '225', HR: '385',
  CU: '53', CW: '599', CY: '357', CZ: '420', DK: '45',
  DJ: '253', DM: '1', DO: '1', EC: '593', EG: '20', SV: '503', GQ: '240', ER: '291', EE: '372', SZ: '268',
  ET: '251', FK: '500', FO: '298', FJ: '679', FI: '358',
  FR: '33', GF: '594', PF: '689', TF: '262', GA: '241', GM: '220', GE: '995', DE: '49', GH: '233', GI: '350',
  GR: '30', GL: '299', GD: '1', GP: '590', GU: '1',
  GT: '502', GG: '44', GN: '224', GW: '245', GY: '592', HT: '509', HM: '672', VA: '379', HN: '504', HK: '852',
  HU: '36', IS: '354', IN: '91', ID: '62', IR: '98',
  IQ: '964', IE: '353', IM: '44', IL: '972', IT: '39', JM: '1', JP: '81', JE: '44', JO: '962', KZ: '7',
  KE: '254', KI: '686', KP: '850', KR: '82', KW: '965',
  KG: '996', LA: '856', LV: '371', LB: '961', LS: '266', LR: '231', LY: '218', LI: '423', LT: '370', LU: '352',
  MO: '853', MG: '261', MW: '265', MY: '60', MV: '960',
  ML: '223', MT: '356', MH: '692', MQ: '596', MR: '222', MU: '230', YT: '262', MX: '52', FM: '691', MD: '373',
  MC: '377', MN: '976', ME: '382', MS: '1', MA: '212',
  MZ: '258', MM: '95', NA: '264', NR: '674', NP: '977', NL: '31', NC: '687', NZ: '64', NI: '505', NE: '227',
  NG: '234', NU: '683', NF: '672', MK: '389', MP: '1',
  NO: '47', OM: '968', PK: '92', PW: '680', PS: '970', PA: '507', PG: '675', PY: '595', PE: '51', PH: '63',
  PN: '64', PL: '48', PT: '351', PR: '1', QA: '974',
  RE: '262', RO: '40', RU: '7', RW: '250', BL: '590', SH: '290', KN: '1', LC: '1', MF: '590', PM: '508',
  VC: '1', WS: '685', SM: '378', ST: '239', SA: '966',
  SN: '221', RS: '381', SC: '248', SL: '232', SG: '65', SX: '1', SK: '421', SI: '386', SB: '677', SO: '252',
  ZA: '27', GS: '500', SS: '211', ES: '34', LK: '94',
  SD: '249', SR: '597', SJ: '47', SE: '46', CH: '41', SY: '963', TW: '886', TJ: '992', TZ: '255', TH: '66',
  TL: '670', TG: '228', TK: '690', TO: '676', TT: '1',
  TN: '216', TR: '90', TM: '993', TC: '1', TV: '688', UG: '256', UA: '380', AE: '971', GB: '44', US: '1',
  UM: '1', UY: '598', UZ: '998', VU: '678', VE: '58',
  VN: '84', VG: '1', VI: '1', WF: '681', EH: '212', YE: '967', ZM: '260', ZW: '263',
};

// Todo código de COUNTRY_CODES tiene que tener prefijo — si falta uno, es
// un error en el mapa de arriba, no un país real sin código.
for (const code of COUNTRY_CODES) {
  if (!DIAL_CODES[code]) throw new Error(`whatsappCountries: falta el prefijo de marcación para "${code}"`);
}

export interface WhatsappCountryOption {
  code: string;
  name: string;
  dial: string;
}

// Mismo orden que countryOptions() (alfabético en el idioma activo) con el
// prefijo de marcación añadido.
export function whatsappCountryOptions(locale: string): WhatsappCountryOption[] {
  return countryOptions(locale).map((c) => ({ ...c, dial: DIAL_CODES[c.code] }));
}

export const DEFAULT_WHATSAPP_DIAL = DIAL_CODES.ES;

// Búsqueda por prefijo más largo primero: evita que "1" (EE.UU. y una
// decena de territorios del Caribe) se confunda con dial codes de 2-3
// cifras que empiezan igual.
const ALL_DIALS_DESC = [...new Set(Object.values(DIAL_CODES))].sort((a, b) => b.length - a.length);

export function splitWhatsappContact(contact: string): { dial: string; national: string } {
  const digits = contact.replace(/\D/g, '');
  const match = ALL_DIALS_DESC.find((dial) => digits.startsWith(dial));
  if (!match) return { dial: DEFAULT_WHATSAPP_DIAL, national: digits };
  return { dial: match, national: digits.slice(match.length) };
}

// Sin librería de validación de números reales (libphonenumber) — esto es
// una comprobación básica de longitud del número nacional (sin prefijo),
// suficiente para atajar errores evidentes de tecleo sin bloquear números
// válidos que no conocemos.
export function isValidWhatsappNational(national: string): boolean {
  return /^\d{6,12}$/.test(national);
}

// Para mostrar el contacto guardado (dial+número pegados, como lo manda la
// Cloud API) de forma legible en tablas/fichas: "+34 670995609" en vez de
// "34670995609".
export function formatWhatsappContact(contact: string): string {
  const { dial, national } = splitWhatsappContact(contact);
  return `+${dial} ${national}`;
}
