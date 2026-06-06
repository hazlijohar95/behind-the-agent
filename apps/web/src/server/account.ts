import { profileRepo } from "@btc/db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/session";

const updateDisplayNameInput = z.object({ name: z.string().max(120) });

export const updateDisplayNameAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateDisplayNameInput.parse(input))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const trimmed = data.name.trim();
    if (!trimmed) return { ok: false, error: "Name can't be empty" };

    await profileRepo.setName(user.id, trimmed);
    return { ok: true };
  });
