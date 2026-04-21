"use client";

import { useEffect } from "react";

export default function DevOverlayInit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let disposed = false;

    void import("react-furry-error")
      .then((module) => {
        if (disposed) return;
        module.initFurryDevOverlay();
      })
      .catch((error) => {
        console.error("Failed to initialize react-furry-error overlay", error);
      });

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
