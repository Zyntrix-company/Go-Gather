import React from 'react';
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop,
} from 'react-native-svg';

// Vector stand-ins for the Gallery empty-state artwork: a fanned stack of
// polaroids over soft clouds. Each photo's scene is drawn in a local 60×58 box.

const FRAME_W = 70;
const FRAME_H = 82;

function Polaroid({
  id, x, y, rotate, scale = 1, children,
}: {
  id: string; x: number; y: number; rotate: number; scale?: number; children: React.ReactNode;
}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale}) rotate(${rotate} ${FRAME_W / 2} ${FRAME_H / 2})`}>
      <Defs>
        <ClipPath id={id}>
          <Rect x={5} y={5} width={60} height={58} rx={1.5} />
        </ClipPath>
      </Defs>
      <Rect x={1.5} y={3} width={FRAME_W} height={FRAME_H} rx={3} fill="#0f172a" opacity={0.08} />
      <Rect width={FRAME_W} height={FRAME_H} rx={3} fill="#fff" stroke="#e2e8f0" strokeWidth={0.75} />
      <G clipPath={`url(#${id})`}>
        <G transform="translate(5 5)">{children}</G>
      </G>
    </G>
  );
}

function Clouds() {
  return (
    <>
      <Circle cx={130} cy={70} r={58} fill="#e6f4f1" opacity={0.55} />
      <Ellipse cx={34} cy={100} rx={26} ry={9} fill="#d9efec" opacity={0.8} />
      <Ellipse cx={48} cy={95} rx={14} ry={9} fill="#d9efec" opacity={0.8} />
      <Ellipse cx={226} cy={98} rx={24} ry={8} fill="#d9efec" opacity={0.8} />
      <Ellipse cx={214} cy={93} rx={12} ry={8} fill="#d9efec" opacity={0.8} />
    </>
  );
}

// ─── Trip scenes ──────────────────────────────────────────────────────────────

function MountainScene() {
  return (
    <>
      <Defs>
        <LinearGradient id="gtMountSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#bae6fd" />
          <Stop offset="1" stopColor="#f0f9ff" />
        </LinearGradient>
      </Defs>
      <Rect width={60} height={58} fill="url(#gtMountSky)" />
      <Circle cx={44} cy={14} r={6} fill="#fcd34d" />
      <Path d="M0 46 L18 18 L30 34 L40 22 L60 44 V58 H0Z" fill="#2dd4bf" />
      <Path d="M18 18 L13.5 25 L18 23 L22 26Z" fill="#fff" />
      <Path d="M0 50 L14 36 L26 48 L38 38 L60 52 V58 H0Z" fill="#0f766e" />
      <Path d="M0 54 Q30 48 60 55 V58 H0Z" fill="#22c55e" />
    </>
  );
}

function BeachScene() {
  return (
    <>
      <Defs>
        <LinearGradient id="gtBeachSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7dd3fc" />
          <Stop offset="1" stopColor="#e0f2fe" />
        </LinearGradient>
      </Defs>
      <Rect width={60} height={58} fill="url(#gtBeachSky)" />
      <Ellipse cx={44} cy={12} rx={7} ry={3} fill="#fff" />
      <Ellipse cx={49} cy={10} rx={5} ry={3} fill="#fff" />
      <Rect y={32} width={60} height={14} fill="#0ea5e9" />
      <Path d="M0 36 H60" stroke="#bae6fd" strokeWidth={1} />
      <Path d="M0 42 Q30 35 60 44 V58 H0Z" fill="#fde68a" />
      <Path d="M17 52 Q19 36 25 22" stroke="#92400e" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M25 22 Q15 15 6 22" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M25 22 Q34 13 45 17" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M25 22 Q20 9 12 7" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M25 22 Q36 22 41 31" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  );
}

