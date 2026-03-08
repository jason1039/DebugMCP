import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

type FeatureCardProps = {
emoji: string;
title: string;
delay: number;
};

export const FeatureCard: React.FC<FeatureCardProps> = ({ emoji, title, delay }) => {
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const entrance = spring({
frame,
fps,
delay,
config: { damping: 12, stiffness: 200 },
});

const translateY = interpolate(entrance, [0, 1], [60, 0]);
const opacity = interpolate(entrance, [0, 1], [0, 1]);

return (
<div
style={{
display: "flex",
alignItems: "center",
gap: 20,
backgroundColor: "rgba(88, 166, 255, 0.08)",
border: "1px solid rgba(88, 166, 255, 0.25)",
borderRadius: 16,
padding: "24px 40px",
transform: `translateY(${translateY}px)`,
opacity,
}}
>
<span style={{ fontSize: 52 }}>{emoji}</span>
<span
style={{
fontSize: 36,
color: "#F0F6FC",
fontWeight: 600,
letterSpacing: "-0.02em",
}}
>
{title}
</span>
</div>
);
};