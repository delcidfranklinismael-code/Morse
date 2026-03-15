/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MORSE_DICTIONARY: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..'
};

export const REVERSE_MORSE_DICTIONARY: Record<string, string> = Object.entries(MORSE_DICTIONARY).reduce(
  (acc, [char, morse]) => ({ ...acc, [morse]: char }),
  {}
);

export const SENTENCES = [
  // Cortas (Niveles iniciales)
  "HOLA", "SOL", "MAR", "PAZ", "LUZ", "DIA", "FE", "REY", "SAL", "OJO",
  "CASA", "PERRO", "GATO", "LUNA", "CAFE", "ROJO", "AZUL", "VIDA", "AMOR", "FLOR",
  // Medianas
  "EL SOL BRILLA", "HOLA MUNDO", "BUENOS DIAS", "AGUA DULCE", "CIELO AZUL",
  "GATO NEGRO", "PERRO FIEL", "LUNA LLENA", "MAR PROFUNDO", "FLOR ROJA",
  "VIENTO FUERTE", "CAMINO LARGO", "FUEGO CALIENTE", "NIEVE BLANCA", "PAZ Y AMOR",
  // Largas
  "EL CAMINO ES MUY LARGO", "EL FUEGO ESTA MUY CALIENTE", "LA NIEVE ES MUY BLANCA",
  "EL CIELO ESTA MUY AZUL", "EL GATO DUERME EN EL SOFA", "LA LUNA ILUMINA LA NOCHE",
  "EL PERRO CORRE EN EL PARQUE", "EL MAR TIENE MUCHAS OLAS", "EL SOL SALE CADA MAÑANA",
  "LA VIDA ES MUY HERMOSA", "EL AMOR ES LA FUERZA MAYOR", "LA FLOR CRECE EN EL JARDIN",
  // Complejas
  "EL CODIGO MORSE ES DIVERTIDO", "ESTOY APRENDIENDO ALGO NUEVO HOY",
  "LA COMUNICACION ES LA CLAVE", "EL EXITO REQUIERE MUCHA PRACTICA",
  "NUNCA DEJES DE APRENDER COSAS", "EL FUTURO PERTENECE A LOS VALIENTES",
  "LA PACIENCIA ES UNA GRAN VIRTUD", "EL TRABAJO DURO SIEMPRE DA FRUTOS"
];

export const DASH_THRESHOLD = 250;
export const LETTER_WAIT_TIME = 700;