function TempleScene() {
  return (
    <>
      <Defs>
        <LinearGradient id="gtTempleSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fed7aa" />
          <Stop offset="1" stopColor="#fff7ed" />
        </LinearGradient>
      </Defs>
      <Rect width={60} height={58} fill="url(#gtTempleSky)" />
      <Rect x={7} y={26} width={6} height={32} fill="#d97706" />
      <Path d="M7 26 L10 19 L13 26Z" fill="#b45309" />
      <Rect x={47} y={26} width={6} height={32} fill="#d97706" />
      <Path d="M47 26 L50 19 L53 26Z" fill="#b45309" />
      <Rect x={13} y={34} width={34} height={24} fill="#f59e0b" />
      <Path d="M19 34 Q30 12 41 34Z" fill="#d97706" />
      <Line x1={30} y1={17} x2={30} y2={11} stroke="#b45309" strokeWidth={1.2} />
      <Path d="M25 58 V47 Q30 41 35 47 V58Z" fill="#92400e" />
      <Rect x={16} y={40} width={4} height={6} rx={2} fill="#92400e" />
      <Rect x={40} y={40} width={4} height={6} rx={2} fill="#92400e" />
    </>
  );
}

// ─── Event scenes ─────────────────────────────────────────────────────────────

function CakeScene() {
  return (
    <>
      <Rect width={60} height={58} fill="#fce7f3" />
      <Rect y={46} width={60} height={12} fill="#fbcfe8" />
      <Rect x={12} y={30} width={36} height={17} rx={2} fill="#fff" />
      <Rect x={12} y={38} width={36} height={3} fill="#f9a8d4" />
      <Path d="M12 30 H48 V33 Q46 36 44 33 Q40 37 36 33 Q32 37 28 33 Q24 37 20 33 Q16 37 12 33Z" fill="#f472b6" />
      {[19, 28.5, 38].map((cx) => (
        <G key={cx}>
          <Rect x={cx} y={20} width={3} height={10} rx={1} fill="#fb7185" />
          <Ellipse cx={cx + 1.5} cy={17} rx={1.6} ry={2.6} fill="#fbbf24" />
        </G>
      ))}
    </>
  );
}

function SunsetCrowdScene() {
  return (
    <>
      <Defs>
        <LinearGradient id="geSunsetSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7c3aed" />
          <Stop offset="0.55" stopColor="#f472b6" />
          <Stop offset="1" stopColor="#fdba74" />
        </LinearGradient>
      </Defs>
      <Rect width={60} height={58} fill="url(#geSunsetSky)" />
      <Circle cx={30} cy={42} r={11} fill="#fde68a" />
      <Path d="M0 7 Q30 18 60 7" stroke="#1e293b" strokeWidth={0.6} fill="none" />
      {[6, 15, 24, 33, 42, 51].map((cx, i) => (
        <Circle key={cx} cx={cx} cy={9.5 + (i === 0 || i === 5 ? 0 : i === 1 || i === 4 ? 2.5 : 3.6)} r={1.6} fill="#fde047" />
      ))}
      {[4, 13, 22, 31, 40, 49].map((x, i) => (
        <G key={x}>
          <Circle cx={x + 4} cy={i % 2 ? 41 : 43} r={3.6} fill="#1e1b4b" />
          <Rect x={x} y={i % 2 ? 44 : 46} width={8} height={16} rx={3.5} fill="#1e1b4b" />
        </G>
      ))}
    </>
  );
}

