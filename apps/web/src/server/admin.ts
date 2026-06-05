import {
  type AccessLevel,
  type CommentStatus,
  categoryRepo,
  commentRepo,
  type PlanInterval,
  planRepo,
  type Settings,
  settingsRepo,
  tagRepo,
  type Visibility,
  videoRepo,
} from "@btc/db";
import { deleteAsset } from "@btc/mux";
import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/session";
import { countAdmins, setUserBanned, setUserRole } from "@/lib/users";

/* ───────────────────────── Videos ───────────────────────── */

export type SaveVideoInput = {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  access: AccessLevel;
  visibility: Visibility;
  thumbnailTime: number | null;
  intent: "save" | "publish" | "unpublish" | "schedule";
  publishAt?: number | null;
};

export const saveVideoAction = createServerFn({ method: "POST" })
  .inputValidator((input: SaveVideoInput) => input)
  .handler(async ({ data: input }) => {
    await requireAdmin();
    if (input.tags.length) await tagRepo.ensureTags(input.tags);

    const playbackPolicy = input.access === "free" ? "public" : "signed";

    await videoRepo.updateVideo(input.id, {
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      tags: input.tags,
      access: input.access,
      visibility: input.visibility,
      thumbnailTime: input.thumbnailTime,
      playbackPolicy,
    });

    const video = await videoRepo.getVideo(input.id);
    if (!video) return { ok: false, error: "Video not found" };

    if (input.intent === "publish") await videoRepo.publishVideo(input.id);
    else if (input.intent === "unpublish")
      await videoRepo.unpublishVideo(input.id);
    else if (input.intent === "schedule" && input.publishAt) {
      await videoRepo.scheduleVideo(input.id, input.publishAt);
    }

    return { ok: true };
  });

export const deleteVideoAction = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const video = await videoRepo.deleteVideo(data.id);
    if (video?.muxAssetId) await deleteAsset(video.muxAssetId);
    return { ok: true };
  });

/* ───────────────────────── Categories ───────────────────────── */

export const createCategoryAction = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; description?: string }) => input)
  .handler(async ({ data: input }) => {
    await requireAdmin();
    await categoryRepo.createCategory({
      name: input.name,
      description: input.description,
    });
    return { ok: true };
  });

export const updateCategoryAction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id: string; input: { name?: string; description?: string } }) =>
      data,
  )
  .handler(async ({ data: { id, input } }) => {
    await requireAdmin();
    await categoryRepo.updateCategory(id, input);
    return { ok: true };
  });

export const deleteCategoryAction = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await categoryRepo.deleteCategory(data.id);
    return { ok: true };
  });

/* ───────────────────────── Comments ───────────────────────── */

export const setCommentStatusAction = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status: CommentStatus }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await commentRepo.setCommentStatus(data.id, data.status);
    return { ok: true };
  });

export const deleteCommentAction = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await commentRepo.deleteComment(data.id);
    return { ok: true };
  });

/* ───────────────────────── Settings ───────────────────────── */

export const updateSettingsAction = createServerFn({ method: "POST" })
  .inputValidator((patch: Partial<Settings>) => patch)
  .handler(async ({ data: patch }) => {
    await requireAdmin();
    await settingsRepo.updateSettings(patch);
    return { ok: true };
  });

/* ───────────────────────── Users ───────────────────────── */

export const setUserRoleAction = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; role: "admin" | "user" }) => input)
  .handler(async ({ data: { userId, role } }) => {
    const me = await requireAdmin();
    if (role === "user") {
      const admins = await countAdmins();
      if (admins <= 1)
        return { ok: false, error: "You can't remove the last admin." };
      if (userId === me.id)
        return {
          ok: false,
          error: "You can't demote yourself as the last admin.",
        };
    }
    try {
      await setUserRole(userId, role);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to update role",
      };
    }
    return { ok: true };
  });

/* ───────────────────────── Plans ───────────────────────── */

export const createPlanAction = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      name: string;
      description?: string;
      polarProductId: string;
      interval: PlanInterval;
      amount: number;
      currency: string;
    }) => input,
  )
  .handler(async ({ data: input }) => {
    await requireAdmin();
    await planRepo.createPlan(input);
    return { ok: true };
  });

export const deletePlanAction = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await planRepo.deletePlan(data.id);
    return { ok: true };
  });

export const banUserAction = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; ban: boolean }) => input)
  .handler(async ({ data: { userId, ban } }) => {
    const me = await requireAdmin();
    if (userId === me.id)
      return { ok: false, error: "You can't ban yourself." };
    try {
      await setUserBanned(userId, ban);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to update user",
      };
    }
    return { ok: true };
  });
