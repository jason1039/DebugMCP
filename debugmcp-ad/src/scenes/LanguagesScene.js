"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguagesScene = void 0;
const remotion_1 = require("remotion");
const Inter_1 = require("@remotion/google-fonts/Inter");
const CodeBackground_1 = require("../components/CodeBackground");
const GlowText_1 = require("../components/GlowText");
const { fontFamily } = (0, Inter_1.loadFont)("normal", {
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
const LanguagesScene = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Title
    const titleSpring = (0, remotion_1.spring)({
        frame,
        fps,
        config: { damping: 200 },
    });
    const titleOpacity = (0, remotion_1.interpolate)(titleSpring, [0, 1], [0, 1]);
    return (<remotion_1.AbsoluteFill>
    <CodeBackground_1.CodeBackground />
    <remotion_1.AbsoluteFill style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily,
        }}>
    {/* Title */}
    <div style={{ opacity: titleOpacity, marginBottom: 60 }}>
    <GlowText_1.GlowText fontSize={72} fontWeight={900}>
Works Everywhere
    </GlowText_1.GlowText>
    </div>

    {/* Language badges */}
    <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            justifyContent: "center",
            maxWidth: 1300,
        }}>
        {LANGUAGES.map((lang, i) => {
            const badgeSpring = (0, remotion_1.spring)({
                frame,
                fps,
                delay: 5 + i * 3,
                config: { damping: 12, stiffness: 200 },
            });
            const scale = (0, remotion_1.interpolate)(badgeSpring, [0, 1], [0, 1]);
            const opacity = (0, remotion_1.interpolate)(badgeSpring, [0, 1], [0, 1]);
            return (<div key={i} style={{
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
                }}>
            {lang.name}
            </div>);
        })}
    </div>

    {/* Count label */}
    <div style={{
            marginTop: 50,
            opacity: (0, remotion_1.interpolate)((0, remotion_1.spring)({ frame, fps, delay: 35, config: { damping: 200 } }), [0, 1], [0, 1]),
            fontSize: 36,
            color: "#7EE787",
            fontWeight: 700,
            textShadow: "0 0 20px rgba(126, 231, 135, 0.3)",
        }}>
Any Language (via DAP) • Any Agent
    </div>
    </remotion_1.AbsoluteFill>
    </remotion_1.AbsoluteFill>);
};
exports.LanguagesScene = LanguagesScene;
//# sourceMappingURL=LanguagesScene.js.map