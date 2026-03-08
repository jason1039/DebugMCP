import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CodeBackground } from "../components/CodeBackground";
import { GlowText } from "../components/GlowText";

const { fontFamily } = loadFont("normal", {
weights: ["400", "700", "900"],
subsets: ["latin"],
});

const LANGUAGES = [
{ name: "Python", color: "#3776AB" },
{ name: "JavaScript", color: "#F7DF1E" },
{ name: "TypeScript", color: "#3178C6" },
{ name: "Java", color: "#ED8B00" },
{ name: "C#", color: "#512BD4" },
{ name: "Go", color: "#00ADD8" },
{ name: "C/C++", color: "#00599C" },
{ name: "Rust", color: "#CE422B" },
{ name: "Ruby", color: "#CC342D" },
];

export const LanguagesScene: React.FC = () => {
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

// Title
const titleSpring = spring({
frame,
fps,
config: { damping: 200 },
});
const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

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
{/* Title */}
<div style={{ opacity: titleOpacity, marginBottom: 60 }}>
<GlowText fontSize={72} fontWeight={900}>
Works Everywhere
</GlowText>
</div>

{/* Language badges */}
<div
style={{
display: "flex",
flexWrap: "wrap",
gap: 24,
justifyContent: "center",
maxWidth: 1300,
}}
>
{LANGUAGES.map((lang, i) => {
const badgeSpring = spring({
frame,
fps,
delay: 5 + i * 3,
config: { damping: 12, stiffness: 200 },
});
const scale = interpolate(badgeSpring, [0, 1], [0, 1]);
const opacity = interpolate(badgeSpring, [0, 1], [0, 1]);

return (
<div
key={i}
style={{
transform: `scale(${scale})`,
opacity,
padding: "18px 36px",
borderRadius: 12,
backgroundColor: `${lang.color}20`,
border: `2px solid ${lang.color}60`,
fontSize: 32,
fontWeight: 700,
color: lang.color,
letterSpacing: "-0.01em",
}}
>
{lang.name}
</div>
);
})}
</div>

{/* Count label */}
<div
style={{
marginTop: 50,
opacity: interpolate(
spring({ frame, fps, delay: 35, config: { damping: 200 } }),
[0, 1],
[0, 1]
),
fontSize: 36,
color: "#7EE787",
fontWeight: 700,
textShadow: "0 0 20px rgba(126, 231, 135, 0.3)",
}}
>
Any Language (via DAP) • Any Agent
</div>
</AbsoluteFill>
</AbsoluteFill>
);
};