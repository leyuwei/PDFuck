export interface GrammarRequest { text: string; language?: string }
export interface GrammarMatch { offset: number; length: number; message: string; replacements: string[]; ruleId: string }
export interface GrammarResponse { language: string; matches: GrammarMatch[] }
