import { ParsedPattern } from "./types/ParsedPattern.js"
import { PatternOption } from "./types/PatternOption.js"


export function parsePattern(pattern: string | PatternOption): ParsedPattern {
    const [patternString, metadata] = Array.isArray(pattern) ? pattern : [pattern, {}]

    if (patternString.startsWith('../')) {
        throw new Error(
            'Patterns cannot start with `../`. Set the `base` option to a parent directory instead.',
        )
    }
    if (patternString.startsWith('/')) {
        throw new Error(
            'Patterns cannot start with `/`. Set the `base` option to a parent directory or use a relative path instead.',
        )
    }

    const glob = patternString.replace(/{{(\w+)}}/g, '*')
    const regexSource = patternString.replace(/{{(\w+)}}/g, '(?<$1>[\\w\\d\\_\\-]+)')
    const regex = new RegExp(regexSource)
    return { glob, regex, regexSource, metadata }
}
