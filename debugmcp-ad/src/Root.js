"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemotionRoot = void 0;
const remotion_1 = require("remotion");
const DebugMCPAd_1 = require("./DebugMCPAd");
// Total duration calculation:
// 8 scenes: 135 + 180 + 90 + 120 + 150 + 480 + 120 + 120 = 1395
// 7 transitions: 7 * 20 = 140 frames overlap
// Total: 1395 - 140 = 1255 ... but adding +70 net from BetterWay scene
// New total: 1395 + 70 = 1465 (~48.8s at 30fps)
const TOTAL_DURATION = 1465;
const RemotionRoot = () => {
    return (<>
    <remotion_1.Composition id="DebugMCPAd" component={DebugMCPAd_1.DebugMCPAd} durationInFrames={TOTAL_DURATION} fps={30} width={1920} height={1080}/>
    </>);
};
exports.RemotionRoot = RemotionRoot;
//# sourceMappingURL=Root.js.map