import { Composition } from "remotion";
import { DebugMCPAd } from "./DebugMCPAd";

// Total duration calculation:
// 8 scenes: 135 + 180 + 90 + 120 + 150 + 480 + 120 + 120 = 1395
// 7 transitions: 7 * 20 = 140 frames overlap
// Total: 1395 - 140 = 1255 ... but adding +70 net from BetterWay scene
// New total: 1395 + 70 = 1465 (~48.8s at 30fps)
const TOTAL_DURATION = 1465;
export const RemotionRoot: React.FC = () => {
return (
<>
<Composition
id="DebugMCPAd"
component={DebugMCPAd}
durationInFrames={TOTAL_DURATION}
fps={30}
width={1920}
height={1080}
/>
</>
);
};