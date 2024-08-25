import { BaseSchema } from "astro:content"

export type PatternOption = 
    readonly [string, Record<string, string | number | boolean>]