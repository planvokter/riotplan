# riotprompt Loader Utility

## Overview

The **Loader** utility in riotprompt is designed to import prompt content from the filesystem. It can take a directory (or multiple directories) of Markdown files and convert them into riotprompt sections or items. This is especially useful for managing large or modular prompt structures, where different parts of the prompt (personas, instructions, context, etc.) are kept in separate files for clarity and reusability.

By using the Loader, you can:

* **Organize Prompts as Files**: Keep complex prompts as separate markdown files (e.g., one file per persona, or per context topic).
* **Reuse Content**: Share and reuse prompt segments across projects by simply loading the files.
* **Keep Code and Prompts Separate**: Your application code can load prompt content at runtime, making it easier to update prompts without changing code.
* **Scale to Many Context Files**: Effortlessly include a large number of context snippets or knowledge base files as part of the prompt by placing them in a context directory and loading them all.

> **NOTE:** This was originally designed to support loading context from a directory of Markdown files. For example, if you are analyzing emails, you might want to have a directory named "./context/projects" that contains a series of Markdown files that give context about different projects.


## How the Loader Transforms Files

The Loader works together with the Parser under the hood. When you point the Loader at a directory, it will:

1. **Scan the Directory**: It finds all files in the specified directory (not including subdirectories). The Loader is agnostic about file extensions and processes all files in the directory.
2. **Read each File**: For each file found, the Loader reads its content from disk.
3. **Parse Content into Sections**: If any of the files are Markdown (ending in .md), the Loader uses the Parser to convert the Markdown content of the file into a Section (or items). Crucially, the Loader will strip out the first heading from the file from the content and use it as the section title if a heading is present. If a particular file does not contain Markdown, a section will be added for the file with the name of the file as the Section title.

   * If the file content begins with a heading (e.g., `# Title`), that heading is used as the Section's title and is not duplicated in the Section's items.
   * The rest of the file's content becomes the body (items) of that Section.
   * If a file does not contain an explicit top-level heading, the Loader can optionally use the filename (or a provided default) as the section title, or simply treat all content as belonging to an unnamed section.
4. **Aggregate or Return Sections**: The Loader then returns the structured content from all files. You can choose to combine these sections into a larger Section (for example, a single "Context" section containing multiple subsections), or handle them individually.

This approach means you can, for example, have a directory of background context files and load them all at once, without manually copying and pasting their content into one big prompt string.

## Using the Loader

Typically, you'll create a Loader instance via its factory method and then call methods to load files or directories. For example:

```ts
import { Loader, Section } from '@riotprompt';

// Create a Loader instance
const loader = Loader.create();

// Load all markdown files from a directory (e.g., the "context" folder)
const contextSections: Section<Context>[] = await loader.load<Context>(['./prompts/context']);

// contextSections is an array of Section objects, one per markdown file in the directory.
console.log(`Loaded ${contextSections.length} context sections.`);
```

In this snippet, `loader.load<Context>(['./prompts/context'])` will find all markdown files under `./prompts/context`. Suppose the folder structure is:

```
prompts/
  context/
    project-alpha.md
    project-beta.md
```

And the files contain:

* **project-alpha.md**:

  ```
  # Project Alpha

  Details about Project Alpha...
  ```

* **project-beta.md**:

  ```
  # Project Beta

  Information on Project Beta...
  ```

After running the loader:

* `contextSections[0]` will be a Section titled "Project Alpha", containing the text "Details about Project Alpha..." as its content (as an item in that section).
* `contextSections[1]` will be a Section titled "Project Beta", with "Information on Project Beta..." as its content.

Each file became its own Section, using the first line header as the title.

### Loading Multiple Directories or Mixed Content

You can call `load` multiple times or even use Loader methods to load individual files. The riotprompt **Builder** provides higher-level methods (like `loadContext` or `loadContent`) which can take an array of directories or file paths and internally use the Loader to gather them.

For example, using the Builder (which internally leverages the Loader):

```ts
import { Builder, Prompt } from '@riotprompt';

const builder = Builder.create({
  basePath: './prompts'
});
const prompt: Prompt = await builder
  .addInstructionPath('instructions/code-review.md')
  .loadContext(['./prompts/context', './prompts/additional-context'])
  .build();
```

In this example, `builder.loadContext([...])` will use the Loader to load all Markdown files from the two specified directories (`./prompts/context` and `./prompts/additional-context`), combining them appropriately into the prompt's context section. You don't have to manually instantiate `Loader` here because `Builder` does it for you.

However, if you want fine-grained control, you can use `Loader` directly. For instance, you might want to load a directory of context files, filter or modify them, and then insert them into different parts of the prompt.

> NOTE: The Builder example above uses a single `basePath` for simplicity. In most real-world use cases, you'll likely want to include an `overridePath` as well, which allows for customization of prompts without modifying the original files.


**Example – Direct Loader usage:**

```ts
const loader = Loader.create();
// Load persona definitions from a directory
const personaSections: Section<Instruction>[] = await loader.load<Instruction>(['./prompts/personas']);
// Load context files from multiple directories
const peopleContext: Section<Context>[] = await loader.load<Context>(['./prompts/context/people']);
const projectContext: Section<Context>[] = await loader.load<Context>(['./prompts/context/projects']);

// You can now, for example, combine these:
const combinedContext = createSection<Context>("Context");
for (const sec of [...peopleContext, ...projectContext]) {
  combinedContext.add(sec);
}
```

