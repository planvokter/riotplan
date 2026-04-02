# riotprompt Override Utility

## Overview

The **Override** utility in riotprompt allows you to customize or replace parts of a prompt without altering the original prompt files. This is particularly useful in larger applications or frameworks (like Cortalyne) where you have default prompt templates but want to adjust certain sections for specific use cases, users, or environments. By using overrides, you can maintain a clean separation between **core prompt content** and **custom modifications**.

In essence, overrides let you **selectively replace or augment prompt sections**:

* You can completely **override** a section (replace it entirely with new content).
* You can **prepend** content (insert additional text before the original content).
* You can **append** content (insert additional text after the original content).

All of this is done without modifying the original prompt source file; instead, riotprompt will detect override files and merge or replace content accordingly when building the final prompt.

## Multi-Layered Override System

riotprompt supports **multi-layered overrides**, allowing you to define multiple levels of customization that build upon each other. This is particularly powerful when you need to support:

1. **Project-level customizations** (e.g., `./project/overrides`)
2. **User-level customizations** (e.g., `~/customization`)
3. **Environment-specific customizations** (e.g., `./config/prod`)

### Override Priority and Layering

When multiple override paths are provided, riotprompt processes them with a **closest-to-furthest** priority system:

- **Array order determines priority**: The first path in the `overridePaths` array has the highest priority (closest layer)
- **Complete overrides**: Only the **closest** override file replaces the original content
- **Prepend content**: Applied in **closest-first** order (closest layer appears first in the final content)
- **Append content**: Applied in **furthest-first** order (furthest layers appear first, closest layer appears last)

### Example Layering Scenario

Consider this configuration:

```ts
const builder = Builder.create({
  basePath: './prompts',
  overridePaths: ['./project', '~/customization'], // closest to furthest
  overrides: true
});
```

With these override files:

- `./project/personas/you-pre.md` (Level 1 - closest)
- `~/customization/personas/you-pre.md` (Level 2 - further)
- `./project/personas/you-post.md` (Level 1 - closest) 
- `~/customization/personas/you-post.md` (Level 2 - further)

**For prepend content (you-pre.md files):**
```
* Level 1 - Pre Content (from ./project)
* Level 2 - Pre Content (from ~/customization)  
* You Persona Content - Core
```

**For append content (you-post.md files):**
```
* You Persona Content - Core
* Level 2 - Post Content (from ~/customization)
* Level 1 - Post Content (from ./project)
```

**For complete overrides:**
If both `./project/personas/you.md` and `~/customization/personas/you.md` exist, only the closest override (`./project/personas/you.md`) will be used, completely replacing the original content.

## How Overrides Work

riotprompt's override system works by looking for specially-named files in an "override" directory that correspond to your prompt files. When you build a prompt (for example, using the Builder), you can specify an `overridePath` where your override files live and enable overrides.

For each prompt file loaded from the base path, riotprompt will check if there is a corresponding override file. The correspondence is determined by **filename and path**:

* If an override file with the *exact same name* exists in the override directory (mirroring the relative path of the original file), riotprompt will treat that as a **full override** for that prompt file.
* Additionally, riotprompt recognizes two suffix conventions for partial overrides:

  * A file ending in **`-pre.md`** is treated as content to **prepend** (placed before the base content).
  * A file ending in **`-post.md`** is treated as content to **append** (placed after the base content).

This naming scheme allows you to choose the override mode by how you name the file, without needing additional configuration in code for each file.

**Example:**

Suppose you have a base prompt file `prompts/instructions/email.md` that defines instructions for drafting an email. To modify this via overrides:

* Place a file at `overrides/instructions/email.md` – this will completely replace the content of `email.md` when overrides are applied.
* Place a file at `overrides/instructions/email-pre.md` – this will be inserted *before* the content of the base `email.md`.
* Place a file at `overrides/instructions/email-post.md` – this will be inserted *after* the content of the base `email.md`.

You can use none, one, or all of these in combination as needed. For instance, you might only have a `email-post.md` to add a few extra instructions at the end of the default email instructions, leaving the original content intact.

## Note on Path Configuration

