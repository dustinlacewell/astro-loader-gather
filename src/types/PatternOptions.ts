import { PatternOption } from "./PatternOption.js"

export interface PatternOptions {
    patterns: (string | PatternOption)[]
    base?: string | URL
}