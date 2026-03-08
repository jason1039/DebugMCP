"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeBackground = void 0;
const remotion_1 = require("remotion");
const CODE_LINES = [
    "const debug = await startDebugging(file);",
    "await addBreakpoint(file, line);",
    "const vars = await getVariables('local');",
    "await stepOver();",
    "const result = await evaluate(expr);",
    "await continueExecution();",
    "const state = await inspectStack();",
    "await stepInto();",
    "const bp = await listBreakpoints();",
    "await stopDebugging();",
    "const frames = await getCallStack();",
    "await restartDebugging();",
    "const value = await watchExpression(v);",
    "await clearAllBreakpoints();",
    "const scope = await getVariables('all');",
];
const CodeBackground = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { height } = (0, remotion_1.useVideoConfig)();
    return (<remotion_1.AbsoluteFill style={{
            backgroundColor: "#0D1117",
            overflow: "hidden",
        }}>
			{CODE_LINES.map((line, i) => {
            const yOffset = ((i * 55 + frame * 0.3) % (height + 100)) - 50;
            const opacity = (0, remotion_1.interpolate)(yOffset, [0, height * 0.3, height * 0.7, height], [0, 0.08, 0.08, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (<div key={i} style={{
                    position: "absolute",
                    top: yOffset,
                    left: 40 + (i % 3) * 200,
                    fontFamily: "monospace",
                    fontSize: 14,
                    color: "#58A6FF",
                    opacity,
                    whiteSpace: "nowrap",
                }}>
						{line}
					</div>);
        })}

			{/* Subtle grid overlay */}
			<div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(rgba(88,166,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(88,166,255,0.03) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
        }}/>
		</remotion_1.AbsoluteFill>);
};
exports.CodeBackground = CodeBackground;
//# sourceMappingURL=CodeBackground.js.map