In this example, we manually loaded personas and context from different folders and then merged the context sections into a single Section called "Context". (Note: riotprompt might provide utility methods for combining sections, but doing it manually as shown is also straightforward.)

### Example Folder Structure

To illustrate a larger setup, imagine your `./prompts` directory is organized as follows:

```
prompts/
  personas/
    developer.md
    manager.md
  instructions/
    code-review.md
    summarize.md
  content/
    example-request.md
  context/
    project/
      alpha.md
      beta.md
    team/
      team-info.md
```

* **Personas** directory contains persona profiles (e.g., "developer" persona, "manager" persona).
* **Instructions** directory contains different sets of instructions (for different tasks like code review, summarization).
* **Content** might contain user prompts or example content pieces.
* **Context** is further divided into subfolders (e.g., project-specific context files, team info files).

Using Loader (via Builder or directly), you can easily load all relevant pieces:

* `loader.load<Instruction>(['./prompts/personas'])` yields an array of persona Sections.
* `loader.load<Instruction>(['./prompts/instructions'])` yields Sections for each set of instructions.
* `loader.load<Context>(['./prompts/context/project'])` and `loader.load<Context>(['./prompts/context/team'])` yield context Sections which you might then combine.



### Loader Options

The Loader's `create` method may allow some configuration as well. Common configurations include:

* **File Extensions**: The Loader is agnostic about file extensions and will include all files in the specified directory. There is one special file, `content.md`, which is parsed first and supplies instructions for the section that will contain sections for each of the included files. Additionally, any file with a `.md` extension will have its first header parsed to set the title of the resulting Section. You do not need to configure file extensions; the Loader handles all files appropriately based on their extension.
* **Non-Recursive Directory Scanning**: The `load()` method only processes files in the immediate directories specified in the array. It does not automatically traverse subdirectories. If you need to process files in subdirectories, you must explicitly include those subdirectory paths in the array passed to `load()`. For example, to load files from both `./prompts/context/project` and `./prompts/context/team`, you would need to call `load(['./prompts/context/project', './prompts/context/team'])`.
* **Ignore Patterns**: You can provide an array of regular expression strings via the `ignorePatterns` option in the `Options` interface. Files matching any of these patterns will be excluded from processing. This is useful for ignoring hidden files, temporary files, or specific file types you don't want to load. By default, the Loader uses the following patterns to ignore common non-content files:
    * `^\\..*`: Ignores hidden files (e.g., `.git`, `.DS_Store`).
    * `\\.(jpg|jpeg|png|gif|bmp|svg|webp|ico)$`: Ignores common image file extensions.
    * `\\.(mp3|wav|ogg|aac|flac)$`: Ignores common audio file extensions.
    * `\\.(mp4|mov|avi|mkv|webm)$`: Ignores common video file extensions.
    * `\\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$`: Ignores common document file formats that are typically binary.
    * `\\.(zip|tar|gz|rar|7z)$`: Ignores common compressed file extensions.
  You can override these defaults by passing your own array of regex strings to `ignorePatterns`.
* **Parameters**: Similar to the Parser, the Loader might accept a `Parameters` object if you want to substitute placeholders in all loaded files. Another approach is to pass `parameters` into the Builder (so that after loading, when formatting, those parameters are applied).

### Parameterized Content Loading

The Loader supports parameterized content through the `parameters` option in the `Options` interface. This allows you to define variables in your markdown files and have them replaced with actual values when the content is loaded.

Here's how to use this feature:

```ts
import { Loader, Section } from '@riotprompt';

// Create a Loader with parameters
const loader = Loader.create({
  parameters: {
    projectName: "Alpha Project",
    clientName: "Acme Corporation",
    deadline: "December 31, 2023"
  }
});

// Load content that contains variables
const contextSections: Section<Context>[] = await loader.load<Context>(['./prompts/context']);
```

In this example, any markdown file in the `./prompts/context` directory can include variables like `{{projectName}}`, `{{clientName}}`, or `{{deadline}}`, and they will be replaced with the corresponding values when loaded.

For instance, if one of your files contains:

```markdown
# {{projectName}} Overview

This document provides key information about {{projectName}} for {{clientName}}.
The project has a delivery deadline of {{deadline}}.
```

After loading, this content would be transformed to:

```markdown
# Alpha Project Overview

This document provides key information about Alpha Project for Acme Corporation.
The project has a delivery deadline of December 31, 2023.
```

This parameterization feature is extremely useful for:

* Creating reusable template prompts
* Injecting dynamic values into your prompts at runtime
* Maintaining a single source of truth for key information across multiple prompt files

You can change the parameters for each Loader instance, allowing you to generate different versions of the same prompt templates for different scenarios.

### Purpose and Best Practices

Using Loader helps manage large prompts by breaking them into maintainable pieces:

* **Separation of Concerns**: Keep each logical part of the prompt in its own file (e.g., persona definitions, instructional prompts, background context). This makes editing and reviewing prompts easier.
* **Dynamic Inclusion**: You can decide at runtime which files or directories to load. For instance, load different instruction sets based on user input or context (by pointing Loader to different folders).
* **Reusability**: If multiple applications or multiple parts of your application need the same prompt content, having them in files that the Loader can pull in avoids duplication in code.

In summary, the Loader utility bridges the gap between your prompt files on disk and the in-memory structures that riotprompt uses. It handles the heavy lifting of reading files and parsing Markdown, so you can assemble your final prompt by simply organizing files and calling load functions. This results in a cleaner project structure and easier prompt maintenance.

