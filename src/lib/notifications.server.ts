import { AccessRequestRecord } from "./accessRequests.server";

type NotificationChannel = "webhook" | "email";

type NotificationAttempt = {
  channel: NotificationChannel;
  status: "fulfilled" | "rejected";
  detail?: string;
};

async function postJson(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Notification request failed: ${response.status} ${response.statusText}`);
  }
}

async function sendWebhook(record: AccessRequestRecord): Promise<void> {
  const url = process.env.ACCESS_REQUEST_WEBHOOK_URL;
  if (!url) return;

  await postJson(url, {
    type: "access-request",
    record,
  });
}

async function sendEmail(record: AccessRequestRecord): Promise<void> {
  const url = process.env.ACCESS_REQUEST_EMAIL_ENDPOINT;
  if (!url) {
    const recipient = process.env.ACCESS_REQUEST_NOTIFICATION_EMAIL;
    if (recipient) {
      console.info(`Access request for ${recipient}:`, record);
    }
    return;
  }

  await postJson(url, {
    template: "access-request",
    to: process.env.ACCESS_REQUEST_NOTIFICATION_EMAIL,
    payload: record,
  });
}

export async function sendAccessRequestNotifications(record: AccessRequestRecord): Promise<NotificationAttempt[]> {
  const attempts: NotificationAttempt[] = [];
  const tasks: [NotificationChannel, Promise<void>][] = [
    ["webhook", sendWebhook(record)],
    ["email", sendEmail(record)],
  ];

  const settled = await Promise.allSettled(tasks.map(([, task]) => task));

  settled.forEach((result, index) => {
    const channel = tasks[index][0];
    if (result.status === "fulfilled") {
      attempts.push({ channel, status: "fulfilled" });
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      attempts.push({ channel, status: "rejected", detail: message });
      console.error(`Failed to send ${channel} notification`, result.reason);
    }
  });

  return attempts.filter((attempt) => attempt.status === "fulfilled");
}
