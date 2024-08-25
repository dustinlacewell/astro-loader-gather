import { BaseSchema } from "astro:content"
import Zod from "zod"

export interface ParsedPattern<S extends BaseSchema = any> {
    glob: string
    regex: RegExp
    regexSource: string
    transform?: (e: Zod.infer<S>) => Zod.infer<S>
    metadata: Record<string, string | number | boolean>
}
