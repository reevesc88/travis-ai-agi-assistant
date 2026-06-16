```markdown
# travis-ai-agi-assistant Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns, coding conventions, and collaborative workflows used in the `travis-ai-agi-assistant` repository. The project is a TypeScript codebase built with the Vite framework, focusing on modular agent skills, clear documentation, and maintainable code structure. It emphasizes consistent file naming, import/export styles, and structured workflows for adding skills and updating project memory.

## Coding Conventions

**File Naming**
- Use `kebab-case` for all file and directory names.
  - Example: `agent-core.ts`, `user-profile.test.ts`

**Import Style**
- Use relative imports for modules within the project.
  - Example:
    ```typescript
    import { AgentCore } from './agent-core';
    import { SkillUtils } from '../utils/skill-utils';
    ```

**Export Style**
- Use named exports for all modules.
  - Example:
    ```typescript
    // agent-core.ts
    export function AgentCore() { ... }
    export const AGENT_VERSION = '1.0.0';
    ```

**Commit Patterns**
- Commit messages are freeform, sometimes with prefixes, averaging around 60 characters.

## Workflows

### Agent Skill Addition or Update
**Trigger:** When introducing new agent skills or updating existing ones for the AI assistant platform  
**Command:** `/add-skill`

1. Create or update `SKILL.md` and related documentation files in `.agents/skills/<skill-name>/`.
2. Add or update scripts (e.g., TypeScript, Python, JS) in `.agents/skills/<skill-name>/scripts/`.
3. Add or update references and supporting assets (images, data, schemas) in `.agents/skills/<skill-name>/references/` or `assets/`.
4. Update `LICENSE.txt` and metadata files as needed.

**Example Directory Structure:**
```
.agents/
  skills/
    my-new-skill/
      SKILL.md
      README.md
      scripts/
        main.ts
      references/
        schema.json
      assets/
        icon.png
      metadata.json
      LICENSE.txt
```

**Example Step:**
```typescript
// .agents/skills/my-new-skill/scripts/main.ts
export function runSkill(input: string): string {
  // Skill logic here
  return `Processed: ${input}`;
}
```

---

### Project Memory Update
**Trigger:** When documenting project status, decisions, or updating onboarding/workflow preferences  
**Command:** `/update-memory`

1. Edit or update markdown files in `project-memory/` (e.g., `AGENT_INSTRUCTIONS.md`, `NEXT_ACTIONS.md`, `ENVIRONMENT_STATUS.md`).
2. Commit changes to keep project documentation up to date.

**Example:**
```
project-memory/
  AGENT_INSTRUCTIONS.md
  NEXT_ACTIONS.md
  ENVIRONMENT_STATUS.md
```

**Sample Update:**
```markdown
# NEXT_ACTIONS.md

- [x] Refactor agent skill loader
- [ ] Add documentation for new memory workflow
```

## Testing Patterns

- Test files follow the pattern `*.test.*` (e.g., `user-profile.test.ts`).
- The testing framework is not explicitly specified.
- Place test files alongside the modules they test or in a dedicated test directory.

**Example:**
```typescript
// user-profile.test.ts
import { getUserProfile } from './user-profile';

test('returns correct user profile', () => {
  expect(getUserProfile('alice')).toEqual({ name: 'Alice' });
});
```

## Commands

| Command        | Purpose                                                        |
|----------------|----------------------------------------------------------------|
| /add-skill     | Add or update agent skills, scripts, documentation, and assets |
| /update-memory | Update project memory and documentation files                  |
```
