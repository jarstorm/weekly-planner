import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipientsEditor } from './RecipientsEditor';

describe('RecipientsEditor', () => {
  it('añade el email recortando espacios y en minúsculas', () => {
    const onChange = vi.fn();
    render(<RecipientsEditor recipients={[]} onChange={onChange} placeholder="email" addLabel="Añadir" />);

    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: '  Ana@Example.com  ' } });
    fireEvent.click(screen.getByText('Añadir'));

    expect(onChange).toHaveBeenCalledWith(['ana@example.com']);
  });

  it('no añade un email que ya está en la lista (sin duplicados)', () => {
    const onChange = vi.fn();
    render(<RecipientsEditor recipients={['ana@example.com']} onChange={onChange} placeholder="email" addLabel="Añadir" />);

    fireEvent.change(screen.getByPlaceholderText('email'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByText('Añadir'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('no añade nada si el campo está vacío', () => {
    const onChange = vi.fn();
    render(<RecipientsEditor recipients={[]} onChange={onChange} placeholder="email" addLabel="Añadir" />);

    fireEvent.click(screen.getByText('Añadir'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('Enter añade el email y no dispara el submit del formulario contenedor', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <RecipientsEditor recipients={[]} onChange={onChange} placeholder="email" addLabel="Añadir" />
      </form>,
    );

    const input = screen.getByPlaceholderText('email');
    fireEvent.change(input, { target: { value: 'bruno@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['bruno@example.com']);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('quita un email de la lista al pulsar su botón de borrar', () => {
    const onChange = vi.fn();
    render(
      <RecipientsEditor recipients={['ana@example.com', 'bruno@example.com']} onChange={onChange} placeholder="email" addLabel="Añadir" />,
    );

    fireEvent.click(screen.getByLabelText('ana@example.com'));

    expect(onChange).toHaveBeenCalledWith(['bruno@example.com']);
  });

  it('muestra el hint vacío solo cuando no hay destinatarios', () => {
    const { rerender } = render(
      <RecipientsEditor recipients={[]} onChange={vi.fn()} placeholder="email" addLabel="Añadir" emptyHint="Sin destinatarios" />,
    );
    expect(screen.getByText('Sin destinatarios')).toBeInTheDocument();

    rerender(
      <RecipientsEditor recipients={['ana@example.com']} onChange={vi.fn()} placeholder="email" addLabel="Añadir" emptyHint="Sin destinatarios" />,
    );
    expect(screen.queryByText('Sin destinatarios')).not.toBeInTheDocument();
  });
});
