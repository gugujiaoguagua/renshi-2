# Navigation Visibility Module

## Module Goal

Keep navigation cleanup rules in one small place so future AI edits can change the visible app surface without reading every page component.

## Scope

This module owns:

- Removed organization sections.
- Removed employee views.
- Removed attendance routes and their redirect targets.
- Removed attendance setting views.

This module does not own:

- Page rendering.
- API calls.
- Data shape definitions.
- Business table behavior inside retained pages.

## Main Files

| File | Purpose |
|---|---|
| `visibilityPolicy.ts` | Central list of removed UI surfaces and redirect rules. |

## Editing Rules

1. To remove or restore a page entry, update `visibilityPolicy.ts` first.
2. Page components may import helper functions from this module, but should not duplicate removed-view lists.
3. Route redirects should use this module so direct URLs and visible menus stay aligned.
4. Do not delete page implementation files unless the user explicitly asks for source deletion.
