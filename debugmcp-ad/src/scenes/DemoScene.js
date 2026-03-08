"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoScene = void 0;
const remotion_1 = require("remotion");
const media_1 = require("@remotion/media");
const Inter_1 = require("@remotion/google-fonts/Inter");
const { fontFamily } = (0, Inter_1.loadFont)("normal", {
    weights: ["400", "700"],
    subsets: ["latin"],
});
const DemoScene = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Video frame entrance
    const frameSpring = (0, remotion_1.spring)({
        frame,
        fps,
        config: { damping: 200 },
    });
    const frameScale = (0, remotion_1.interpolate)(frameSpring, [0, 1], [0.9, 1]);
    const frameOpacity = (0, remotion_1.interpolate)(frameSpring, [0, 1], [0, 1]);
    // Label entrance
    const labelSpring = (0, remotion_1.spring)({
        frame,
        fps,
        delay: 10,
        config: { damping: 200 },
    });
    const labelOpacity = (0, remotion_1.interpolate)(labelSpring, [0, 1], [0, 1]);
    const labelY = (0, remotion_1.interpolate)(labelSpring, [0, 1], [-20, 0]);
    return (<remotion_1.AbsoluteFill style={{ backgroundColor: "#0D1117" }}>
    <remotion_1.AbsoluteFill style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily,
        }}>
    {/* Label at top */}
    <div style={{
            position: "absolute",
            top: 6,
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            fontSize: 38,
            color: "#7EE787",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textShadow: "0 0 20px rgba(126, 231, 135, 0.4)",
            zIndex: 10,
        }}>
✨ See it in action
    </div>

    {/* Video container - MUCH LARGER, nearly full screen */}
    <div style={{
            opacity: frameOpacity,
            transform: `scale(${frameScale})`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 0 80px rgba(88, 166, 255, 0.15), 0 20px 60px rgba(0,0,0,0.5)",
            border: "2px solid rgba(88, 166, 255, 0.2)",
        }}>
    {/* Window chrome bar */}
    <div style={{
            height: 32,
            backgroundColor: "#161B22",
            display: "flex",
            alignItems: "center",
            paddingLeft: 14,
            gap: 7,
            borderBottom: "1px solid rgba(88, 166, 255, 0.15)",
        }}>
    <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#F85149" }}/>
    <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#D29922" }}/>
    <div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#7EE787" }}/>
    <span style={{
            marginLeft: 10,
            fontSize: 16,
            color: "#8B949E",
            fontFamily: "monospace",
        }}>
VS Code — DebugMCP
    </span>
    </div>

    {/* The actual demo video - MUCH LARGER */}
    <media_1.Video src={(0, remotion_1.staticFile)("DebugMCP.mp4")} muted style={{
            width: 1760,
            height: 990,
            objectFit: "cover",
        }}/>
    </div>

    {/* Bottom label */}
    <div style={{
            position: "absolute",
            bottom: 20,
            opacity: (0, remotion_1.interpolate)(frame, [fps * 2, fps * 3], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
            }),
            fontSize: 28,
            color: "#8B949E",
            fontWeight: 400,
            fontFamily,
            zIndex: 10,
        }}>
AI agent debugging your code in real-time
    </div>
    </remotion_1.AbsoluteFill>
    </remotion_1.AbsoluteFill>);
};
exports.DemoScene = DemoScene;
//# sourceMappingURL=DemoScene.js.map