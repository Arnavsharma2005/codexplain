"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AlertTriangle } from "lucide-react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        {children}
        <Toaster
          position="bottom-center"
          offset={{ bottom: "calc(var(--toast-bottom, 14px) + env(safe-area-inset-bottom))" }}
          mobileOffset={{ bottom: "calc(var(--toast-bottom, 12px) + env(safe-area-inset-bottom))" }}
          closeButton
          icons={{ success: null, info: null, error: <AlertTriangle className="size-4" aria-hidden />, warning: <AlertTriangle className="size-4" aria-hidden /> }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: "cx-toast on-plate",
              title: "cx-toast-title",
              description: "cx-toast-desc",
              actionButton: "cx-toast-action",
              closeButton: "cx-toast-close",
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
