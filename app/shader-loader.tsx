"use client";

import { useEffect } from "react";

export default function ShaderLoader() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/home-shader.js?v=20261014-slow-gradient-reveal";
    script.async = true;
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  return null;
}
