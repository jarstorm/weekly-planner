'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChannelName } from '@/lib/api';
import {
  DEFAULT_WHATSAPP_DIAL,
  isValidWhatsappNational,
  splitWhatsappContact,
  whatsappCountryOptions,
} from '@/lib/whatsappCountries';

interface ContactInputProps {
  channel: ChannelName;
  contact: string;
  onChange: (contact: string) => void;
  required?: boolean;
}

// Solo cubre email y whatsapp — telegram no pasa por acá, se vincula solo
// (ver NewMemberPage/EditMemberPage).
export function ContactInput({ channel, contact, onChange, required = true }: ContactInputProps) {
  const t = useTranslations('ContactInput');
  const locale = useLocale();
  const [dial, setDial] = useState(DEFAULT_WHATSAPP_DIAL);
  const [national, setNational] = useState('');
  const countries = whatsappCountryOptions(locale);

  // Repartir el contacto guardado (dial+número pegados, como lo manda la
  // Cloud API de WhatsApp) entre el selector de país y el input de número
  // cada vez que se entra en modo whatsapp — incluida la primera carga del
  // miembro en edición.
  useEffect(() => {
    if (channel !== 'whatsapp') return;
    const parsed = splitWhatsappContact(contact);
    setDial(parsed.dial);
    setNational(parsed.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  if (channel === 'whatsapp') {
    const invalid = national.length > 0 && !isValidWhatsappNational(national);
    return (
      <div>
        <div className="contact-whatsapp-row">
          <select
            value={dial}
            aria-label={t('countryLabel')}
            onChange={(e) => {
              setDial(e.target.value);
              onChange(`${e.target.value}${national}`);
            }}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.dial}>
                {c.name} (+{c.dial})
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="numeric"
            placeholder={t('whatsappPlaceholder')}
            value={national}
            required={required}
            aria-invalid={invalid}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              setNational(digits);
              onChange(`${dial}${digits}`);
            }}
          />
        </div>
        {invalid && <p className="field-error">{t('whatsappInvalid')}</p>}
      </div>
    );
  }

  return (
    <input
      type="email"
      placeholder={t('emailPlaceholder')}
      value={contact}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
