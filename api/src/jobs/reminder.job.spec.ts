import { TeamsService } from '../teams/teams.service';
import { ChannelsService } from '../channels/channels.service';
import { WhatsappChannel } from '../channels/whatsapp.channel';
import { CheckinFormService } from '../checkin-form/checkin-form.service';
import { ReminderJob } from './reminder.job';

// Lunes 2026-01-05 10:00 UTC — mismo fixture que report.job.spec.ts.
const NOW = new Date('2026-01-05T10:00:00Z');

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

function baseTeam(overrides: Record<string, any> = {}) {
  return {
    id: 'team-1',
    name: 'Producto',
    language: 'es',
    timezone: 'UTC',
    reminder_dow: 1,
    reminder_time: '10:00:00',
    cutoff_time: '13:00:00',
    ...overrides,
  };
}

function fakeTeams(allTeams: any[], membersByTeam: Record<string, any[]> = {}): TeamsService {
  return {
    listAll: jest.fn().mockResolvedValue(allTeams),
    listMembers: jest.fn((teamId: string) => Promise.resolve(membersByTeam[teamId] ?? [])),
  } as unknown as TeamsService;
}

function fakeChannels() {
  const generic = { send: jest.fn().mockResolvedValue(undefined), sendDocument: jest.fn() };
  const channels = { get: jest.fn(() => generic) } as unknown as ChannelsService;
  return { channels, generic };
}

function fakeWhatsapp(): { whatsapp: WhatsappChannel; sendTemplate: jest.Mock } {
  const sendTemplate = jest.fn().mockResolvedValue(undefined);
  return { whatsapp: { sendTemplate } as unknown as WhatsappChannel, sendTemplate };
}

function fakeCheckinForm(): CheckinFormService {
  return { buildLink: jest.fn(() => 'https://weeklyfeedback.com/checkin/tok') } as unknown as CheckinFormService;
}

describe('ReminderJob', () => {
  it('ignora equipos fuera de su día/hora de recordatorio', async () => {
    const team = baseTeam({ reminder_dow: 3 }); // hoy es lunes (1)
    const teams = fakeTeams([team], { 'team-1': [{ id: 'm-1', name: 'Ana', channel: 'email', contact: 'ana@example.com' }] });
    const { channels, generic } = fakeChannels();
    const { whatsapp, sendTemplate } = fakeWhatsapp();
    const job = new ReminderJob(teams, channels, whatsapp, fakeCheckinForm());

    await job.run();

    expect(teams.listMembers).not.toHaveBeenCalled();
    expect(generic.send).not.toHaveBeenCalled();
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('salta miembros sin contact todavía (Telegram sin vincular)', async () => {
    const team = baseTeam();
    const teams = fakeTeams([team], { 'team-1': [{ id: 'm-1', name: 'Ana', channel: 'telegram', contact: null }] });
    const { channels, generic } = fakeChannels();
    const { whatsapp, sendTemplate } = fakeWhatsapp();
    const job = new ReminderJob(teams, channels, whatsapp, fakeCheckinForm());

    await job.run();

    expect(generic.send).not.toHaveBeenCalled();
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('manda el recordatorio con link de checkin a miembros de email/telegram', async () => {
    const team = baseTeam();
    const teams = fakeTeams([team], {
      'team-1': [{ id: 'm-1', name: 'Ana', channel: 'email', contact: 'ana@example.com' }],
    });
    const { channels, generic } = fakeChannels();
    const checkinForm = fakeCheckinForm();
    const { whatsapp, sendTemplate } = fakeWhatsapp();
    const job = new ReminderJob(teams, channels, whatsapp, checkinForm);

    await job.run();

    expect(checkinForm.buildLink).toHaveBeenCalledWith('m-1', '2026-01-05', 'es');
    expect(generic.send).toHaveBeenCalledWith('ana@example.com', expect.stringContaining('https://weeklyfeedback.com/checkin/tok'));
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('manda la plantilla aprobada de Meta (no texto libre) a miembros de WhatsApp', async () => {
    const team = baseTeam({ name: 'Ventas', cutoff_time: '13:30:00' });
    const teams = fakeTeams([team], {
      'team-1': [{ id: 'm-2', name: 'Bruno', channel: 'whatsapp', contact: '+34600000000' }],
    });
    const { channels, generic } = fakeChannels();
    const { whatsapp, sendTemplate } = fakeWhatsapp();
    const job = new ReminderJob(teams, channels, whatsapp, fakeCheckinForm());

    await job.run();

    expect(sendTemplate).toHaveBeenCalledWith('+34600000000', 'weekly_reminder_v5', 'es', ['Bruno', 'Ventas', '13:30']);
    expect(generic.send).not.toHaveBeenCalled();
  });

  it('un fallo mandando a un miembro no interrumpe el resto del equipo ni de otros equipos', async () => {
    const team = baseTeam();
    const teams = fakeTeams([team], {
      'team-1': [
        { id: 'm-1', name: 'Ana', channel: 'email', contact: 'ana@example.com' },
        { id: 'm-2', name: 'Bruno', channel: 'email', contact: 'bruno@example.com' },
      ],
    });
    const send = jest.fn().mockRejectedValueOnce(new Error('SMTP down')).mockResolvedValueOnce(undefined);
    const channels = { get: jest.fn(() => ({ send, sendDocument: jest.fn() })) } as unknown as ChannelsService;
    const { whatsapp } = fakeWhatsapp();
    const job = new ReminderJob(teams, channels, whatsapp, fakeCheckinForm());

    await expect(job.run()).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
  });
});
