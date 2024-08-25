# astro-loader-gather

A loader for [Astro](https://astro.build/)'s [Content Layer](https://astro.build/blog/astro-4140/#experimental-content-layer-api) ([RFC](https://github.com/withastro/roadmap/blob/content-layer/proposals/0047-content-layer.md#loaders)) similar to the built-in [glob loader](https://github.com/withastro/roadmap/blob/content-layer/proposals/0047-content-layer.md#built-in-loaders) with some extensions for extracting metadata from filesystem paths.

Most of the credit goes to the contributors to the built-in glob loader, this is a relatively small change ontop.


```ts
const posts = defineCollection({
  loader: gather({
    base: "src/data/",
    patterns: [
      // standalone posts - fixed type and group
      ["blog/{{id}}.(md|mdx)", { type: 'normal', group: 'none'}],
      // articles in a series - group comes from folder name!
      ["articles/{{group}}/{{id}}.(md|mdx)", { type: 'series'}],
      // news posts for projects - group comes from folder name!
      ["projects/{{group}}/news/{{id}}.(md|mdx)", { type: 'projects'}],
    ],
  }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['projects', 'series', 'normal']),
    group: z.string(),
    // etc...
  }),
})
```

In this example, we have a single content type "posts" -- but three different *kinds* of posts:
- standalone blog posts
- articles in a series
- project-specific news

With `astro-loader-gather`, you can keep all your content more logically co-located while associating the metadata you'll need later for filtering and showing the right data in the right context.

We may want to show all posts regardless of type at `/blog` but only a project's news at `/project/foo/news`.

# Installation

    npm i @ldlework/astro-loader-gather

# Configuration

The `gather()` function takes an object with two properties:
- `base`: the root path of your content
- `patterns`: an array of patterns relative to the root
- `transform`: *optional* callback for modifying entries


## Core Behavior

For details on how content is rendered, validated, cached, etc, see the documentation for the built-in [glob loader](https://github.com/withastro/roadmap/blob/content-layer/proposals/0047-content-layer.md#built-in-loaders).


## Gather Patterns

The most simple pattern is simply a glob, like those supported by [fast-glob](https://www.npmjs.com/package/fast-glob):

```ts
gather({
    base: "src/data",
    patterns: [
        `*.(md|mdx)`,
        `posts/**/*.md`,
        // etc
    ]
})
```

### Capture Syntax

You can capture elements of the filesystem path into the metadata of content entries by surrounding a path element in double `{{}}` curly-braces:

```ts
gather({
    base: "src/data",
    patterns: [
        `projects/{{projectName}}/news/*.md`
    ]
})
```

In this example, `{{projectName}}` behaves like a glob wildcard `*`. Any matched directory will be assigned to the `entry.data.projectName` metadata attribute. Neat!

### Static Metadata

You can associate static metadata with each pattern by specifying that pattern as a `[string, object]` tuple instead. The object will be merged into the metadata of any entries matched by this pattern.

This makes it easy to know later on, which specific pattern was used to source an entry:

```ts
gather({
  base: "src/data"
  patterns: [
    ["posts/*.md", { type: 'normal' }],
    ["projects/{{projectName}}/news/*.md", { type: 'news' }]
  ]
})

const posts = await getCollection('posts')
const news = posts.filter(p => p.type === 'news')
```

## Metadata Transformations

If you need to pre-process your entry metadata before it gets validated then you can use the `transform` callback:

```ts
gather({
  base: "src/data",
  patterns: [ "somedata.json" ],
  transform: e => ({ 
    ...e, 
    data: { 
      ...e.data, 
      slug: slugify(e.data.name) 
    }
  })
})
```

### Type-safe Transforms

To make your transform functions type-safe, trade `defineCollection` with `gatherCollection`:

```ts
const someCollection = gatherCollection({
  options: {
    base: "src/data",
    patterns: [ "somedata.json" ],
    transform: e => ({ 
      ...e, 
      data: { 
        ...e.data, 
        slug: slugify(e.data.name) 
      }
    })
  },
  schema: z.object({
    name: z.string(),
    slug: z.string(),
  })
})
```