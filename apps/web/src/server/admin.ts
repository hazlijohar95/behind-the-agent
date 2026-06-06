import {
  accessLevels,
  categoryRepo,
  commentRepo,
  commentStatuses,
  planIntervals,
  planRepo,
  settingsRepo,
  settingsSchema,
  tagRepo,
  videoRepo,
  visibilities,
} from "@btc/db";
import { deleteVideo as deleteStreamVideo } from "@btc/stream";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { countAdmins, setUserBanned, setUserRole } from "@/lib/users";

/* ───────────────────────── Videos ───────────────────────── */

const saveVideoInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(20_000),
  categoryId: z.string().min(1).nullable(),
  tags: z.array(z.string().min(1).max(80)).max(50),
  access: z.enum(accessLevels),
  visibility: z.enum(visibilities),
  thumbnailTime: z.number().nonnegative().nullable(),
  intent: z.enum(["save", "publish", "unpublish", "schedule"]),
  publishAt: z.number().int().nullable().optional(),
});

export type SaveVideoInput = z.infer<typeof saveVideoInput>;

export const saveVideoAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveVideoInput.parse(input))
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
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const video = await videoRepo.deleteVideo(data.id);
    if (video?.streamUid) await deleteStreamVideo(video.streamUid);
    return { ok: true };
  });

/* ───────────────────────── Categories ───────────────────────── */

export const createCategoryAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(2_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    await requireAdmin();
    await categoryRepo.createCategory({
      name: input.name,
      description: input.description,
    });
    return { ok: true };
  });

export const updateCategoryAction = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        input: z.object({
          name: z.string().min(1).max(120).optional(),
          description: z.string().max(2_000).optional(),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data: { id, input } }) => {
    await requireAdmin();
    await categoryRepo.updateCategory(id, input);
    return { ok: true };
  });

export const deleteCategoryAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await categoryRepo.deleteCategory(data.id);
    return { ok: true };
  });

/* ───────────────────────── Comments ───────────────────────── */

export const setCommentStatusAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().min(1), status: z.enum(commentStatuses) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await commentRepo.setCommentStatus(data.id, data.status);
    return { ok: true };
  });

export const deleteCommentAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await commentRepo.deleteComment(data.id);
    return { ok: true };
  });

/* ───────────────────────── Settings ───────────────────────── */

export const updateSettingsAction = createServerFn({ method: "POST" })
  .inputValidator((patch: unknown) => settingsSchema.partial().parse(patch))
  .handler(async ({ data: patch }) => {
    await requireAdmin();
    await settingsRepo.updateSettings(patch);
    return { ok: true };
  });

/* ───────────────────────── Users ───────────────────────── */

export const setUserRoleAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ userId: z.string().min(1), role: z.enum(["admin", "user"]) })
      .parse(input),
  )
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
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(2_000).optional(),
        polarProductId: z.string().min(1),
        interval: z.enum(planIntervals),
        amount: z.number().int().nonnegative(),
        currency: z.string().min(1).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    await requireAdmin();
    await planRepo.createPlan(input);
    return { ok: true };
  });

export const deletePlanAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    await planRepo.deletePlan(data.id);
    return { ok: true };
  });

export const banUserAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().min(1), ban: z.boolean() }).parse(input),
  )
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
