"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlowText = void 0;
const react_1 = __importDefault(require("react"));
const GlowText = ({ children, fontSize = 64, color = "#F0F6FC", glowColor = "#58A6FF", fontWeight = "bold", style = {}, }) => {
    return (<div style={{
            fontSize,
            color,
            fontWeight,
            textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}40, 0 0 80px ${glowColor}20`,
            ...style,
        }}>
			{children}
		</div>);
};
exports.GlowText = GlowText;
//# sourceMappingURL=GlowText.js.map