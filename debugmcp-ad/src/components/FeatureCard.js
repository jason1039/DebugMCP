"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureCard = void 0;
const react_1 = __importDefault(require("react"));
const remotion_1 = require("remotion");
const FeatureCard = ({ emoji, title, delay }) => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps } = (0, remotion_1.useVideoConfig)();
    const entrance = (0, remotion_1.spring)({
        frame,
        fps,
        delay,
        config: { damping: 12, stiffness: 200 },
    });
    const translateY = (0, remotion_1.interpolate)(entrance, [0, 1], [60, 0]);
    const opacity = (0, remotion_1.interpolate)(entrance, [0, 1], [0, 1]);
    return (<div style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            backgroundColor: "rgba(88, 166, 255, 0.08)",
            border: "1px solid rgba(88, 166, 255, 0.25)",
            borderRadius: 16,
            padding: "24px 40px",
            transform: `translateY(${translateY}px)`,
            opacity,
        }}>
    <span style={{ fontSize: 52 }}>{emoji}</span>
    <span style={{
            fontSize: 36,
            color: "#F0F6FC",
            fontWeight: 600,
            letterSpacing: "-0.02em",
        }}>
    {title}
    </span>
    </div>);
};
exports.FeatureCard = FeatureCard;
//# sourceMappingURL=FeatureCard.js.map