# RiotPlan Documentation Site

Documentation website for RiotPlan - Framework for long-lived, stateful AI workflows.

## Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Visit http://localhost:5173/riotplan/

## Build

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Structure

- `src/` - React application source
  - `components/` - React components
  - `App.tsx` - Main app with routing and doc sections
- `dist/` - Markdown documentation files
- `public/` - Static assets
- `vite.config.ts` - Vite configuration

## Documentation Files

All documentation is in Markdown format in the `dist/` directory:

- `getting-started.md` - Quick start guide
- `core-concepts.md` - Understanding plans and steps
- `plan-structure.md` - Plan directory anatomy
- `creating-plans.md` - How to create plans
- `managing-steps.md` - Working with steps
- `cli-*.md` - CLI command documentation
- `api-reference.md` - API documentation
- `programmatic-usage.md` - Using RiotPlan in code
- `status-format.md` - STATUS.md format details
- `credits.md` - Credits and acknowledgments

## Adding Documentation

1. Create a new `.md` file in `dist/`
2. Add entry to `DOC_SECTIONS` in `src/App.tsx`:

```typescript
{
  id: 'my-new-doc',
  title: 'My New Doc',
  file: 'my-new-doc.md',
  description: 'Description of the document',
  category: 'guide' // or 'command', 'api'
}
```

3. Write the markdown content
4. Test locally with `npm run dev`

## Deployment

The site is configured for GitHub Pages deployment at `/riotplan/`.

To deploy:

1. Build the site: `npm run build`
2. Copy `dist/` contents to your GitHub Pages branch
3. Commit and push

The `base` path in `vite.config.ts` is set to `/riotplan/` for GitHub Pages.

## License

Apache-2.0
