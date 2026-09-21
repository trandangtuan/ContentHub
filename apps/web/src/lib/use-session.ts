"use client";

import { useEffect, useState } from "react";
import { api, type SessionInfo } from "./api-client";

export function useSession() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.getSession();
      setSession(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { session, loading, refresh };
}
