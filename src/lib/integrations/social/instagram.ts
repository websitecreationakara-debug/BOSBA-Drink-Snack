// Server-only: Instagram Graph API publish calls. Instagram has no OAuth
// connect flow of its own here — a connection is discovered as a side effect
// of the Facebook connect flow (see facebook.ts's facebookListPagesWithInstagram)
// and publishing reuses that linked Facebook Page's access token.
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type GraphError = { error?: { message?: string } };

async function graphGet(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const body = (await res.json()) as Record<string, unknown> & GraphError;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Instagram API error (${res.status})`);
  }
  return body;
}

async function graphPost(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const body = (await res.json()) as Record<string, unknown> & GraphError;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Instagram publish failed (${res.status})`);
  }
  return body;
}

const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 3000;

// A video (REELS) container needs a moment to process before it can be
// published; images are ready essentially immediately. Polls a bounded number
// of times rather than indefinitely so a stuck container fails fast with a
// clear "try again shortly" error instead of hanging the request.
async function waitUntilReady(containerId: string, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const res = await graphGet(`/${containerId}`, {
      fields: "status_code",
      access_token: accessToken,
    });
    const status = res.status_code;
    if (status === "FINISHED") return;
    if (status === "ERROR") throw new Error("Instagram failed to process this media");
    await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
  }
  throw new Error("Instagram is still processing this media — try again in a minute");
}

// Two-step publish: create a media container, then publish it. `mediaUrl`
// must be a fully-qualified, publicly fetchable HTTPS URL (see
// absoluteMediaUrl in shared.ts) — Instagram fetches it server-side.
export async function instagramPublish(
  igUserId: string,
  pageAccessToken: string,
  caption: string | null,
  mediaUrl: string | null,
  mediaType: "image" | "video",
): Promise<{ remoteId: string }> {
  if (!mediaUrl)
    throw new Error("Instagram requires an image or video — text-only posts aren't supported");

  const containerParams: Record<string, string> = { access_token: pageAccessToken };
  if (caption) containerParams.caption = caption;
  if (mediaType === "video") {
    containerParams.media_type = "REELS";
    containerParams.video_url = mediaUrl;
  } else {
    containerParams.image_url = mediaUrl;
  }

  const container = await graphPost(`/${igUserId}/media`, containerParams);
  const containerId = String(container.id ?? "");
  if (!containerId) throw new Error("Instagram did not return a media container id");

  if (mediaType === "video") await waitUntilReady(containerId, pageAccessToken);

  const published = await graphPost(`/${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: pageAccessToken,
  });
  const remoteId = String(published.id ?? "");
  if (!remoteId) throw new Error("Instagram did not return a published media id");
  return { remoteId };
}
