"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntroScene = void 0;
const remotion_1 = require("remotion");
const Inter_1 = require("@remotion/google-fonts/Inter");
const CodeBackground_1 = require("../components/CodeBackground");
const GlowText_1 = require("../components/GlowText");
const { fontFamily } = (0, Inter_1.loadFont)("normal", {
    weights: ["400", "700", "900"],
    subsets: ["latin"],
});
const IntroScene = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Logo entrance - bouncy spring
    const logoSpring = (0, remotion_1.spring)({
        frame,
        fps,
        config: { damping: 8, stiffness: 120 },
    });
    const logoScale = (0, remotion_1.interpolate)(logoSpring, [0, 1], [0, 1]);
    const logoRotation = (0, remotion_1.interpolate)(logoSpring, [0, 1], [-180, 0]);
    // Title entrance
    const titleSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 8,
        config: { damping: 200 },
    });
    const titleOpacity = (0, remotion_1.interpolate)(titleSpring, [0, 1], [0, 1]);
    const titleY = (0, remotion_1.interpolate)(titleSpring, [0, 1], [40, 0]);
    // Subtitle entrance
    const subtitleSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 18,
        config: { damping: 200 },
    });
    const subtitleOpacity = (0, remotion_1.interpolate)(subtitleSpring, [0, 1], [0, 1]);
    const subtitleY = (0, remotion_1.interpolate)(subtitleSpring, [0, 1], [30, 0]);
    // Glow pulse on logo
    const glowIntensity = (0, remotion_1.interpolate)(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.7]);
    return (<remotion_1.AbsoluteFill>
    <CodeBackground_1.CodeBackground />
    <remotion_1.AbsoluteFill style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily,
        }}>
    {/* Logo */}
    <div style={{
            transform: `scale(${logoScale}) rotate(${logoRotation}deg)`,
            marginBottom: 30,
            filter: `drop-shadow(0 0 ${30 * glowIntensity}px rgba(88, 166, 255, ${glowIntensity}))`,
        }}>
    <remotion_1.Img src={(0, remotion_1.staticFile)("debug_mcp_icon.png")} style={{
            width: 200,
            height: 200,
            borderRadius: 40,
        }}/>
    </div>

    {/* Title */}
    <div style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
        }}>
    <GlowText_1.GlowText fontSize={120} fontWeight={900}>
DebugMCP
    </GlowText_1.GlowText>
    </div>

    {/* Subtitle */}
    <div style={{
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            marginTop: 16,
            fontSize: 38,
            color: "#8B949E",
            fontWeight: 400,
            letterSpacing: "0.02em",
        }}>
An MCP server that lets your AI agent debug like a pro developer
    </div>

    {/* Decorative line */}
    <div style={{
            marginTop: 30,
            width: (0, remotion_1.interpolate)(subtitleSpring, [0, 1], [0, 300]),
            height: 2,
            background: "linear-gradient(90deg, transparent, #58A6FF, transparent)",
            opacity: subtitleOpacity,
        }}/>
    </remotion_1.AbsoluteFill>
    </remotion_1.AbsoluteFill>);
};
exports.IntroScene = IntroScene;
//# sourceMappingURL=IntroScene.js.map