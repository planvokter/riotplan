# riotprompt Parser Utility

## Overview

The **Parser** utility in riotprompt allows you to convert Markdown content into riotprompt's structured prompt format. This means you can write prompt sections, instructions, and context in a Markdown file (using headings, lists, etc.) and then use the Parser to turn that into riotprompt Section objects. By using the Parser, you focus on writing clear prompt text in Markdown, while riotprompt handles building the internal structure (sections and items) for you.

Key capabilities of the Parser include:

* **Markdown to Sections**: Automatically interpreting markdown headers as section titles and text as section content.
* **Nested Structure**: Handling nested headers (e.g. `#`, `##`, `###`) by creating nested Section structures.
* **List Items**: Treating bullet or numbered list items as individual items in a section.
* **Paragraph Separation**: Treating separate paragraphs (separated by blank lines) as distinct items.

This makes it easy to draft complex prompts in a markdown document and programmatically load them into your application.

## Creating a Parser

To use the Parser, import it from the riotprompt library and create an instance. riotprompt uses a factory method pattern; you create a Parser via the static `Parser.create()` method. The `create` method can accept an optional configuration object to adjust parsing behavior.

**Syntax:**

```ts
const parser = Parser.create(options?);
```

If no options are provided, the parser will use default behavior that suits most use cases (detailed below).

### Parser.create Options

When calling `Parser.create`, you can supply an object to customize its behavior. All options are optional. Here are the options available for the Parser's creation:

* **`logger`** (Logger): An optional logger object for receiving information about the parsing process.
* **`parameters`** (Parameters object): A **Parameters** object containing placeholder values to substitute into the text while parsing. If provided, any placeholders in the form `{{variable}}` found in the markdown content will be replaced with the corresponding values from this object as the parser constructs the items.

### Using the Parser

Once you have a Parser instance, use the `parse` method to convert a markdown string (or file content) into a Section structure. The result of `parser.parse(...)` is usually a `Section` object representing the top-level section (or a container section) of the parsed content.

**Example:** Parse a markdown string with multiple sections.

```ts
import { Parser, Section } from '@riotprompt';

const markdownContent = `
# Instructions
Follow these guidelines when writing code.

## Best Practices
- Keep functions small and focused  
- Use meaningful variable names

## Documentation
- Comment complex logic  
- Document public APIs thoroughly
`;

// Create a Parser (with default options)
const parser = Parser.create();

// Parse the markdown into a Section structure
const rootSection: Section = parser.parse(markdownContent);

// The rootSection now represents "Instructions" with two subsections inside.
console.log(rootSection.title); 
// Output: "Instructions"

// Accessing subsections by index:
const bestPractices = rootSection.items[1] as Section;
console.log(bestPractices.title); 
// Output: "Best Practices"

// Items within a section:
for (const item of bestPractices.items) {
  console.log(item.text);
}
// Output:
// "Keep functions small and focused"
// "Use meaningful variable names"
```

In this example:

* The top-level `# Instructions` became a Section titled "Instructions" (`rootSection`).
* The content under "Instructions" before any sub-heading (`"Follow these guidelines when writing code."`) became the first item of `rootSection`.
* The `## Best Practices` line created a subsection (another Section) within Instructions.
* Each bullet point under "Best Practices" became a separate item in that subsection.
* Similarly, `## Documentation` became another subsection with its own list of items.

You can now manipulate these sections in code. For instance, you might add another item:

```ts
bestPractices.add("- Write tests for your code");
```

This appends a new bullet item under "Best Practices". The parser makes it easy to initialize complex structures, which you can then modify or combine with other sections.

### Parsing Files Directly

The Parser provides a convenient `parseFile` method to directly parse Markdown files from disk:

```ts
const section = parser.parseFile('./prompts/instructions/code-style.md');
console.log(`Parsed section titled: ${section.title}`);
```

This method handles reading the file and parsing its content in a single step, making it easier to load prompt content from files.

If you prefer to read files manually, you can still use the standard `parse` method:

```ts
import * as fs from 'fs';
const fileText = fs.readFileSync('./prompts/instructions/code-style.md', 'utf-8');
const parser = Parser.create({ 
  logger: console
});
const section = parser.parse(fileText);
console.log(`Parsed section titled: ${section.title}`);
```

This will read a markdown file from the filesystem and parse it into a Section. The example provides a simple logger to track the parsing process.

## Notes and Tips

* **Headings as Structure**: The Parser treats Markdown headings (`#`, `##`, etc.) as structural markers. Ensure your markdown content uses headings for logical sections you want to separate in the prompt. Text that is not under any heading will be grouped under an implicit section.
* **Lists and Paragraphs**: Bullet lists (`- ` or `* ` or numbered lists) are split into individual items. Normal paragraphs separated by blank lines are also treated as separate items. This means in the final Section object, each bullet or paragraph is one `Instruction`, `Content` or `Context` item (depending on usage).
* **Markdown Formatting**: The parser handles basic Markdown syntax, converting it into an internal structure. The formatting style (whether using tags or markdown) will be handled by the Formatter when producing the final prompt string.
* **Combining with Formatter**: The Parser simply builds the internal representation. To get a prompt string to send to an LLM, you would pass the resulting Section into a `Formatter`. Formatter will apply formatting options (like using XML-style tags or Markdown headings) to produce the final prompt text. For example, `Formatter.create().format(section)`.

Using the Parser utility, you can maintain your prompt content in easy-to-edit markdown files or strings, and reliably construct structured prompt objects for further manipulation or formatting.

