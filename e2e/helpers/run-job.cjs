// Ejecuta UNA vez un job de cron (ReminderJob/ReportJob/SurveyJob) contra el
// backend compilado, sin esperar al tick real. Uso, desde api/:
//   node ../e2e/helpers/run-job.cjs reminder|report|survey
const path = require('path');
const dist = path.resolve(__dirname, '..', '..', 'api', 'dist');
require(path.join(dist, '..', 'node_modules', 'reflect-metadata'));
const { NestFactory } = require(path.join(dist, '..', 'node_modules', '@nestjs', 'core'));
const { AppModule } = require(path.join(dist, 'app.module'));

const JOBS = {
  reminder: ['jobs/reminder.job', 'ReminderJob'],
  report: ['jobs/report.job', 'ReportJob'],
  survey: ['jobs/survey.job', 'SurveyJob'],
};

(async () => {
  const entry = JOBS[process.argv[2]];
  if (!entry) throw new Error('Uso: run-job.cjs reminder|report|survey');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const job = app.get(require(path.join(dist, entry[0]))[entry[1]]);
  await job.run();
  await app.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
