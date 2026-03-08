"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugMCPAd = void 0;
const remotion_1 = require("remotion");
const media_1 = require("@remotion/media");
const transitions_1 = require("@remotion/transitions");
const fade_1 = require("@remotion/transitions/fade");
const slide_1 = require("@remotion/transitions/slide");
const wipe_1 = require("@remotion/transitions/wipe");
const HookScene_1 = require("./scenes/HookScene");
const AgentTestScene_1 = require("./scenes/AgentTestScene");
const IntroScene_1 = require("./scenes/IntroScene");
const DemoScene_1 = require("./scenes/DemoScene");
const FeaturesScene_1 = require("./scenes/FeaturesScene");
const LanguagesScene_1 = require("./scenes/LanguagesScene");
const BetterWayScene_1 = require("./scenes/BetterWayScene");
const CTAScene_1 = require("./scenes/CTAScene");
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
const DebugMCPAd = () => {
    const frame = (0, remotion_1.useCurrentFrame)();
    const { fps, durationInFrames } = (0, remotion_1.useVideoConfig)();
    // Fade in audio at start, fade out at end
    const audioVolume = (f) => {
        const fadeIn = (0, remotion_1.interpolate)(f, [0, 2 * fps], [0, 0.35], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        });
        const fadeOut = (0, remotion_1.interpolate)(f, [durationInFrames - 2 * fps, durationInFrames], [0.35, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        });
        return Math.min(fadeIn, fadeOut);
    };
    return (<remotion_1.AbsoluteFill>
			{/* Background ambient music */}
			<media_1.Audio src={(0, remotion_1.staticFile)("bgm.wav")} volume={audioVolume} loop/>

			<transitions_1.TransitionSeries>
				{/* Scene 1: Hook - "AI writes excellent code but debugs primitively" */}
				<transitions_1.TransitionSeries.Sequence durationInFrames={HOOK_DURATION}>
					<HookScene_1.HookScene />
				</transitions_1.TransitionSeries.Sequence>

				<transitions_1.TransitionSeries.Transition presentation={(0, fade_1.fade)()} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

    {/* Scene 2: Agent Test - showing print() debugging visualization */}
    <transitions_1.TransitionSeries.Sequence durationInFrames={AGENT_TEST_DURATION}>
    <AgentTestScene_1.AgentTestScene />
    </transitions_1.TransitionSeries.Sequence>

    <transitions_1.TransitionSeries.Transition presentation={(0, fade_1.fade)()} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

    {/* Scene 2.5: "Adding print() everywhere? There's a better way." */}
    <transitions_1.TransitionSeries.Sequence durationInFrames={BETTER_WAY_DURATION}>
    <BetterWayScene_1.BetterWayScene />
    </transitions_1.TransitionSeries.Sequence>

    <transitions_1.TransitionSeries.Transition presentation={(0, fade_1.fade)()} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

    {/* Scene 3: Intro - Logo + Title */}
				<transitions_1.TransitionSeries.Sequence durationInFrames={INTRO_DURATION}>
					<IntroScene_1.IntroScene />
				</transitions_1.TransitionSeries.Sequence>

				<transitions_1.TransitionSeries.Transition presentation={(0, slide_1.slide)({ direction: "from-right" })} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

    {/* Scene 4: Feature Highlights */}
    <transitions_1.TransitionSeries.Sequence durationInFrames={FEATURES_DURATION}>
    <FeaturesScene_1.FeaturesScene />
    </transitions_1.TransitionSeries.Sequence>

    <transitions_1.TransitionSeries.Transition presentation={(0, wipe_1.wipe)()} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

    {/* Scene 5: Demo Video - The star of the show */}
    <transitions_1.TransitionSeries.Sequence durationInFrames={DEMO_DURATION}>
    <DemoScene_1.DemoScene />
    </transitions_1.TransitionSeries.Sequence>

				<transitions_1.TransitionSeries.Transition presentation={(0, fade_1.fade)()} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

				{/* Scene 6: Language Support */}
				<transitions_1.TransitionSeries.Sequence durationInFrames={LANGUAGES_DURATION}>
					<LanguagesScene_1.LanguagesScene />
				</transitions_1.TransitionSeries.Sequence>

				<transitions_1.TransitionSeries.Transition presentation={(0, fade_1.fade)()} timing={(0, transitions_1.linearTiming)({ durationInFrames: TRANSITION_FRAMES })}/>

				{/* Scene 7: Call to Action */}
				<transitions_1.TransitionSeries.Sequence durationInFrames={CTA_DURATION}>
					<CTAScene_1.CTAScene />
				</transitions_1.TransitionSeries.Sequence>
			</transitions_1.TransitionSeries>
		</remotion_1.AbsoluteFill>);
};
exports.DebugMCPAd = DebugMCPAd;
//# sourceMappingURL=DebugMCPAd.js.map