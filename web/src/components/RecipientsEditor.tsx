'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface RecipientsEditorProps {
  recipients: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyHint?: string;
}

// Lista de emails editable — usado tanto para teams.report_recipients
// (informe de equipo) como organizations.executive_summary_recipients
// (resumen ejecutivo), ver migración 0009. Siempre email, sin selector de
// canal por destinatario (decisión explícita, ver ReportJob).
export function RecipientsEditor({ recipients, onChange, placeholder, addLabel, emptyHint }: RecipientsEditorProps) {
  const [draft, setDraft] = useState('');

  function handleAdd() {
    const email = draft.trim().toLowerCase();
    if (!email || recipients.includes(email)) {
      setDraft('');
      return;
    }
    onChange([...recipients, email]);
    setDraft('');
  }

  function handleRemove(email: string) {
    onChange(recipients.filter((r) => r !== email));
  }

  return (
    <div>
      {recipients.length > 0 ? (
        <ul className="member-list">
          {recipients.map((email) => (
            <li key={email}>
              {email}
              <button type="button" className="btn-ghost" onClick={() => handleRemove(email)} aria-label={email}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        emptyHint && <p className="field-hint">{emptyHint}</p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          // preventDefault: este input suele vivir dentro de un <form> con
          // su propio submit — sin esto, Enter aquí guardaría el formulario
          // entero en vez de solo añadir el email a la lista.
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
    </div>
  );
}
