import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CodeBackground } from "../components/CodeBackground";

const { fontFamily } = loadFont("normal", {
weights: ["400", "700", "900"],
subsets: ["latin"],
});

export const BetterWayScene: React.FC = () => {
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const textSpring = spring({
frame,
fps,
config: { damping: 12, stiffness: 100 },
});
const textScale = interpolate(textSpring, [0, 1], [0.7, 1]);
const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

return (
<AbsoluteFill>
<CodeBackground />
<AbsoluteFill
style={{
justifyContent: "center",
alignItems: "center",
fontFamily,
}}
>
<div
style={{
opacity: textOpacity,
transform: `scale(${textScale})`,
fontSize: 64,
color: "#F85149",
fontWeight: 900,
textAlign: "center",
lineHeight: 1.4,
textShadow: "0 0 40px rgba(248, 81, 73, 0.4)",
letterSpacing: "-0.02em",
}}
>
Adding print() everywhere?
<br />
<span style={{ color: "#7EE787", textShadow: "0 0 40px rgba(126, 231, 135, 0.4)" }}>
There's a better way.
</span>
</div>
</AbsoluteFill>
</AbsoluteFill>
);
};