declare module 'prismjs/components/prism-core' {
  export type Language = string;
  export function highlight(code: string, l: Language): string;
  export const languages: { [k: string]: Language };
}
