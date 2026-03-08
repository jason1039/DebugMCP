import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CodeBackground } from "../components/CodeBackground";
import { GlowText } from "../components/GlowText";

const { fontFamily } = loadFont("normal", {
weights: ["400", "700", "900"],
subsets: ["latin"],
});

export const IntroScene: React.FC = () => {
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Logo entrance - bouncy spring
const logoSpring = spring({
frame,
fps,
config: { damping: 8, stiffness: 120 },
});
const logoScale = interpolate(logoSpring, [0, 1], [0, 1]);
const logoRotation = interpolate(logoSpring, [0, 1], [-180, 0]);

// Title entrance
const titleSpring = spring({
frame,
fps,
delay: 8,
config: { damping: 200 },
});
const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
const titleY = interpolate(titleSpring, [0, 1], [40, 0]);

// Subtitle entrance
const subtitleSpring = spring({
frame,
fps,
delay: 18,
config: { damping: 200 },
});
const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);
const subtitleY = interpolate(subtitleSpring, [0, 1], [30, 0]);

// Glow pulse on logo
const glowIntensity = interpolate(
Math.sin(frame * 0.08),
[-1, 1],
[0.3, 0.7]
);

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
{/* Logo */}
<div
style={{
transform: `scale(${logoScale}) rotate(${logoRotation}deg)`,
marginBottom: 30,
filter: `drop-shadow(0 0 ${30 * glowIntensity}px rgba(88, 166, 255, ${glowIntensity}))`,
}}
>
<Img
src={staticFile("debug_mcp_icon.png")}
style={{
width: 200,
height: 200,
borderRadius: 40,
}}
/>
</div>

{/* Title */}
<div
style={{
opacity: titleOpacity,
transform: `translateY(${titleY}px)`,
}}
>
<GlowText fontSize={120} fontWeight={900}>
DebugMCP
</GlowText>
</div>

{/* Subtitle */}
<div
style={{
opacity: subtitleOpacity,
transform: `translateY(${subtitleY}px)`,
marginTop: 16,
fontSize: 38,
color: "#8B949E",
fontWeight: 400,
letterSpacing: "0.02em",
}}
>
An MCP server that lets your AI agent debug like a pro developer
</div>

{/* Decorative line */}
<div
style={{
marginTop: 30,
width: interpolate(subtitleSpring, [0, 1], [0, 300]),
height: 2,
background: "linear-gradient(90deg, transparent, #58A6FF, transparent)",
opacity: subtitleOpacity,
}}
/>
</AbsoluteFill>
</AbsoluteFill>
);
};