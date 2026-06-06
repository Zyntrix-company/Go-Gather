import React, { useId } from 'react';
import Svg, { Defs, G, LinearGradient, Mask, Path, Stop } from 'react-native-svg';

type IconProps = {
  size?: number;
};

/** Google Workspace Gmail icon (2026 gradient refresh). */
export function GmailBrandIcon({ size = 22 }: IconProps) {
  const uid = useId().replace(/:/g, '');
  const gradA = `${uid}-gmail-a`;
  const gradB = `${uid}-gmail-b`;

  return (
    <Svg width={size} height={size} viewBox="0 0 192 192" fill="none">
      <Path
        fill={`url(#${gradA})`}
        d="M146 44h38v110c0 6.627-5.373 12-12 12h-20a6 6 0 0 1-6-6z"
      />
      <Path fill="#fc413d" d="M46 44H8v110c0 6.627 5.373 12 12 12h20a6 6 0 0 0 6-6z" />
      <Path
        fill={`url(#${gradB})`}
        d="M39.226 30.456c-8.033-6.752-20.018-5.714-26.77 2.319-6.752 8.032-5.714 20.017 2.319 26.77l76.078 63.949a8 8 0 0 0 10.295 0l76.078-63.95c8.032-6.752 9.07-18.737 2.318-26.77-6.752-8.032-18.737-9.07-26.769-2.318L96 78.18z"
      />
      <Defs>
        <LinearGradient id={gradA} x1="165" x2="165" y1="44" y2="166" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#60d673" />
          <Stop offset="0.17" stopColor="#42c868" />
          <Stop offset="0.39" stopColor="#0ebc5f" />
          <Stop offset="0.62" stopColor="#00a9bb" />
          <Stop offset="0.86" stopColor="#3c90ff" />
          <Stop offset="1" stopColor="#3186ff" />
        </LinearGradient>
        <LinearGradient id={gradB} x1="8" x2="184" y1="46.13" y2="46.13" gradientUnits="userSpaceOnUse">
          <Stop offset="0.08" stopColor="#ff63a0" />
          <Stop offset="0.3" stopColor="#fc413d" />
          <Stop offset="0.5" stopColor="#fc413d" />
          <Stop offset="0.65" stopColor="#fc413d" />
          <Stop offset="0.72" stopColor="#fc5c30" />
          <Stop offset="0.86" stopColor="#feb10c" />
          <Stop offset="0.91" stopColor="#fec700" />
          <Stop offset="0.96" stopColor="#ffdb0f" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

/** Google Drive icon (2026 gradient refresh). */
export function DriveBrandIcon({ size = 22 }: IconProps) {
  const uid = useId().replace(/:/g, '');
  const maskId = `${uid}-drive-mask`;
  const gradB = `${uid}-drive-b`;
  const gradC = `${uid}-drive-c`;
  const gradD = `${uid}-drive-d`;

  return (
    <Svg width={size} height={size} viewBox="0 0 192 192" fill="none">
      <Mask
        id={maskId}
        width={168}
        height={154}
        x={12}
        y={18}
        maskUnits="userSpaceOnUse"
        maskType="alpha">
        <Path
          fill="#b43333"
          d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001z"
        />
      </Mask>
      <G mask={`url(#${maskId})`}>
        <Path fill={`url(#${gradB})`} d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578z" />
        <Path fill={`url(#${gradC})`} d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001z" />
        <Path fill={`url(#${gradD})`} d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048z" />
      </G>
      <Defs>
        <LinearGradient id={gradB} x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
          <Stop offset="0.09" stopColor="#ffe921" />
          <Stop offset="1" stopColor="#fec700" />
        </LinearGradient>
        <LinearGradient id={gradC} x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
          <Stop offset="0.15" stopColor="#a9a8ff" />
          <Stop offset="0.33" stopColor="#6d97ff" />
          <Stop offset="0.48" stopColor="#3186ff" />
        </LinearGradient>
        <LinearGradient id={gradD} x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
          <Stop offset="0.55" stopColor="#0ebc5f" />
          <Stop offset="0.85" stopColor="#78c9ff" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}