When implementing overrides in a real-world application, the paths are often configured strategically:

* **basePath** is frequently constructed to point to content from a package, often using variables like `__dirname` to reference the location of the installed package. For example:

  ```ts
  import path from 'path';
  import { fileURLToPath } from 'url';

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const basePath = path.join(__dirname, '../prompts');
  ```

* **overridePaths** is typically configured using multiple directories for different levels of customization, which might include project-specific directories, user workspace directories, or environment-specific config locations:

  ```ts
  const overridePaths = [
    path.join(process.cwd(), 'config/prompts'),      // Project-level (closest)
    path.join(os.homedir(), '.app/prompt-overrides'), // User-level (further)
    '/etc/app/global-overrides'                      // System-level (furthest)
  ];
  ```

This setup creates a powerful pattern where library authors can ship applications with a set of default prompts (in the package's prompts directory), while allowing multiple layers of customization:

1. **Completely replacing** prompt content by providing override files with the same name in any layer
2. **Extending** the default prompts by adding content before or after using the `-pre.md` and `-post.md` conventions
3. **Layering customizations** where project-specific overrides take precedence over user-specific overrides, which take precedence over system-wide overrides

This approach maintains a clean separation between the library's default content, project customizations, user customizations, and system-wide modifications, making it easier to update the library without losing custom modifications at any level. It's particularly valuable in frameworks and tools that need to support team collaboration while still allowing individual developer preferences.

**Directory Structure:**

The override directory should mirror the structure of the base prompt directory. For example:

```
prompts/                 (base prompt files)
  instructions/
    email.md
    meeting.md

overrides/               (override files)
  instructions/
    email-pre.md      (prepends content to email.md instructions)
    email-post.md     (appends content to email.md instructions)
    meeting.md        (completely overrides meeting.md instructions)
```

When a prompt is configured, the Builder and Override utility will take the paths "instructions/email.md" and "instructions/meeting.md", and the library will change the extension from ".md" to "-pre.md" and "-post.md" when it is looking for override content.

In this scenario:

* For `email.md`, the builder will find an `email-pre.md` and `email-post.md`. It will prepend and append their content around `email.md`'s content. There is no `email.md` full override in the overrides directory, so the base content is still used (with the additions).
* For `meeting.md`, a full override file exists in overrides. That means the original `meeting.md` content will be entirely replaced by the content from the override file. (If there were also `meeting-pre.md` or `meeting-post.md`, those would be applied as well, but typically if you're fully overriding, you may not use pre/post for that file.)

## Enabling Overrides in Builder

If you are using the `Builder` to assemble prompts, you need to tell it to use the overrides. This is done via the `overridePaths` and `overrides` options in `Builder.create()`:

```ts
const builder = Builder.create({
  basePath: './prompts',
  overridePaths: ['./overrides', '~/personal-overrides'], // Array of override directories
  overrides: true
});
```

* `basePath` is where your base prompt files are located.
* `overridePaths` is an array of directories where your override files are located, ordered from closest (highest priority) to furthest (lowest priority).
* `overrides: true` enables the override functionality. (By default, riotprompt might ignore override files unless this flag is set. This is a safety feature to prevent accidental override of content.)

When `overrides` is true, the builder will incorporate any found override files as it loads prompt files. If you set override paths but `overrides` is false (or omitted), riotprompt will likely skip applying full overrides. (Prepend/append might still be applied, or they might also be ignored – typically you enable the flag when you intend to use any overrides.)

In applications like **Cortalyne**, a command-line flag is used (e.g. `--overrides`) to toggle this behavior. This maps to the `overrides: true` setting in the riotprompt builder.

## Using Override Utility Programmatically

While the common usage is via Builder configuration, riotprompt also provides lower-level capabilities to apply overrides if needed.

For example, there may be an `Override` class or methods that you can use on Section objects:

```ts
import { Override, createSection } from '@riotprompt';

// Suppose we have a base section created or loaded:
const baseSection = createSection("Instructions");
baseSection.add("Follow the company style guide.");
baseSection.add("Keep the email concise.");

// Create an Override instance with multiple config directories
const override = Override.create({
  configDirs: ['./project-overrides', './user-overrides'], // Array of directories
  overrides: true
});

// Customize the section using an override file path
await override.customize('instructions/email.md', baseSection);

// Now baseSection might have content prepended, appended, or completely replaced
// depending on what override files exist in the configured directories:
// - ./project-overrides/instructions/email.md (closest - full override)
// - ./user-overrides/instructions/email.md (furthest - full override, used only if closest doesn't exist)
// - ./project-overrides/instructions/email-pre.md (closest - prepend, applied first)
// - ./user-overrides/instructions/email-pre.md (furthest - prepend, applied second)
// - ./project-overrides/instructions/email-post.md (closest - append, applied last)
// - ./user-overrides/instructions/email-post.md (furthest - append, applied first after core content)

console.log(baseSection.items[0].text);
// Output depends on what override files exist and their layering
```

In this example, `override.customize` takes a file path string ('instructions/email.md'), a section object (baseSection), and optionally section options. Under the hood, this is what Builder would do when it finds override files.

Even if you don't call `Override` methods directly, understanding this helps – basically riotprompt will inject the override content at the appropriate place.

## Guidance for Structuring Overrides

When using overrides in your project, consider the following best practices:

* **Mirror File Structure**: Keep the override files in a parallel structure to the base prompt files. This makes it clear which base file each override is targeting. For example, if the base has `personas/agent.md`, put the override in `overrides/personas/agent.md` (or `agent-pre.md`/`agent-post.md` as needed).
* **Minimize Full Overrides**: Whenever possible, use prepend (`-pre.md`) or append (`-post.md`) files to adjust content, rather than completely overriding. Prepending/appending is less likely to break core functionality because you are adding to the existing prompt rather than replacing it. Use a full override (`same-name.md`) only when you need to substantially change or replace the entire content.
* **Use Overrides for Environment-Specific Tweaks**: If you have multiple deployment environments or user customizations, you can maintain different override directories or files for each case. For example, one override file could tweak the tone of instructions for a specific client without affecting the base prompt shared by others.
* **Test Overrides Thoroughly**: Because overrides can change the behavior of prompts, test with and without overrides enabled (if your app allows). Tools like Cortalyne have a debug mode to show final prompts after overrides – use that to ensure your override content is merging correctly.
* **Document Your Overrides**: Within your team or project, document what each override file is intended to do. Since they change default behavior, it's good to have a note (even within the file as a comment) about why the override exists.

## Example: Combining Base and Override Content

Let's walk through a concrete example. Imagine a base persona file `prompts/personas/assistant.md`:

```markdown
# Assistant Persona
- You are a helpful assistant with expertise in marketing.
- Your tone is friendly and professional.
```

Now suppose for a specific scenario we want the assistant to adopt a more formal tone, but we don't want to change the base file (since that is the default for other scenarios). We create an override file `overrides/personas/assistant-pre.md` with:

```markdown
- (Formal Override) Your tone is formal and courteous.
```

We also create `overrides/personas/assistant-post.md` with:

```markdown
- Always adhere to corporate communication guidelines.
```

We run our builder with overrides enabled. What happens?

* riotprompt loads the base `assistant.md` persona Section:

  * Title: "Assistant Persona"
  * Items:

    1. "You are a helpful assistant with expertise in marketing."
    2. "Your tone is friendly and professional."
* It finds `assistant-pre.md` and `assistant-post.md` in overrides for that path.
* The content from `assistant-pre.md` ("Your tone is formal and courteous.") is inserted at the **beginning** of the assistant persona's items (before the original items).
* The content from `assistant-post.md` ("Always adhere to corporate communication guidelines.") is inserted at the **end** of the items list.
* The resulting Section "Assistant Persona" now has:

  1. "(Formal Override) Your tone is formal and courteous."
  2. "You are a helpful assistant with expertise in marketing."
  3. "Your tone is friendly and professional."
  4. "Always adhere to corporate communication guidelines."

Notice how the original content was not removed – we only added to it in this case. If we had provided an `assistant.md` in the override directory (a full override), then none of the original items would be kept (they would be replaced entirely by whatever is in that override file).

This mechanism is powerful for tweaking behavior on the fly.

## Using Parameters with Overrides

The Override utility supports dynamic content customization through parameters. Parameters allow you to define placeholders in your prompt text (e.g., `{{variable}}`) that get replaced with specific values when the prompt is processed. This creates even more flexibility in your override files.

### Example: Dynamic Overrides with Parameters

Consider a scenario where you want to customize a chatbot persona for different clients while maintaining a consistent base structure. You can use parameters in your override files to achieve this:

```ts
import { Override, createSection, createParameters } from '@riotprompt';

// Create a base assistant persona
const assistantPersona = createSection("Assistant Persona");
assistantPersona.add("You are a helpful customer service AI.");
assistantPersona.add("You provide clear, accurate information.");

// Create parameters for client-specific customization
const clientParameters = createParameters({
  clientName: "Acme Corporation",
  industry: "manufacturing",
  supportEmail: "support@acme.com"
});

// Create an override instance with parameters
const override = Override.create({
  configDir: './overrides',
  overrides: true,
  parameters: clientParameters
});

// Apply client-specific overrides with parameter substitution
await override.customize('personas/assistant.md', assistantPersona);
```

Now in your override file `./overrides/personas/assistant-post.md`, you can use those parameters:

```markdown
- You are assisting {{clientName}}, a company in the {{industry}} industry.
- For additional support, direct customers to {{supportEmail}}.
```

When processed, the placeholders will be replaced with the actual values provided in the parameters, resulting in:

```
# Assistant Persona
- You are a helpful customer service AI.
- You provide clear, accurate information.
- You are assisting Acme Corporation, a company in the manufacturing industry.
- For additional support, direct customers to support@acme.com.
```

This approach allows you to:
1. Maintain a clean separation between core prompt content and customizations
2. Dynamically update client-specific information without editing the override files
3. Reuse the same override files with different parameter sets for various clients or environments

When combined with environment variables or configuration files, this creates a powerful system for maintaining context-aware prompts that can be tailored for different scenarios without duplicating content.


## Configuring Logging

The Override utility supports custom logging to help debug override operations. When creating an Override instance, you can supply a `logger` property in the options:

```ts
import { Override, Logger } from '@riotprompt';

// Create a custom logger
const myLogger: Logger = {
  debug: (message, ...args) => myCustomLogging.debug(message, args),
  info: (message, ...args) => myCustomLogging.info(message, args),
  warn: (message, ...args) => myCustomLogging.warn(message, args),
  error: (message, ...args) => myCustomLogging.error(message, args),
  verbose: (message, ...args) => myCustomLogging.verbose(message, args),
  silly: (message, ...args) => myCustomLogging.silly(message, args)
};

// Use custom logger with Override
const override = Override.create({
  configDir: './overrides',
  overrides: true,
  logger: myLogger
});
```

> **Note:** You don't have to create your own logger. This interface matches the default Winston logger interface, so you can directly use Winston loggers with riotprompt.

The `Logger` interface requires six methods:

```ts
interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  verbose: (message: string, ...args: any[]) => void;
  silly: (message: string, ...args: any[]) => void;
}
```

If you don't provide a logger, riotprompt uses a default logger that maps these methods to the corresponding `console` methods (`console.debug`, `console.info`, etc.), with `verbose` and `silly` both mapping to `console.log`.

The logger helps you track:
- When override files are found
- Which override files are being applied
- When content is being prepended, appended, or replaced
- The final content after all overrides are applied

This is particularly useful during development and troubleshooting to understand exactly how your overrides are being applied to your prompt content.


## Conclusion

The Override utility makes riotprompt flexible and extensible:

* It enables on-the-fly customization of prompt content.
* It supports complex use cases like user-specific or context-specific prompt adjustments, all while keeping base prompts clean and general.
* When building applications (like Cortalyne) on top of riotprompt, consider exposing an override mechanism to your end users or for your configurations. This way, you can ship a set of robust default prompts and still allow modifications without editing those core files.

By following a consistent override pattern (filename matching and pre/post suffixes) and using the Builder's override support, you can manage prompt variations systematically and safely.

