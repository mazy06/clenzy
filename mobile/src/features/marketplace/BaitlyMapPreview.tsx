import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/** Miniature cartographique, dans la palette Papier du fond Baitly. */
export function BaitlyMapPreview() {
  return <Svg width={38} height={38} viewBox="0 0 64 64" accessible={false}>
    <Defs><ClipPath id="baitly-map-preview"><Rect width={64} height={64} rx={10} /></ClipPath></Defs>
    <G clipPath="url(#baitly-map-preview)">
      <Rect width={64} height={64} fill="#F3F0E8" />
      <Path d="M0 0h24l-5 17L0 23zM43 39l21-7v32H48zM5 42l12-3 8 16-16 9z" fill="#C8E3BC" />
      <Path d="M48-5c-17 14 8 19-4 34S25 45 36 69" fill="none" stroke="#7FBCE3" strokeWidth={5} />
      <Path d="M-8 33L72 9M14-8l8 36 38 44M-4 57l30-24 43 11M3 6l21 5 37 44" fill="none" stroke="#CFC7B8" strokeWidth={6} />
      <Path d="M-8 33L72 9M14-8l8 36 38 44M-4 57l30-24 43 11M3 6l21 5 37 44" fill="none" stroke="#FBFCFD" strokeWidth={3.5} />
      <Rect x={28} y={18} width={7} height={5} rx={1} fill="#DFD8CB" />
      <Rect x={7} y={33} width={6} height={5} rx={1} fill="#DFD8CB" />
      <Path d="M31 24c-6 0-10 4-10 10 0 8 10 16 10 16s10-8 10-16c0-6-4-10-10-10z" fill="#1B2A35" stroke="#FBFCFD" strokeWidth={2} />
      <Circle cx={31} cy={34} r={3.5} fill="#FBFCFD" />
    </G>
  </Svg>;
}
