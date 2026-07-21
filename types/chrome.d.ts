// O tsconfig do Expo nao puxa os @types automaticamente, e o namespace chrome e
// global: sem esta referencia o TypeScript nao enxerga as APIs da extensao.
/// <reference types="chrome" />
