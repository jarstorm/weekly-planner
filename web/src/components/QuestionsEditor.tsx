'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const MAX_QUESTIONS = 5;

interface QuestionsEditorProps {
  questions: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyHint?: string;
  limitHint: string;
}

// Hasta 5 preguntas de texto libre para la encuesta anónima — mismo
// patrón de lista editable que RecipientsEditor, pero sin validar formato
// (son preguntas, no emails) y con tope de 5 (surveys_questions_count en
// schema.sql lo rechaza igual a nivel de base de datos).
export function QuestionsEditor({ questions, onChange, placeholder, addLabel, emptyHint, limitHint }: QuestionsEditorProps) {
  const [draft, setDraft] = useState('');
  const atLimit = questions.length >= MAX_QUESTIONS;

  function handleAdd() {
    const question = draft.trim();
    if (!question || atLimit) {
      setDraft('');
      return;
    }
    onChange([...questions, question]);
    setDraft('');
  }

  function handleRemove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  return (
    <div>
      {questions.length > 0 ? (
        <ul className="member-list">
          {questions.map((question, index) => (
            <li key={index}>
              {question}
              <button type="button" className="btn-ghost" onClick={() => handleRemove(index)} aria-label={question}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        emptyHint && <p className="field-hint">{emptyHint}</p>
      )}
      {atLimit ? (
        <p className="field-hint">{limitHint}</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={handleAdd}>
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
