import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

function baseProps(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return {
    open: true,
    title: 'Borrar miembro',
    message: '¿Seguro?',
    confirmLabel: 'Borrar',
    cancelLabel: 'Cancelar',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  it('open=false no renderiza nada', () => {
    const { container } = render(<ConfirmDialog {...baseProps({ open: false })} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('el botón de confirmar llama a onConfirm, no a onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onConfirm, onCancel })} />);

    fireEvent.click(screen.getByText('Borrar'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('el botón de cancelar llama a onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel })} />);

    fireEvent.click(screen.getByText('Cancelar'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicar fuera de la tarjeta (overlay) cancela — click accidental no confirma nada', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmDialog {...baseProps({ onCancel, onConfirm })} />);

    fireEvent.click(container.querySelector('.modal-overlay')!);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicar dentro de la tarjeta NO cancela (stopPropagation) — pedido tras un borrado accidental', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps({ onCancel })} />);

    fireEvent.click(screen.getByText('¿Seguro?'));

    expect(onCancel).not.toHaveBeenCalled();
  });
});
