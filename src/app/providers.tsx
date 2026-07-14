"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { Toaster } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      const relevantEvents = [
        "SIGNED_IN",
        "SIGNED_OUT",
        "USER_UPDATED",
        "TOKEN_REFRESHED",
      ];

      if (!relevantEvents.includes(event)) {
        return;
      }

      /*
       * Refreshes Next.js Server Components and any auth-dependent
       * server-rendered content.
       */
      router.refresh();

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        return;
      }

      void queryClient.invalidateQueries();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      <Toaster
        richColors
        position="top-center"
        closeButton
      />
    </QueryClientProvider>
  );
}