import { promises as fs } from 'node:fs';

import { ContentEntryRenderFunction, ContentEntryType } from "astro"
import type { AstroConfig, AstroIntegrationLogger } from 'astro'

import { fileURLToPath } from "url"
import { posixRelative } from "./utils.js"
import { ParsedPattern } from './types/ParsedPattern.js'
import { BaseSchema } from 'astro:content'
import { Entry } from './types/Entry.js'

type RenderedContent = any

export type SyncContext<E extends Entry> = {
    config: AstroConfig
    logger: AstroIntegrationLogger
    watcher: any
    parseData: <TData extends Record<string, unknown>>(props: { id: string; data: TData; filePath: string }) => Promise<TData>
    store: any
    generateDigest: (contents: string) => string
    entryTypes: Map<string, ContentEntryType>
    untouchedEntries: Set<string>
    rendererCache: WeakMap<ContentEntryType, ContentEntryRenderFunction>
    fileToIdMap: Map<string, string>
    transform?: (e: E) => E
}

export async function syncData<E extends Entry>(context: SyncContext<E>, parsedPatterns: ParsedPattern[], entry: string, base: URL, entryType?: ContentEntryType) {
    const { config, logger, parseData, store, generateDigest, untouchedEntries, rendererCache, fileToIdMap } = context

    if (!entryType) {
        logger.warn(`No entry type found for ${entry}`)
        return
    }
    const fileUrl = new URL(entry, base)
    const contents = await fs.readFile(fileUrl, 'utf-8').catch((err) => {
        logger.error(`Error reading ${entry}: ${err.message}`)
        return
    })
    if (!contents) {
        logger.warn(`No contents found for ${entry}`)
        return
    }

    const { body, data: frontmatter } = await entryType.getEntryInfo({
        contents,
        fileUrl,
    })

    const relativePath = posixRelative(fileURLToPath(config.root), fileURLToPath(fileUrl))
    const matchingPattern = parsedPatterns.find(({ regex }) => regex.test(relativePath))
    if (!matchingPattern) {
        logger.warn(`No matching pattern found for ${entry}`)
        return
    }

    const captures = matchingPattern.regex.exec(relativePath)?.groups || {}

    if (!('id' in captures)) {
        logger.error(`No 'id' capture group found in pattern for ${entry}`)
        return
    }

    let id = captures.id
    delete captures.id

    untouchedEntries.delete(id)

    const existingEntry = store.get(id)

    const digest = generateDigest(contents)

    if (existingEntry && existingEntry.digest === digest && existingEntry.filePath) {
        if (existingEntry.deferredRender) {
            store.addModuleImport(existingEntry.filePath)
        }

        if (existingEntry.rendered?.metadata?.imagePaths?.length) {
            (store as any).addAssetImports(
                existingEntry.rendered.metadata.imagePaths,
                existingEntry.filePath,
            )
        }
        fileToIdMap.set(fileURLToPath(fileUrl), id)
        await parseData(existingEntry)
        return
    }

    const dataToParse = { ...frontmatter, ...captures, ...matchingPattern.metadata }
    const untransformedData = { id, data: dataToParse } as E
    const transformedData = await context.transform?.(untransformedData) || untransformedData
    id = String(transformedData.id)

    const parsedData = await parseData({
        id,
        data: transformedData.data,
        filePath: relativePath,
    })

    if (entryType.getRenderFunction) {
        let render = rendererCache.get(entryType)
        if (!render) {
            render = await entryType.getRenderFunction(config as any)
            rendererCache.set(entryType, render)
        }
        let rendered: RenderedContent | undefined = undefined

        try {
            // @ts-ignore
            rendered = await render?.({
                id,
                data: parsedData,
                body,
                filePath: relativePath,
                digest,
            })
        } catch (error: any) {
            logger.error(`Error rendering ${entry}: ${error.message}`)
        }

        store.set({
            id,
            data: parsedData,
            body,
            filePath: relativePath,
            digest,
            rendered,
        })
        if (rendered?.metadata?.imagePaths?.length) {
            (store as any).addAssetImports(rendered.metadata.imagePaths, relativePath)
        }
    } else if ('contentModuleTypes' in entryType) {
        store.set({
            id,
            data: parsedData,
            body,
            filePath: relativePath,
            digest,
            deferredRender: true,
        })
    } else {
        store.set({ id, data: parsedData, body, filePath: relativePath, digest })
    }

    fileToIdMap.set(fileURLToPath(fileUrl), id)
}