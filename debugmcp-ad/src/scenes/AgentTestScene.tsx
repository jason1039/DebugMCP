import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CodeBackground } from "../components/CodeBackground";

const { fontFamily } = loadFont("normal", {
	weights: ["400", "700", "900"],
	subsets: ["latin"],
});

// Original code the AI agent wrote
const CODE_LINES = [
	{ text: "def process_orders(orders):", color: "#79C0FF" },
	{ text: "    results = []", color: "#F0F6FC" },
	{ text: "    for order in orders:", color: "#79C0FF" },
	{ text: "        total = order.price * order.qty", color: "#F0F6FC" },
	{ text: "        if order.discount:", color: "#79C0FF" },
	{ text: "            total *= (1 - order.discount)", color: "#F0F6FC" },
	{ text: "        results.append(total)", color: "#F0F6FC" },
	{ text: "    return results", color: "#79C0FF" },
];

// Print statements the AI agent adds to "debug"
const PRINT_INSERTIONS = [
	{ afterLine: 0, text: '    print(f"DEBUG: processing {len(orders)} orders")', delay: 0 },
	{ afterLine: 2, text: '    print(f"DEBUG: order={order}, price={order.price}")', delay: 0.5 },
	{ afterLine: 4, text: '        print("here!")', delay: 1.0 },
	{ afterLine: 5, text: '        print(f"DEBUG: discount applied, total={total}")', delay: 1.5 },
{ afterLine: 6, text: '    print(f"DEBUG: results={results}")', delay: 2.0 },
];

export const AgentTestScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Header entrance
	const headerSpring = spring({
		frame,
		fps,
		config: { damping: 200 },
	});
	const headerOpacity = interpolate(headerSpring, [0, 1], [0, 1]);

	// Editor entrance
	const editorDelay = 0.3 * fps;
	const editorSpring = spring({
		frame,
		fps,
		delay: editorDelay,
		config: { damping: 200 },
	});
	const editorOpacity = interpolate(editorSpring, [0, 1], [0, 1]);
	const editorY = interpolate(editorSpring, [0, 1], [30, 0]);

	// Print insertion springs (staggered)
	const baseDelay = 1.0 * fps;
	const printSprings = PRINT_INSERTIONS.map((ins) =>
		spring({
			frame,
			fps,
			delay: baseDelay + ins.delay * fps,
			config: { damping: 200 },
		})
	);

	// Build the rendered lines: interleave code with print insertions
	const renderLines: Array<{
		text: string;
		color: string;
		isDebug: boolean;
		springVal: number;
	}> = [];

	let lineNum = 1;
	for (let i = 0; i < CODE_LINES.length; i++) {
		renderLines.push({
			text: CODE_LINES[i].text,
			color: CODE_LINES[i].color,
			isDebug: false,
			springVal: 1,
		});

		// Check if any print insertions go after this line
		const insertions = PRINT_INSERTIONS.map((ins, idx) => ({ ...ins, idx })).filter(
			(ins) => ins.afterLine === i
		);
		for (const ins of insertions) {
			renderLines.push({
				text: ins.text,
				color: "#F85149",
				isDebug: true,
				springVal: printSprings[ins.idx],
			});
		}
	}

	return (
		<AbsoluteFill>
			<CodeBackground />
			<AbsoluteFill
				style={{
					justifyContent: "center",
					alignItems: "center",
					fontFamily,
				}}
			>
				{/* Header */}
				<div
					style={{
						opacity: headerOpacity,
						fontSize: 46,
						color: "#F0F6FC",
						fontWeight: 700,
						marginBottom: 24,
						display: "flex",
						alignItems: "center",
						gap: 14,
					}}
				>
<span style={{ fontSize: 50 }}>🤖</span>
					How your AI agent tests code today
				</div>

				{/* Code editor */}
				<div
					style={{
						opacity: editorOpacity,
						transform: `translateY(${editorY}px)`,
						width: 1200,
						borderRadius: 12,
						overflow: "hidden",
						boxShadow: "0 10px 50px rgba(0,0,0,0.6)",
						border: "1px solid rgba(248, 81, 73, 0.3)",
					}}
				>
					{/* Title bar */}
					<div
						style={{
							height: 34,
							backgroundColor: "#161B22",
							display: "flex",
							alignItems: "center",
							paddingLeft: 14,
							gap: 7,
							borderBottom: "1px solid rgba(88, 166, 255, 0.15)",
						}}
					>
						<div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#F85149" }} />
						<div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#D29922" }} />
						<div style={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: "#7EE787" }} />
						<span
							style={{
								marginLeft: 10,
								fontSize: 18,
								color: "#8B949E",
								fontFamily: "monospace",
							}}
						>
							orders.py — AI agent adding print() to debug...
						</span>
					</div>

					{/* Code content */}
					<div
						style={{
							backgroundColor: "#0D1117",
							padding: "14px 18px",
							fontFamily: "monospace",
							fontSize: 26,
							lineHeight: 1.9,
							whiteSpace: "pre",
						}}
					>
						{(() => {
							let num = 1;
							return renderLines.map((line, idx) => {
								if (line.isDebug) {
									const h = interpolate(line.springVal, [0, 1], [0, 38]);
									const op = interpolate(line.springVal, [0, 1], [0, 1]);
									return (
										<div
											key={idx}
											style={{
												overflow: "hidden",
												height: h,
												opacity: op,
											}}
										>
											<div style={{ display: "flex", gap: 14 }}>
												<span
													style={{
														color: "#F85149",
														minWidth: 28,
														textAlign: "right",
														fontWeight: 700,
													}}
												>
													+
												</span>
												<span
													style={{
														color: "#F85149",
														backgroundColor: "rgba(248, 81, 73, 0.1)",
														padding: "0 6px",
														borderRadius: 3,
													}}
												>
													{line.text}
												</span>
											</div>
										</div>
									);
								} else {
									const currentNum = num++;
									return (
										<div key={idx} style={{ display: "flex", gap: 14 }}>
											<span
												style={{
													color: "#484F58",
													minWidth: 28,
													textAlign: "right",
													userSelect: "none",
												}}
											>
												{currentNum}
											</span>
											<span style={{ color: line.color }}>{line.text}</span>
										</div>
									);
								}
							});
						})()}
					</div>
				</div>

			</AbsoluteFill>
		</AbsoluteFill>
	);
};