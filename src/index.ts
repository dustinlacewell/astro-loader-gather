import { promises as fs } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fastGlob from 'fast-glob';
import { green } from 'kleur/colors';
import micromatch from 'micromatch';
import pLimit from 'p-limit';

import type { Loader } from 'astro/loaders';
import type { ContentEntryRenderFuction, ContentEntryType } from 'astro'
import { PatternOptions } from './types/PatternOptions.js'
import { parsePattern } from './patterns.js'
import { getEntryConfigByExtMap, posixRelative } from './utils.js'
import { syncData } from './syncData.js'


export function gather(patternOptions: PatternOptions): Loader {
    const parsedPatterns = patternOptions.patterns.map(parsePattern);
    const fileToIdMap = new Map<string, string>();

    return {
        name: 'gatherer-loader',
        load: async (context) => {
            const { settings, logger, watcher, parseData, store, generateDigest } = context;
            const renderFunctionByContentType = new WeakMap<
                ContentEntryType,
                ContentEntryRenderFuction
            >();

            const untouchedEntries = new Set(store.keys());

            const entryConfigByExt = getEntryConfigByExtMap([
                ...settings.contentEntryTypes,
                ...settings.dataEntryTypes,
            ] as Array<ContentEntryType>);

            const baseDir = patternOptions.base
                ? new URL(patternOptions.base, settings.config.root)
                : settings.config.root;

            if (!baseDir.pathname.endsWith('/')) {
                baseDir.pathname = `${baseDir.pathname}/`;
            }

            const files = await fastGlob(parsedPatterns.map(p => p.glob), {
                cwd: fileURLToPath(baseDir),
            });

            function configForFile(file: string) {
                const ext = file.split('.').at(-1);
                if (!ext) {
                    logger.warn(`No extension found for ${file}`);
                    return;
                }
                return entryConfigByExt.get(`.${ext}`);
            }

            const limit = pLimit(10);

            const contentDir = new URL('content/', settings.config.srcDir);

            function isInContentDir(file: string) {
                const fileUrl = new URL(file, baseDir);
                return fileUrl.href.startsWith(contentDir.href);
            }

            const configFiles = new Set(
                ['config.js', 'config.ts', 'config.mjs'].map((file) => new URL(file, contentDir).href),
            );

            function isConfigFile(file: string) {
                const fileUrl = new URL(file, baseDir);
                return configFiles.has(fileUrl.href);
            }

            const extendedContext = {
                ...context,
                untouchedEntries,
                rendererCache: renderFunctionByContentType,
                fileToIdMap,
            };

            await Promise.all(
                files.map((entry) => {
                    if (isConfigFile(entry) || isInContentDir(entry)) {
                        return;
                    }
                    return limit(async () => {
                        const entryType = configForFile(entry);
                        await syncData(extendedContext, parsedPatterns, entry, baseDir, entryType);
                    });
                }),
            );

            untouchedEntries.forEach((id) => store.delete(id));

            if (!watcher) {
                return;
            }

            const matchers = parsedPatterns.map(p => micromatch.makeRe(p.glob));

            const matchesPattern = (entry: string) => !entry.startsWith('../') && matchers.some(m => m.test(entry));

            const basePath = fileURLToPath(baseDir);

            async function onChange(changedPath: string) {
                const entry = posixRelative(basePath, changedPath);
                if (!matchesPattern(entry)) {
                    return;
                }
                const entryType = configForFile(changedPath);
                const baseUrl = pathToFileURL(basePath);
                await syncData(extendedContext, parsedPatterns, entry, baseUrl, entryType);
                logger.info(`Reloaded data from ${green(entry)}`);
            }

            watcher.on('change', onChange);
            watcher.on('add', onChange);
            watcher.on('unlink', async (deletedPath) => {
                const entry = posixRelative(basePath, deletedPath);
                if (!matchesPattern(entry)) {
                    return;
                }
                const id = fileToIdMap.get(deletedPath);
                if (id) {
                    store.delete(id);
                    fileToIdMap.delete(deletedPath);
                }
            });
        },
    };
}