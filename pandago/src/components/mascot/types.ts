/**
 * Estados de ánimo de Bao. Son la interfaz pública de la mascota: el motor de
 * lecciones y el chat de IA emiten estos valores y la UI decide cómo animarlos.
 */
export type BaoMood =
  | 'idle' // respira suavemente, parpadea
  | 'talking' // da una pista o habla en el chat
  | 'thinking' // la IA está generando respuesta
  | 'happy' // acierto: salta
  | 'celebrate' // racha / subida de nivel: salto + giro + destellos
  | 'encourage'; // fallo: se estremece y anima
