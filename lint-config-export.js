// Lint Configuration Export for slskd Project
// Copy these configurations to reuse the same lint rules elsewhere

// ============================================================================
// PACKAGE.JSON DEPENDENCIES (devDependencies section)
// ============================================================================
/*
"devDependencies": {
  "eslint": "^8.56.0",
  "eslint-config-canonical": "^42.8.1"
}
*/

// ============================================================================
// .ESLINTRC.JS CONFIGURATION
// ============================================================================

// ============================================================================
// KEY LINT RULES SUMMARY
// ============================================================================
/*
Key Rules Used:
1. canonical/auto - Main canonical configuration
2. canonical/browser - Browser-specific rules
3. canonical/node - Node.js specific rules
4. canonical/react - React-specific rules
5. canonical/prettier - Prettier integration
6. canonical/jsx-a11y - Accessibility rules
7. canonical/regexp - Regular expression rules
8. canonical/jest - Testing rules

Custom Overrides:
- eqeqeq: ['error', 'always', { null: 'ignore' }]
- id-length: 'off'
- no-console: 'off'
- no-eq-null: 'off'
- react/forbid-component-props: 'off'
- react/prop-types: 'off'
- unicorn/no-array-reduce: 'off'
- react/no-set-state: 'off'

Special Rules:
- Object keys must be in natural insensitive ascending order (canonical/sort-keys)
- Numeric separators use underscores (unicorn/numeric-separators-style)
- Prettier formatting is enforced
- Import sorting is enforced
- JSX accessibility rules are active
*/

// ============================================================================
// NPM SCRIPTS
// ============================================================================
/*
"scripts": {
  "lint": "eslint .",
  "lint:fix": "eslint --fix ."
}
*/

// ============================================================================
// QUICK SETUP COMMANDS
// ============================================================================
/*
# Install dependencies
npm install --save-dev eslint@^8.56.0 eslint-config-canonical@^42.8.1

# Create .eslintrc.js with the configuration above

# Run linting
npm run lint

# Auto-fix issues
npm run lint:fix
*/

console.log("Lint configuration exported successfully!");
console.log("Copy the configurations above to reuse the same lint rules.");
