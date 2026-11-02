import * as cron from 'node-cron';
import nodeSchedule from 'node-schedule';
import * as service from './service';
import type { ScheduledTask } from './types';

const cronJobs = new Map<string, cron.ScheduledTask>();
const onceJobs = new Map<string, nodeSchedule.Job>();

export function startEngine(): void {
  const tasks = service.listTasks();
  let cronCount = 0;
  let onceCount = 0;

  for (const task of tasks) {
    if (!task.enabled) continue;

    if (task.scheduled_at) {
      const scheduledDate = new Date(task.scheduled_at);
      if (scheduledDate > new Date()) {
        registerOnceJob(task);
        onceCount++;
      }
    } else if (task.cron_expression) {
      registerJob(task);
      cronCount++;
    }
  }

  console.log(`Scheduler: ${cronCount} cron + ${onceCount} one-shot task(s) registered`);
}

export function registerJob(task: ScheduledTask): void {
  cancelJob(task.id);

  if (!task.cron_expression || !cron.validate(task.cron_expression)) {
    return;
  }

  const job = cron.schedule(task.cron_expression, () => {
    const current = service.getTask(task.id);
    if (!current || !current.enabled) return;
    service.executeTask(current);
  });

  cronJobs.set(task.id, job);
}

export function registerOnceJob(task: ScheduledTask): void {
  cancelJob(task.id);

  if (!task.scheduled_at) return;

  const scheduledDate = new Date(task.scheduled_at);
  if (scheduledDate <= new Date()) return;

  const job = nodeSchedule.scheduleJob(scheduledDate, () => {
    const current = service.getTask(task.id);
    if (!current || !current.enabled) return;
    service.executeTask(current);
    service.updateTask(task.id, { enabled: false });
    onceJobs.delete(task.id);
  });

  if (job) {
    onceJobs.set(task.id, job);
  }
}

export function cancelJob(taskId: string): void {
  const cronJob = cronJobs.get(taskId);
  if (cronJob) {
    cronJob.stop();
    cronJobs.delete(taskId);
  }

  const onceJob = onceJobs.get(taskId);
  if (onceJob) {
    onceJob.cancel();
    onceJobs.delete(taskId);
  }
}

export function stopEngine(): void {
  for (const [, job] of cronJobs) {
    job.stop();
  }
  cronJobs.clear();

  for (const [, job] of onceJobs) {
    job.cancel();
  }
  onceJobs.clear();
}
