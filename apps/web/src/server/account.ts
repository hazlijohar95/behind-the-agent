import { profileRepo } from "@btc/db";
import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/session";

export const updateDisplayNameAction = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const trimmed = data.name.trim();
    if (!trimmed) return { ok: false, error: "Name can't be empty" };

    await profileRepo.setName(user.id, trimmed);
    return { ok: true };
  });
