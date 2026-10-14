import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { BaoMood } from './types';

const FUR = '#E4572E';
const FUR_DARK = '#8C2F14';
const CREAM = '#FFF4E6';
const INK = '#2A1A14';

/**
 * Cara vectorial de Bao (panda rojo). La expresión (ojos/boca/mejillas)
 * cambia según el `mood`; el movimiento del cuerpo lo anima <Bao />.
 * En producción esto se sustituye por un archivo Rive con state machine
 * cuyos inputs tienen los mismos nombres que BaoMood.
 */
export function BaoFace({ mood, size }: { mood: BaoMood; size: number }) {
  const happy = mood === 'happy' || mood === 'celebrate';
  const sad = mood === 'encourage';

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Orejas */}
      <G>
        <Path d="M18 38 L26 8 L48 26 Z" fill={FUR} />
        <Path d="M24 32 L28 16 L40 26 Z" fill={CREAM} />
        <Path d="M102 38 L94 8 L72 26 Z" fill={FUR} />
        <Path d="M96 32 L92 16 L80 26 Z" fill={CREAM} />
      </G>
      {/* Cabeza */}
      <Ellipse cx={60} cy={64} rx={48} ry={42} fill={FUR} />
      {/* Máscara blanca característica */}
      <Ellipse cx={36} cy={52} rx={13} ry={9} fill={CREAM} />
      <Ellipse cx={84} cy={52} rx={13} ry={9} fill={CREAM} />
      <Ellipse cx={60} cy={84} rx={26} ry={18} fill={CREAM} />
      {/* "Lágrimas" de pelo oscuro bajo los ojos */}
      <Path d="M38 64 Q34 78 42 90" stroke={FUR_DARK} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d="M82 64 Q86 78 78 90" stroke={FUR_DARK} strokeWidth={6} strokeLinecap="round" fill="none" />

      {/* Ojos */}
      {happy ? (
        <G>
          <Path d="M36 64 Q42 56 48 64" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M72 64 Q78 56 84 64" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
        </G>
      ) : mood === 'thinking' ? (
        <G>
          <Circle cx={44} cy={60} r={6} fill={INK} />
          <Circle cx={80} cy={60} r={6} fill={INK} />
          <Circle cx={46} cy={57} r={2} fill="#fff" />
          <Circle cx={82} cy={57} r={2} fill="#fff" />
        </G>
      ) : (
        <G>
          <Circle cx={42} cy={64} r={7} fill={INK} />
          <Circle cx={78} cy={64} r={7} fill={INK} />
          <Circle cx={44.5} cy={61} r={2.5} fill="#fff" />
          <Circle cx={80.5} cy={61} r={2.5} fill="#fff" />
          {sad && (
            <G>
              <Path d="M32 54 Q40 52 47 47" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
              <Path d="M88 54 Q80 52 73 47" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
            </G>
          )}
        </G>
      )}

      {/* Nariz */}
      <Ellipse cx={60} cy={76} rx={6} ry={4.5} fill={INK} />

      {/* Boca */}
      {mood === 'talking' ? (
        <Ellipse cx={60} cy={89} rx={6} ry={5} fill={INK} />
      ) : happy ? (
        <Path d="M48 84 Q60 100 72 84 Z" fill={INK} />
      ) : sad ? (
        <Path d="M52 90 Q60 84 68 90" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : (
        <Path d="M52 84 Q56 89 60 84 Q64 89 68 84" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}

      {/* Mejillas sonrojadas */}
      {(happy || mood === 'talking') && (
        <G opacity={0.55}>
          <Ellipse cx={26} cy={78} rx={7} ry={4} fill="#FF8FA3" />
          <Ellipse cx={94} cy={78} rx={7} ry={4} fill="#FF8FA3" />
        </G>
      )}
    </Svg>
  );
}
