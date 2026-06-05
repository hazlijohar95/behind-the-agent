import { videoRepo } from "@btc/db";

/**
 * Publishes scheduled videos whose time has arrived.
 * Pure data loop — the HTTP/secret wrapper lives in the route handler.
 */
export async function runScheduledPublish(): Promise<{
  published: number;
  ids: string[];
}> {
  const dueIds = await videoRepo.getDueScheduled();
  const published: string[] = [];

  for (const id of dueIds) {
    const video = await videoRepo.publishVideo(id);
    if (video) published.push(video.id);
  }

  return { published: published.length, ids: published };
}
