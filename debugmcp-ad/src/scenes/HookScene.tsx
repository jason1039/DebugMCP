import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CodeBackground } from "../components/CodeBackground";

const { fontFamily } = loadFont("normal", {
weights: ["400", "700", "900"],
subsets: ["latin"],
});

export const HookScene: React.FC = () => {
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Phase 1: "AI agents write excellent code..." typewriter
const line1 = "AI agents write excellent code...";
const charsShown1 = Math.min(
Math.floor(interpolate(frame, [0, 1.5 * fps], [0, line1.length], {
extrapolateRight: "clamp",
extrapolateLeft: "clamp",
})),
line1.length
);

// Checkmark for line 1
const checkSpring = spring({
frame,
fps,
delay: 1.6 * fps,
config: { damping: 12, stiffness: 200 },
});

// Phase 2: "But debug it primitively"
const line2Delay = 2.2 * fps;
const line2Spring = spring({
frame,
fps,
delay: line2Delay,
config: { damping: 12, stiffness: 100 },
});
const line2Scale = interpolate(line2Spring, [0, 1], [0.5, 1]);
const line2Opacity = interpolate(line2Spring, [0, 1], [0, 1]);

// Red X animation
const xSpring = spring({
frame,
fps,
delay: 2 * fps,
config: { damping: 8 },
});

// Cursor blink
const cursorOpacity = frame < line2Delay
? Math.round(Math.sin(frame * 0.3) * 0.5 + 0.5)
: 0;

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
{/* Line 1 - "AI agents write excellent code..." */}
<div
style={{
display: "flex",
alignItems: "center",
gap: 16,
marginBottom: 30,
}}
>
<span
style={{
fontSize: 72,
color: "#7EE787",
opacity: checkSpring,
transform: `scale(${interpolate(checkSpring, [0, 1], [2, 1])})`,
}}
>
✓
</span>
<span
style={{
fontSize: 72,
color: "#F0F6FC",
fontWeight: 700,
letterSpacing: "-0.02em",
}}
>
{line1.slice(0, charsShown1)}
<span style={{ opacity: cursorOpacity, color: "#58A6FF" }}>▊</span>
</span>
</div>

{/* Line 2 - "But debug it primitively" */}
<div
style={{
display: "flex",
alignItems: "center",
gap: 16,
opacity: line2Opacity,
transform: `scale(${line2Scale})`,
}}
>
<span
style={{
fontSize: 54,
opacity: xSpring,
transform: `scale(${interpolate(xSpring, [0, 1], [3, 1])})`,
color: "#F85149",
}}
>
✕
</span>
<span
style={{
fontSize: 84,
fontWeight: 900,
color: "#F0F6FC",
letterSpacing: "-0.03em",
}}
>
But{" "}
<span
style={{
color: "#F85149",
textShadow: "0 0 30px rgba(248, 81, 73, 0.5)",
}}
>
debug
</span>
{" "}it primitively
</span>
</div>
</AbsoluteFill>
</AbsoluteFill>
);
};