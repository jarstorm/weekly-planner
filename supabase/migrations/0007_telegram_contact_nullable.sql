-- Vinculación de Telegram pasa a ser automática por deep link (bot
-- /start <member_id>) en vez de que el admin teclee a mano el chat_id que
-- el miembro consigue de @userinfobot — ese paso manual era la causa de
-- altas mal vinculadas (typos) y checkins que llegaban al bot pero no se
-- guardaban por no matchear ningún member.contact.
-- contact queda NULL mientras el miembro de canal telegram no ha abierto
-- el bot todavía; para email sigue siendo obligatorio.
alter table members alter column contact drop not null;

alter table members add constraint members_contact_required_for_email
  check (channel <> 'email' or contact is not null);
