export interface ParsedPattern {
    glob: string
    regex: RegExp
    regexSource: string
    metadata: Record<string, string | number | boolean>
}
