import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        {children}
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-ink-3 hover:text-ink">
            ← Back to the store
          </Link>
        </p>
      </div>
    </div>
  );
}
