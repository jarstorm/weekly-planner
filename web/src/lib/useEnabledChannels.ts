import { useEffect, useState } from 'react';
import { api, EnabledChannels } from './api';

// Default optimista mientras carga GET /channels/enabled: email fijo,
// telegram ya operativo, whatsapp oculto hasta que el backend confirme
// ENABLE_WHATSAPP_CHANNEL=true (cuenta de Meta operativa, sección 0.2).
const DEFAULT_ENABLED: EnabledChannels = { email: true, telegram: true, whatsapp: false };

export function useEnabledChannels(): EnabledChannels {
  const [enabled, setEnabled] = useState<EnabledChannels>(DEFAULT_ENABLED);

  useEffect(() => {
    api
      .getEnabledChannels()
      .then(setEnabled)
      .catch(() => {
        // Sin conexión al backend: se queda con el default optimista, no
        // hay nada mejor que mostrar y no es un error que bloquee el resto
        // del formulario.
      });
  }, []);

  return enabled;
}
