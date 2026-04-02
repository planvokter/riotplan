import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DocPage from './components/DocPage'
import './App.css'

const DOC_SECTIONS = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        file: 'getting-started.md',
        description: 'Quick start guide and installation',
        category: 'guide'
    },
    {
        id: 'core-concepts',
        title: 'Core Concepts',
        file: 'core-concepts.md',
        description: 'Understanding Plans, Steps, and STATUS.md',
        category: 'guide'
    },
    {
        id: 'plan-structure',
        title: 'Plan Structure',
        file: 'plan-structure.md',
        description: 'Anatomy of a plan directory',
        category: 'guide'
    },
    {
        id: 'creating-plans',
        title: 'Creating Plans',
        file: 'creating-plans.md',
        description: 'How to create and initialize plans',
        category: 'guide'
    },
    {
        id: 'managing-steps',
        title: 'Managing Steps',
        file: 'managing-steps.md',
        description: 'Working with plan steps',
        category: 'guide'
    },
    {
        id: 'cli-usage',
        title: 'CLI Overview',
        file: 'cli-usage.md',
        description: 'Command Line Interface overview',
        category: 'command'
    },
    {
        id: 'cli-plan',
        title: 'plan',
        file: 'cli-plan.md',
        description: 'Initialize and manage plans',
        category: 'command'
    },
    {
        id: 'cli-status',
        title: 'status',
        file: 'cli-status.md',
        description: 'Check plan status and progress',
        category: 'command'
    },
    {
        id: 'cli-step',
        title: 'step',
        file: 'cli-step.md',
        description: 'Manage plan steps',
        category: 'command'
    },
    {
        id: 'cli-feedback',
        title: 'feedback',
        file: 'cli-feedback.md',
        description: 'Create and manage feedback records',
        category: 'command'
    },
    {
        id: 'api-reference',
        title: 'API Reference',
        file: 'api-reference.md',
        description: 'Complete API documentation',
        category: 'api'
    },
    {
        id: 'programmatic-usage',
        title: 'Programmatic Usage',
        file: 'programmatic-usage.md',
        description: 'Using riotplan in your code',
        category: 'api'
    },
    {
        id: 'status-format',
        title: 'STATUS.md Format',
        file: 'status-format.md',
        description: 'Understanding the STATUS.md file',
        category: 'api'
    },
    {
        id: 'mcp-overview',
        title: 'MCP Overview',
        file: 'mcp-overview.md',
        description: 'Model Context Protocol integration',
        category: 'mcp'
    },
    {
        id: 'mcp-tools',
        title: 'MCP Tools',
        file: 'mcp-tools.md',
        description: 'All available MCP tools',
        category: 'mcp'
    },
    {
        id: 'mcp-resources',
        title: 'MCP Resources',
        file: 'mcp-resources.md',
        description: 'Read-only data access',
        category: 'mcp'
    },
    {
        id: 'mcp-prompts',
        title: 'MCP Prompts',
        file: 'mcp-prompts.md',
        description: 'Workflow templates',
        category: 'mcp'
    },
    {
        id: 'credits',
        title: 'Credits',
        file: 'credits.md',
        description: 'Acknowledgments'
        // No category means it won't appear in the main nav
    }
];

function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
                <Route path="/" element={<Layout docSections={DOC_SECTIONS} />}>
                    <Route index element={<DocPage docSections={DOC_SECTIONS} />} />
                    <Route path=":slug" element={<DocPage docSections={DOC_SECTIONS} />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
