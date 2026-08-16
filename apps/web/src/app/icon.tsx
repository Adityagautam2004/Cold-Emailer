import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Same three-dot ramp as components/logo.tsx, positioned by percentage so the exact same
// layout scales cleanly to apple-icon.tsx's larger canvas without recomputing anything.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1c1f24",
          borderRadius: "25%",
          position: "relative",
          display: "flex",
        }}
      >
        <div style={{ position: "absolute", left: "24.22%", top: "61.72%", width: "14.06%", height: "14.06%", borderRadius: "50%", background: "#8b9199" }} />
        <div style={{ position: "absolute", left: "44.53%", top: "38.28%", width: "20.31%", height: "20.31%", borderRadius: "50%", background: "#e8e6e1" }} />
        <div style={{ position: "absolute", left: "64.85%", top: "11.72%", width: "26.56%", height: "26.56%", borderRadius: "50%", background: "#4f5bd5" }} />
      </div>
    ),
    { ...size }
  );
}
