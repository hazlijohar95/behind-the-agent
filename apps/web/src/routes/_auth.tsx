import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BrandWordmark } from "@/components/home/landing";

const ROCK_IMAGE =
  "https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?auto=format&fit=crop&w=1400&q=80";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: dark rock imagery (hidden on small screens) */}
      <div className="relative hidden overflow-hidden bg-black lg:block">
        <img
          src={ROCK_IMAGE}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/40" />
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-btc-bg px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandWordmark className="text-[22px]" />
          </div>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
