import { ContentEntryType, DataEntryType } from 'astro'
import path from 'path';


export function posixifyPath(filePath: string) {
    return filePath.split(path.sep).join('/');
}

export function posixRelative(from: string, to: string) {
    return posixifyPath(path.relative(from, to));
}

export function getEntryConfigByExtMap<TEntryType extends ContentEntryType | DataEntryType>(
    entryTypes: TEntryType[],
): Map<string, TEntryType> {
    const map = new Map<string, TEntryType>();
    for (const entryType of entryTypes) {
        for (const ext of entryType.extensions) {
            map.set(ext, entryType);
        }
    }
    return map;
}