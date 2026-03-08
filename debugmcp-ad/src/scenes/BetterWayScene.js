"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BetterWayScene = void 0;
const remotion_1 = require("remotion");
const Inter_1 = require("@remotion/google-fonts/Inter");
const CodeBackground_1 = require("../components/CodeBackground");
const { fontFamily } = (0, Inter_1.loadFont)("normal", {
    weights: ["400", "700", "900"],
    subsets: ["latin"],
});
const BetterWayScene = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    const textSpring = (0, remotion_1.spring)({
        frame,
        fps,
        config: { damping: 12, stiffness: 100 },
    });
    const textScale = (0, remotion_1.interpolate)(textSpring, [0, 1], [0.7, 1]);
    const textOpacity = (0, remotion_1.interpolate)(textSpring, [0, 1], [0, 1]);
    return (<remotion_1.AbsoluteFill>
    <CodeBackground_1.CodeBackground />
    <remotion_1.AbsoluteFill style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily,
        }}>
    <div style={{
            opacity: textOpacity,
            transform: `scale(${textScale})`,
            fontSize: 64,
            color: "#F85149",
            fontWeight: 900,
            textAlign: "center",
            lineHeight: 1.4,
            textShadow: "0 0 40px rgba(248, 81, 73, 0.4)",
            letterSpacing: "-0.02em",
        }}>
Adding print() everywhere?
    <br />
    <span style={{ color: "#7EE787", textShadow: "0 0 40px rgba(126, 231, 135, 0.4)" }}>
There's a better way.
    </span>
    </div>
    </remotion_1.AbsoluteFill>
    </remotion_1.AbsoluteFill>);
};
exports.BetterWayScene = BetterWayScene;
//# sourceMappingURL=BetterWayScene.js.map