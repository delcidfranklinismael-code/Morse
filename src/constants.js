/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MORSE_DICTIONARY = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..'
};

export const REVERSE_MORSE_DICTIONARY = Object.entries(MORSE_DICTIONARY).reduce(
  (acc, [char, morse]) => ({ ...acc, [morse]: char }),
  {}
);

export const SENTENCES = [
  // Cortas (Niveles iniciales)
  "REACT", "HOOK", "PROP", "STATE", "DOM", "VITE", "NODE", "JS", "CSS", "HTML",
  "WEB", "CODE", "APP", "DATA", "MAP", "KEY", "REF", "MEMO", "SYNC", "ASYNC",
  // Medianas
  "USE STATE HOOK", "VIRTUAL DOM", "REACT ROUTER", "COMPONENT UI", "PROPS DRILLING",
  "EVENT HANDLER", "LIFECYCLE", "USE EFFECT", "USE CONTEXT", "USE CALLBACK",
  "USE MEMO", "CUSTOM HOOK", "REDUX STORE", "API FETCH", "JSON DATA",
  // Largas
  "REACT IS A JAVASCRIPT LIBRARY", "HOOKS ARE A NEW ADDITION", "COMPONENTS ARE THE BUILDING BLOCKS",
  "STATE MANAGEMENT IS CRITICAL", "PROPS ARE PASSED TO COMPONENTS", "VIRTUAL DOM IS VERY FAST",
  "VITE IS A MODERN BUILD TOOL", "NODE JS RUNS ON THE SERVER", "CSS IS FOR STYLING WEBSITES",
  "HTML IS THE STRUCTURE OF WEB", "JAVASCRIPT IS THE LANGUAGE", "REACT NATIVE FOR MOBILE APPS",
  // Complejas
  "REACT DEVELOPERS ARE IN HIGH DEMAND", "LEARNING REACT IS VERY REWARDING",
  "THE ECOSYSTEM IS GROWING FAST", "PRACTICE MAKES PERFECT IN CODING",
  "NEVER STOP LEARNING NEW TOOLS", "THE FUTURE OF WEB IS EXCITING",
  "CLEAN CODE IS EASY TO MAINTAIN", "TESTING ENSURES APP RELIABILITY"
];

export const DASH_THRESHOLD = 250;
export const LETTER_WAIT_TIME = 500;
