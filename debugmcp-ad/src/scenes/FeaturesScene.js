"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeaturesScene = void 0;
const remotion_1 = require("remotion");
const Inter_1 = require("@remotion/google-fonts/Inter");
const CodeBackground_1 = require("../components/CodeBackground");
const FeatureCard_1 = require("../components/FeatureCard");
const GlowText_1 = require("../components/GlowText");
const { fontFamily } = (0, Inter_1.loadFont)("normal", {
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
const FeaturesScene = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    // Title entrance
    const titleSpring = (0, remotion_1.spring)({
        frame,
        fps,
        config: { damping: 200 },
    });
    const titleOpacity = (0, remotion_1.interpolate)(titleSpring, [0, 1], [0, 1]);
    const titleY = (0, remotion_1.interpolate)(titleSpring, [0, 1], [30, 0]);
    return (<remotion_1.AbsoluteFill>
    <CodeBackground_1.CodeBackground />
    <remotion_1.AbsoluteFill style={{
            justifyContent: "center",
            alignItems: "center",
            fontFamily,
            padding: 80,
        }}>
    {/* Section title */}
    <div style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 50,
        }}>
    <GlowText_1.GlowText fontSize={72} glowColor="#7EE787" fontWeight={900}>
🔧 Powerful Tools
    </GlowText_1.GlowText>
    </div>

    {/* Feature cards grid - 2 columns */}
    <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 30,
            justifyContent: "center",
            maxWidth: 1200,
        }}>
        {FEATURES.map((feature, i) => (<div key={i} style={{ width: "calc(50% - 15px)" }}>
        <FeatureCard_1.FeatureCard emoji={feature.emoji} title={feature.title} delay={8 + i * 5}/>
        </div>))}
    </div>
    </remotion_1.AbsoluteFill>
    </remotion_1.AbsoluteFill>);
};
exports.FeaturesScene = FeaturesScene;
//# sourceMappingURL=FeaturesScene.js.map