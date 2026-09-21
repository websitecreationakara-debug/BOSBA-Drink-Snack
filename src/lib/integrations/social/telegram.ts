// Server-only: Telegram Bot API publish call for the admin Social feature.
// The admin creates a bot via @BotFather, adds it as an admin of their
// channel, and pastes the bot token + channel id in
// src/routes/admin/social/connections.tsx -- no OAuth involved.
type TelegramResult = { ok: boolean; description?: string; result?: { message_id?: number } };

async function telegramCall(
  botToken: string,
  method: string,
  params: Record<string, string>,
): Promise<TelegramResult> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as TelegramResult;
  if (!res.ok || !json.ok) {
    throw new Error(json.description ?? `Telegram API error (${res.status})`);
  }
  return json;
}

export async function telegramPublish(
  botToken: string,
  channelId: string,
  caption: string,
  mediaUrl: string | null,
  mediaType: "image" | "video",
): Promise<{ remoteId: string }> {
  let json: TelegramResult;
  if (!mediaUrl) {
    json = await telegramCall(botToken, "sendMessage", { chat_id: channelId, text: caption });
  } else if (mediaType === "video") {
    json = await telegramCall(botToken, "sendVideo", {
      chat_id: channelId,
      video: mediaUrl,
      caption,
    });
  } else {
    json = await telegramCall(botToken, "sendPhoto", {
      chat_id: channelId,
      photo: mediaUrl,
      caption,
    });
  }
  const remoteId = json.result?.message_id;
  if (remoteId == null) throw new Error("Telegram did not return a message id");
  return { remoteId: String(remoteId) };
}