function ToastScene() {
  return (
    <>
      <Defs>
        <LinearGradient id="geToastSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#bae6fd" />
          <Stop offset="1" stopColor="#eff6ff" />
        </LinearGradient>
      </Defs>
      <Rect width={60} height={58} fill="url(#geToastSky)" />
      <G transform="translate(14 18) rotate(-14 7 10)">
        <Path d="M0 0 H14 L12 18 Q7 21 2 18Z" fill="#fbbf24" stroke="#fff" strokeWidth={1} />
        <Line x1={7} y1={20} x2={7} y2={32} stroke="#fff" strokeWidth={1.5} />
        <Line x1={2} y1={32} x2={12} y2={32} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      </G>
      <G transform="translate(32 18) rotate(14 7 10)">
        <Path d="M0 0 H14 L12 18 Q7 21 2 18Z" fill="#fbbf24" stroke="#fff" strokeWidth={1} />
        <Line x1={7} y1={20} x2={7} y2={32} stroke="#fff" strokeWidth={1.5} />
        <Line x1={2} y1={32} x2={12} y2={32} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      </G>
      <Circle cx={22} cy={26} r={1} fill="#fff" />
      <Circle cx={38} cy={24} r={1.2} fill="#fff" />
      <Path d="M30 6 V12 M24 9 L27 13 M36 9 L33 13" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

// ─── Public illustrations ─────────────────────────────────────────────────────

const VIEW_W = 260;
const VIEW_H = 112;

// The flight path "M166 30 Q192 32 214 18" ends at (214, 18) heading along
// (214,18) − (192,32) = (22, −14). The plane (nose at +x, tail at x = −9.5,
// drawn at 1.1×) is rotated to that heading and centred one half-length past
// the end, so its tail sits exactly on the last dash.
const PLANE_ANGLE = (Math.atan2(-14, 22) * 180) / Math.PI;
const PLANE_X = 214 + Math.cos((PLANE_ANGLE * Math.PI) / 180) * 9.5 * 1.1;
const PLANE_Y = 18 + Math.sin((PLANE_ANGLE * Math.PI) / 180) * 9.5 * 1.1;

export function TripAlbumsEmptyIllustration({ width = 250 }: { width?: number }) {
  return (
    <Svg width={width} height={(width * VIEW_H) / VIEW_W} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
      <Clouds />
      {/* Flight path rising out from behind the photos, with the plane's tail
          on the end of the dashes and its nose along the path's direction. */}
      <Path d="M166 30 Q192 32 214 18" stroke="#14b8a6" strokeWidth={1.4} strokeDasharray="3 3" strokeLinecap="round" />
      <G transform={`translate(${PLANE_X} ${PLANE_Y}) rotate(${PLANE_ANGLE}) scale(1.1)`}>
        <Path
          d="M9 0 C9 -1 8 -1.4 7 -1.4 L2 -1.4 L-3 -7 L-5 -7 L-2 -1.4 L-6 -1.4 L-8 -3.5 L-9.5 -3.5 L-8 0 L-9.5 3.5 L-8 3.5 L-6 1.4 L-2 1.4 L-5 7 L-3 7 L2 1.4 L7 1.4 C8 1.4 9 1 9 0Z"
          fill="#14b8a6"
        />
      </G>
      {/* Sparkle dashes */}
      <Path d="M40 40 L48 44 M36 52 L46 52 M42 62 L48 58" stroke="#fb923c" strokeWidth={1.6} strokeLinecap="round" />
      <Polaroid id="gtP1" x={56} y={20} rotate={-9} scale={0.95}><MountainScene /></Polaroid>
      <Polaroid id="gtP3" x={152} y={28} rotate={8} scale={0.85}><TempleScene /></Polaroid>
      <Polaroid id="gtP2" x={100} y={10} rotate={3} scale={1.05}><BeachScene /></Polaroid>
    </Svg>
  );
}

export function EventAlbumsEmptyIllustration({ width = 250 }: { width?: number }) {
  return (
    <Svg width={width} height={(width * VIEW_H) / VIEW_W} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
      <Clouds />
      {/* Confetti */}
      <Path d="M44 30 L48 36 M38 48 L44 50 M212 34 L220 30 M214 50 L222 52 M168 8 Q172 2 176 6" stroke="#fb923c" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M84 6 Q88 10 86 14 M200 16 L204 22" stroke="#2dd4bf" strokeWidth={1.6} strokeLinecap="round" />
      <Rect x={52} y={60} width={3} height={3} rx={0.8} fill="#fbbf24" transform="rotate(20 53 61)" />
      <Rect x={226} y={66} width={3} height={3} rx={0.8} fill="#f472b6" transform="rotate(-20 227 67)" />
      <Polaroid id="geP1" x={58} y={30} rotate={-10} scale={0.88}><CakeScene /></Polaroid>
      <Polaroid id="geP3" x={156} y={30} rotate={9} scale={0.88}><ToastScene /></Polaroid>
      <Polaroid id="geP2" x={98} y={8} rotate={4} scale={1.08}><SunsetCrowdScene /></Polaroid>
    </Svg>
  );
}
