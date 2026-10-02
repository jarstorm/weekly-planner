import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionsEditor } from './QuestionsEditor';

function baseProps(overrides: Partial<Parameters<typeof QuestionsEditor>[0]> = {}) {
  return {
    questions: [],
    onChange: vi.fn(),
    placeholder: '¿Qué tal el mes?',
    addLabel: 'Añadir',
    limitHint: 'Máximo 5 preguntas',
    ...overrides,
  };
}

describe('QuestionsEditor', () => {
  it('añade la pregunta recortando espacios, sin tocar mayúsculas (no es un email)', () => {
    const onChange = vi.fn();
    render(<QuestionsEditor {...baseProps({ onChange })} />);

    fireEvent.change(screen.getByPlaceholderText('¿Qué tal el mes?'), { target: { value: '  ¿Algo que mejorar?  ' } });
    fireEvent.click(screen.getByText('Añadir'));

    expect(onChange).toHaveBeenCalledWith(['¿Algo que mejorar?']);
  });

  it('a diferencia de RecipientsEditor, permite preguntas repetidas', () => {
    const onChange = vi.fn();
    render(<QuestionsEditor {...baseProps({ questions: ['¿Qué tal?'], onChange })} />);

    fireEvent.change(screen.getByPlaceholderText('¿Qué tal el mes?'), { target: { value: '¿Qué tal?' } });
    fireEvent.click(screen.getByText('Añadir'));

    expect(onChange).toHaveBeenCalledWith(['¿Qué tal?', '¿Qué tal?']);
  });

  it('con 5 preguntas (límite), oculta el input/botón de añadir y muestra el aviso de límite', () => {
    const questions = ['1', '2', '3', '4', '5'];
    render(<QuestionsEditor {...baseProps({ questions })} />);

    expect(screen.queryByPlaceholderText('¿Qué tal el mes?')).not.toBeInTheDocument();
    expect(screen.getByText('Máximo 5 preguntas')).toBeInTheDocument();
  });

  it('quita la pregunta correcta por índice, incluso con preguntas duplicadas', () => {
    const onChange = vi.fn();
    render(<QuestionsEditor {...baseProps({ questions: ['A', 'B', 'A'], onChange })} />);

    // Dos "A" en la lista — ambos botones tienen el mismo aria-label, se borra el primero.
    const buttons = screen.getAllByLabelText('A');
    fireEvent.click(buttons[0]);

    expect(onChange).toHaveBeenCalledWith(['B', 'A']);
  });

  it('Enter añade la pregunta sin disparar el submit del formulario', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <QuestionsEditor {...baseProps({ onChange })} />
      </form>,
    );

    const input = screen.getByPlaceholderText('¿Qué tal el mes?');
    fireEvent.change(input, { target: { value: '¿Bloqueos?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['¿Bloqueos?']);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
