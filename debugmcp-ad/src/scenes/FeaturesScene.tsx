import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CodeBackground } from "../components/CodeBackground";
import { FeatureCard } from "../components/FeatureCard";
import { GlowText } from "../components/GlowText";

const { fontFamily } = loadFont("normal", {
weights: ["400", "700", "900"],
subsets: ["latin"],
});

const FEATURES = [
{ emoji: "🔴", title: "Set Breakpoints" },
{ emoji: "🔍", title: "Inspect Variables" },
{ emoji: "▶️", title: "Step Through Code" },
{ emoji: "🐛", title: "Root Cause Analysis" },
{ emoji: "📊", title: "Evaluate Expressions" },
{ emoji: "🔄", title: "Config Generation" },
];

export const FeaturesScene: React.FC = () => {
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Title entrance
const titleSpring = spring({
frame,
fps,
config: { damping: 200 },
});
const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

return (
<AbsoluteFill>
<CodeBackground />
<AbsoluteFill
style={{
justifyContent: "center",
alignItems: "center",
fontFamily,
padding: 80,
}}
>
{/* Section title */}
<div
style={{
opacity: titleOpacity,
transform: `translateY(${titleY}px)`,
marginBottom: 50,
}}
>
<GlowText fontSize={72} glowColor="#7EE787" fontWeight={900}>
🔧 Powerful Tools
</GlowText>
</div>

{/* Feature cards grid - 2 columns */}
<div
style={{
display: "flex",
flexWrap: "wrap",
gap: 30,
justifyContent: "center",
maxWidth: 1200,
}}
>
{FEATURES.map((feature, i) => (
<div key={i} style={{ width: "calc(50% - 15px)" }}>
<FeatureCard
emoji={feature.emoji}
title={feature.title}
delay={8 + i * 5}
/>
</div>
))}
</div>
</AbsoluteFill>
</AbsoluteFill>
);
};