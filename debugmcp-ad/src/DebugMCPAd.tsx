import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

import { HookScene } from "./scenes/HookScene";
import { AgentTestScene } from "./scenes/AgentTestScene";
import { IntroScene } from "./scenes/IntroScene";
import { DemoScene } from "./scenes/DemoScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { LanguagesScene } from "./scenes/LanguagesScene";
import { BetterWayScene } from "./scenes/BetterWayScene";
import { CTAScene } from "./scenes/CTAScene";

// Scene durations in frames (at 30fps)
const HOOK_DURATION = 135; // 4.5s - just the text (longer pause before transition)
const AGENT_TEST_DURATION = 180; // 6s - code editor with print statements (longer pause at end)
const BETTER_WAY_DURATION = 90; // 3s - "Adding print() everywhere? There's a better way."
const INTRO_DURATION = 120; // 4s
const DEMO_DURATION = 480; // 16s - demo video
const FEATURES_DURATION = 150; // 5s
const LANGUAGES_DURATION = 120; // 4s
const CTA_DURATION = 120; // 4s

// Transition duration
const TRANSITION_FRAMES = 20;

// 7 scenes: 135 + 180 + 120 + 690 + 150 + 120 + 120 = 1515
// 6 transitions: 6*20 = 120
// Total: 1515 - 120 = 1395 frames (~46.5s at 30fps)
const TOTAL_FRAMES = 1395;

export const DebugMCPAd: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps, durationInFrames } = useVideoConfig();

	// Fade in audio at start, fade out at end
	const audioVolume = (f: number) => {
		const fadeIn = interpolate(f, [0, 2 * fps], [0, 0.35], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		});
		const fadeOut = interpolate(f, [durationInFrames - 2 * fps, durationInFrames], [0.35, 0], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		});
		return Math.min(fadeIn, fadeOut);
	};

	return (
		<AbsoluteFill>
			{/* Background ambient music */}
			<Audio
				src={staticFile("bgm.wav")}
				volume={audioVolume}
				loop
			/>

			<TransitionSeries>
				{/* Scene 1: Hook - "AI writes excellent code but debugs primitively" */}
				<TransitionSeries.Sequence durationInFrames={HOOK_DURATION}>
					<HookScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
				/>

{/* Scene 2: Agent Test - showing print() debugging visualization */}
<TransitionSeries.Sequence durationInFrames={AGENT_TEST_DURATION}>
<AgentTestScene />
</TransitionSeries.Sequence>

<TransitionSeries.Transition
presentation={fade()}
timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
/>

{/* Scene 2.5: "Adding print() everywhere? There's a better way." */}
<TransitionSeries.Sequence durationInFrames={BETTER_WAY_DURATION}>
<BetterWayScene />
</TransitionSeries.Sequence>

<TransitionSeries.Transition
presentation={fade()}
timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
/>

{/* Scene 3: Intro - Logo + Title */}
				<TransitionSeries.Sequence durationInFrames={INTRO_DURATION}>
					<IntroScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={slide({ direction: "from-right" })}
					timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
				/>

{/* Scene 4: Feature Highlights */}
<TransitionSeries.Sequence durationInFrames={FEATURES_DURATION}>
<FeaturesScene />
</TransitionSeries.Sequence>

<TransitionSeries.Transition
presentation={wipe()}
timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
/>

{/* Scene 5: Demo Video - The star of the show */}
<TransitionSeries.Sequence durationInFrames={DEMO_DURATION}>
<DemoScene />
</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
				/>

				{/* Scene 6: Language Support */}
				<TransitionSeries.Sequence durationInFrames={LANGUAGES_DURATION}>
					<LanguagesScene />
				</TransitionSeries.Sequence>

				<TransitionSeries.Transition
					presentation={fade()}
					timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
				/>

				{/* Scene 7: Call to Action */}
				<TransitionSeries.Sequence durationInFrames={CTA_DURATION}>
					<CTAScene />
				</TransitionSeries.Sequence>
			</TransitionSeries>
		</AbsoluteFill>
	);
};