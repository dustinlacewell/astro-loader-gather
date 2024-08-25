import { BaseSchema } from "astro:content"
import { PatternOption } from "./PatternOption.js"
import { Entry } from "./Entry.js"

export interface PatternOptions<E extends Entry> {
    patterns: (string | PatternOption)[]
    base?: string | URL
    transform?: (e: E) => E
}