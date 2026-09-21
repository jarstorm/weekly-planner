-- checkins.audio_path: path en el bucket privado "checkin-audio" de Supabase
-- Storage, si el checkin vino por nota de voz (sección 0.7 de
-- docs/especificaciones-tecnicas.md).
alter table checkins add column if not exists audio_path text;
