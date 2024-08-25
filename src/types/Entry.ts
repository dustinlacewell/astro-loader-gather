import { BaseSchema } from "astro:content"

export type Entry<S extends BaseSchema = any> = {
    id: string,
    data: Zod.infer<S>,
}