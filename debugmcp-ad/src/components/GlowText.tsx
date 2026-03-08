import React from "react";

type GlowTextProps = {
	children: React.ReactNode;
	fontSize?: number;
	color?: string;
	glowColor?: string;
	fontWeight?: string | number;
	style?: React.CSSProperties;
};

export const GlowText: React.FC<GlowTextProps> = ({
	children,
	fontSize = 64,
	color = "#F0F6FC",
	glowColor = "#58A6FF",
	fontWeight = "bold",
	style = {},
}) => {
	return (
		<div
			style={{
				fontSize,
				color,
				fontWeight,
				textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}40, 0 0 80px ${glowColor}20`,
				...style,
			}}
		>
			{children}
		</div>
	);
};