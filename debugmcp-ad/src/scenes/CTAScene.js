"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTAScene = void 0;
const remotion_1 = require("remotion");
const Inter_1 = require("@remotion/google-fonts/Inter");
const CodeBackground_1 = require("../components/CodeBackground");
const GlowText_1 = require("../components/GlowText");
const { fontFamily } = (0, Inter_1.loadFont)("normal", {
    weights: ["400", "700", "900"],
    subsets: ["latin"],
});
// Microsoft logo as 4 colored squares
const MicrosoftLogo = ({ size = 40 }) => {
    const half = size / 2;
    const gap = size * 0.06;
    return (<div style={{
            display: "grid",
            gridTemplateColumns: `${half - gap}px ${half - gap}px`,
            gridTemplateRows: `${half - gap}px ${half - gap}px`,
            gap: gap * 2,
        }}>
    <div style={{ backgroundColor: "#F25022", borderRadius: 2 }}/>
    <div style={{ backgroundColor: "#7FBA00", borderRadius: 2 }}/>
    <div style={{ backgroundColor: "#00A4EF", borderRadius: 2 }}/>
    <div style={{ backgroundColor: "#FFB900", borderRadius: 2 }}/>
    </div>);
};
const CTAScene = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Logo entrance
    const logoSpring = (0, remotion_1.spring)({
        frame,
        fps,
        config: { damping: 12, stiffness: 100 },
    });
    const logoScale = (0, remotion_1.interpolate)(logoSpring, [0, 1], [0, 1]);
    // CTA text
    const ctaSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 10,
        config: { damping: 200 },
    });
    const ctaOpacity = (0, remotion_1.interpolate)(ctaSpring, [0, 1], [0, 1]);
    const ctaY = (0, remotion_1.interpolate)(ctaSpring, [0, 1], [30, 0]);
    // Install button
    const btnSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 18,
        config: { damping: 12, stiffness: 150 },
    });
    const btnScale = (0, remotion_1.interpolate)(btnSpring, [0, 1], [0.8, 1]);
    const btnOpacity = (0, remotion_1.interpolate)(btnSpring, [0, 1], [0, 1]);
    // GitHub link
    const ghSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 25,
        config: { damping: 200 },
    });
    const ghOpacity = (0, remotion_1.interpolate)(ghSpring, [0, 1], [0, 1]);
    // Microsoft logo entrance
    const msSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 32,
        config: { damping: 200 },
    });
    const msOpacity = (0, remotion_1.interpolate)(msSpring, [0, 1], [0, 1]);
    const msY = (0, remotion_1.interpolate)(msSpring, [0, 1], [20, 0]);
    // Pulse effect on button
    const pulse = (0, remotion_1.interpolate)(Math.sin(frame * 0.1), [-1, 1], [0.97, 1.03]);
    return (<remotion_1.AbsoluteFill>
    <CodeBackground_1.CodeBackground />
    <remotion_1.AbsoluteFill style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily,
        }}>
    {/* DebugMCP Logo */}
    <div style={{
            transform: `scale(${logoScale})`,
            marginBottom: 24,
            filter: "drop-shadow(0 0 40px rgba(88, 166, 255, 0.5))",
        }}>
    <remotion_1.Img src={(0, remotion_1.staticFile)("debug_mcp_icon.png")} style={{
            width: 140,
            height: 140,
            borderRadius: 28,
        }}/>
    </div>

    {/* Title */}
    <div style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            marginBottom: 14,
        }}>
    <GlowText_1.GlowText fontSize={88} fontWeight={900}>
DebugMCP
    </GlowText_1.GlowText>
    </div>

    {/* Tagline */}
    <div style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            fontSize: 34,
            color: "#8B949E",
            marginBottom: 40,
        }}>
Let your AI agent debug code for you
    </div>

    {/* Install Button */}
    <div style={{
            opacity: btnOpacity,
            transform: `scale(${btnScale * pulse})`,
            padding: "22px 52px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #58A6FF, #7EE787)",
            fontSize: 32,
            fontWeight: 800,
            color: "#0D1117",
            letterSpacing: "-0.01em",
            boxShadow: "0 0 40px rgba(88, 166, 255, 0.3), 0 10px 30px rgba(0,0,0,0.3)",
        }}>
⚡ Install from VS Code Marketplace
    </div>

    {/* GitHub */}
    <div style={{
            opacity: ghOpacity,
            marginTop: 24,
            fontSize: 28,
            color: "#58A6FF",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 10,
        }}>
    <span style={{ fontSize: 30 }}>⭐</span>
github.com/microsoft/DebugMCP
    </div>

    {/* Microsoft branding */}
    <div style={{
            opacity: msOpacity,
            transform: `translateY(${msY}px)`,
            marginTop: 40,
            display: "flex",
            alignItems: "center",
            gap: 14,
        }}>
    <MicrosoftLogo size={48}/>
    <span style={{
            fontSize: 30,
            color: "#F0F6FC",
            fontWeight: 600,
            letterSpacing: "0.02em",
        }}>
Microsoft
    </span>
    </div>

    {/* Open source badge */}
    <div style={{
            opacity: msOpacity,
            marginTop: 12,
            fontSize: 22,
            color: "#8B949E",
            fontWeight: 400,
        }}>
MIT Licensed • Open Source
    </div>
    </remotion_1.AbsoluteFill>
    </remotion_1.AbsoluteFill>);
};
exports.CTAScene = CTAScene;
//# sourceMappingURL=CTAScene.js.map