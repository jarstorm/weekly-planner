import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';

// Mismo patrón que AppShell.spec.tsx / register/page.spec.tsx: fuera de un
// router de Next real, next-intl no puede resolver next/navigation.
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/app',
  Link: ({ children, href, locale, ...rest }: any) => (
    <a href={href} data-locale={locale} {...rest}>
      {children}
    </a>
  ),
}));

function renderSwitcher(locale: 'es' | 'en' = 'es') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

describe('LocaleSwitcher', () => {
  it('el menú empieza cerrado', () => {
    renderSwitcher();

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicar el trigger abre el menú con las dos opciones de idioma', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('marca como activa la opción del locale actual', () => {
    renderSwitcher('en');
    fireEvent.click(screen.getByRole('button'));

    const options = screen.getAllByRole('option');
    const english = options.find((o) => o.textContent?.includes('English'));
    const spanish = options.find((o) => o.textContent?.includes('Español'));

    expect(english).toHaveAttribute('aria-selected', 'true');
    expect(spanish).toHaveAttribute('aria-selected', 'false');
  });

  it('clicar una opción cierra el menú (no deja el dropdown abierto tras navegar)', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByText('English'));

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clicar fuera del componente cierra el menú', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clicar dentro del componente (el propio trigger) no lo cierra por el listener de click-outside', () => {
    renderSwitcher();
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(trigger);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
