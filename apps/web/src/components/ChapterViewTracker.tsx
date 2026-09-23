"use client";

import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/api-client";

const SESSION_STORAGE_KEY = "ch_reader_session";
const MAX_DURATION_SEC = 3600; // generous cap; the qualification thresholds (packages/revenue) only need a few seconds/minutes

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    // Private browsing / storage disabled — a per-mount id still lets this one event count.
    return crypto.randomUUID();
  }
}

/**
 * Reports one CONTENT_VIEW event per chapter read (docs/REVENUE.md #36-37:
 * Browser -> API collector -> Queue -> Worker -> ContentView). Fired on
 * unload/tab-hide rather than on mount so `duration`/`scrollDepth` reflect
 * actual reading, not just "the page loaded" — those are exactly what the
 * RAW->VALID->QUALIFIED pipeline thresholds on. Uses sendBeacon so it never
 * blocks or gets cancelled by navigation.
 */
export function ChapterViewTracker({ contentId, contentPartId }: { contentId: string; contentPartId: string }) {
  const startRef = useRef(0);
  const maxScrollRef = useRef(0);
  const sentRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    maxScrollRef.current = 0;
    sentRef.current = false;

    function trackScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const depth = scrollable > 0 ? window.scrollY / scrollable : 1;
      maxScrollRef.current = Math.max(maxScrollRef.current, Math.min(1, Math.max(0, depth)));
    }

    function send() {
      if (sentRef.current) return;
      sentRef.current = true;

      const payload = {
        contentId,
        contentPartId,
        sessionId: getOrCreateSessionId(),
        event: "CONTENT_VIEW",
        timestamp: new Date().toISOString(),
        duration: Math.min(MAX_DURATION_SEC, (Date.now() - startRef.current) / 1000),
        scrollDepth: maxScrollRef.current,
      };

      const url = `${API_URL}/api/v1/events/view`;
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      if (!navigator.sendBeacon(url, blob)) {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) send();
    }

    window.addEventListener("scroll", trackScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", send);

    return () => {
      window.removeEventListener("scroll", trackScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [contentId, contentPartId]);

  return null;
}
