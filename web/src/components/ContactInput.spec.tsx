import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ContactInput } from './ContactInput';
import esMessages from '../../messages/es.json';

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('ContactInput — canal email', () => {
  it('renderiza un input de email que pasa el valor tal cual en onChange', () => {
    const onChange = vi.fn();
    renderWithIntl(<ContactInput channel="email" contact="" onChange={onChange} />);

    const input = screen.getByPlaceholderText('nombre@empresa.com');
    fireEvent.change(input, { target: { value: 'ana@example.com' } });

    expect(onChange).toHaveBeenCalledWith('ana@example.com');
  });
});

describe('ContactInput — canal whatsapp', () => {
  it('al entrar en modo whatsapp, separa el contacto guardado (dial+nacional pegados) entre selector y número', () => {
    renderWithIntl(<ContactInput channel="whatsapp" contact="34670995609" onChange={vi.fn()} />);

    const select = screen.getByLabelText('País') as HTMLSelectElement;
    const input = screen.getByPlaceholderText('670 99 56 09') as HTMLInputElement;

    expect(select.value).toBe('34');
    expect(input.value).toBe('670995609');
  });

  it('escribir en el número descarta caracteres no numéricos y manda dial+nacional pegados', () => {
    const onChange = vi.fn();
    renderWithIntl(<ContactInput channel="whatsapp" contact="" onChange={onChange} />);

    const input = screen.getByPlaceholderText('670 99 56 09');
    fireEvent.change(input, { target: { value: '670 99-56a09' } });

    expect(onChange).toHaveBeenCalledWith('34670995609');
  });

  it('cambiar de país recalcula el contacto con el nuevo prefijo', () => {
    const onChange = vi.fn();
    renderWithIntl(<ContactInput channel="whatsapp" contact="34670995609" onChange={onChange} />);

    const select = screen.getByLabelText('País');
    fireEvent.change(select, { target: { value: '1' } });

    expect(onChange).toHaveBeenCalledWith('1670995609');
  });

  it('muestra el aviso de número inválido solo cuando hay texto y no cumple 6-12 dígitos', () => {
    renderWithIntl(<ContactInput channel="whatsapp" contact="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('670 99 56 09');

    expect(screen.queryByText(/Revisa el número/)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '123' } });
    expect(screen.getByText(/Revisa el número/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '670995609' } });
    expect(screen.queryByText(/Revisa el número/)).not.toBeInTheDocument();
  });
});
