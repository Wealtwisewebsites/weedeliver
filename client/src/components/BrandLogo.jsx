import { LOGO_URL } from "../lib/logo";

const SplitD = ({ leftColor = "#15803d", rightColor = "#111827" }) => (
  <span style={{ background: `linear-gradient(90deg, ${leftColor} 50%, ${rightColor} 50%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>D</span>
);

export const BrandName = ({ size = "text-xl", greenClass = "text-green-700", blackClass = "text-gray-900", greenHex = "#15803d", blackHex = "#111827" }) => (
  <span className={`${size} font-black tracking-tight`} style={{ fontFamily: "'Outfit', sans-serif" }}>
    <span className={greenClass}>WEE</span><SplitD leftColor={greenHex} rightColor={blackHex} /><span className={blackClass}>eliver</span>
  </span>
);

export const BrandLogo = ({ size = "md", showText = true, className = "", dark = false }) => {
  const sizes = { xs: "h-7", sm: "h-9", md: "h-11", lg: "h-16", xl: "h-24" };
  const textSizes = { xs: "text-sm", sm: "text-base", md: "text-xl", lg: "text-3xl", xl: "text-5xl" };
  const green = dark ? "text-green-400" : "text-green-700";
  const black = dark ? "text-white" : "text-gray-900";
  const greenHex = dark ? "#4ade80" : "#15803d";
  const blackHex = dark ? "#ffffff" : "#111827";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={LOGO_URL} alt="WeeDeliver" className={`${sizes[size]} object-contain`} />
      {showText && <BrandName size={textSizes[size]} greenClass={green} blackClass={black} greenHex={greenHex} blackHex={blackHex} />}
    </div>
  );
};

export const LeafIcon = ({ className = "w-6 h-6" }) => <svg viewBox="0 0 100 100" className={className} fill="currentColor"><path d="M50 5 C50 5 30 20 25 40 C20 55 25 70 50 95 C75 70 80 55 75 40 C70 20 50 5 50 5Z M50 15 C50 15 60 25 60 40 C60 50 55 60 50 75 C45 60 40 50 40 40 C40 25 50 15 50 15Z"/></svg>;

export default BrandLogo;
