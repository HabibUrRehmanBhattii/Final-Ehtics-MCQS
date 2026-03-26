# Contributing to MCQ Platform

Thank you for your interest in contributing to the MCQ Platform! This document provides guidelines and instructions for contributing.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inclusive environment for all contributors. We pledge to act and interact in ways that contribute to an open, welcoming, diverse, inclusive, and healthy community.

### Our Standards
Examples of behavior that contributes to a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing opinions
- Accepting constructive criticism gracefully
- Focusing on what's best for the community
- Showing empathy towards others

### Enforcement
Violations can be reported to [admin email]. All reports will be reviewed and investigated fairly.

---

## Getting Started

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- npm or yarn package manager
- Cloudflare account (for Worker development)

### Fork and Clone
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Final-Ehtics-MCQS.git
cd Final-Ehtics-MCQS

# Add upstream remote
git remote add upstream https://github.com/habibcanad/Final-Ehtics-MCQS.git
```

---

## Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
```bash
# Copy example env file
cp .env.example .env.local

# Edit with your credentials
nano .env.local
```

Required variables:
```
SESSION_SECRET=<32-char-random>
TURNSTILE_SITE_KEY=<your-key>
TURNSTILE_SECRET_KEY=<your-key>
```

### 3. Set Up Database (D1)
```bash
# Create local D1 database
wrangler d1 create mcq_db --local

# Run migrations
wrangler d1 migrations apply mcq_db --local
```

### 4. Start Development Server
```bash
# For local development
npm run dev

# Or start Wrangler dev server
wrangler dev --local
```

The application should be available at `http://localhost:3000`

### 5. Verify Setup
```bash
# Check health endpoint
curl http://localhost:3000/health

# Check API configuration
curl http://localhost:3000/api/auth/config
```

---

## Making Changes

### Create a Branch
```bash
# Update main branch
git fetch upstream
git rebase upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `perf/` - Performance improvements
- `chore/` - Maintenance tasks

### Keep Your Branch Updated
```bash
# Fetch latest upstream changes
git fetch upstream

# Rebase your branch
git rebase upstream/main
```

### Work on Your Changes
1. Make small, focused commits
2. Write clear commit messages
3. Test your changes locally
4. Don't commit to main or master branch

---

## Commit Guidelines

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, semicolons, etc.)
- `refactor` - Code refactoring without feature/bug changes
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Build process, dependencies, etc.

### Scope
Specify what part of code is affected:
- `auth` - Authentication
- `api` - API endpoints
- `admin` - Admin panel
- `worker` - Cloudflare Worker
- `db` - Database
- `heatmap` - Analytics/heatmap
- `ui` - Frontend components

### Subject
- Use imperative mood: "add" not "added"
- Don't capitalize first letter
- No period at the end
- Limit to 50 characters

### Body
- Explain what and why, not how
- Wrap at 72 characters
- Reference issues: "Fixes #123"

### Examples
```
feat(auth): add email verification for signup

Adds email verification step to signup process.
Sends verification link via Resend API.
Requires verified email before account activation.

Fixes #456
```

```
fix(api): correct validation for password reset token

The token expiration check was using wrong timestamp.
Updated to use ISO 8601 format consistently.

Closes #789
```

---

## Pull Request Process

### Before Submitting
1. **Update your branch** with latest upstream changes
2. **Test thoroughly** - run all tests locally
3. **Check linting** - ensure code style compliance
4. **Update documentation** - update README, docs, JSDoc
5. **Add tests** - include tests for new functionality
6. **Review your changes** - self-review before submitting

### Submitting PR
1. Push to your fork
2. Create Pull Request on GitHub
3. Fill out PR template completely
4. Link related issues: "Fixes #123"
5. Request reviewers

### PR Title Format
```
[TYPE] Brief description of changes
```

Examples:
- `[FEATURE] Add email verification for signup`
- `[BUGFIX] Fix session expiration check`
- `[DOCS] Update API reference`
- `[PERF] Optimize question loading`

### PR Description
Include:
- What does this PR do?
- Why are these changes needed?
- How to test/verify?
- Any breaking changes?
- Related issues
- Screenshots (if UI changes)

### Addressing Feedback
1. Make requested changes
2. Don't force-push (keeps history)
3. Re-request review after changes
4. Respond to all comments

### Merge Criteria
- [ ] All tests passing
- [ ] Code review approved
- [ ] Conflicts resolved
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)

---

## Coding Standards

### JavaScript/Node.js
```javascript
// Use semicolons
const x = 5;

// Use const by default, let if needed
const MAX_RETRIES = 3;
let currentRetry = 0;

// Use arrow functions
const sum = (a, b) => a + b;

// Use template literals
const message = `Hello, ${name}!`;

// Use async/await over promises
async function fetchData() {
  try {
    const response = await fetch(url);
    return response.json();
  } catch (error) {
    console.error('Failed:', error);
  }
}

// Add JSDoc comments
/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### HTML/CSS
```html
<!-- Use semantic HTML -->
<button class="btn btn-primary" type="submit">Submit</button>

<!-- Use BEM naming for CSS -->
<div class="card">
  <div class="card__header">Header</div>
  <div class="card__body">Content</div>
</div>
```

```css
/* Use variables for colors -->
:root {
  --color-primary: #667eea;
  --color-danger: #ff6b6b;
}

/* Use logical properties where possible -->
.button {
  padding-block: 0.5rem;
  padding-inline: 1rem;
}
```

### File Organization
```
src/
├── worker.js          # Main Worker code
├── routes/            # Route handlers
│   ├── auth.js
│   ├── questions.js
│   └── admin.js
├── handlers/          # Request handlers
├── utils/             # Utility functions
└── middleware/        # Middleware functions

js/
├── app.js            # Main app logic
├── admin-api.js      # Admin API client
└── auth.js           # Auth utilities

tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
└── e2e/              # End-to-end tests
```

---

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test tests/auth.test.js

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

### Writing Tests
```javascript
describe('Email validation', () => {
  test('accepts valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  test('rejects invalid email', () => {
    expect(isValidEmail('invalid')).toBe(false);
  });
});
```

### Test Guidelines
- Write tests for new features
- Aim for 80%+ coverage
- Test edge cases
- Use descriptive test names
- Mock external APIs
- Keep tests isolated

---

## Documentation

### Update Documentation When
- Adding new API endpoints
- Changing function signatures
- Adding configuration options
- Modifying file structure
- Creating new features

### Documentation Files to Update
- `README.md` - If project-wide changes
- `ADMIN_API_REFERENCE.md` - If API changes
- JSDoc comments in code
- Relevant `.md` files
- Code comments for complex logic

### Documentation Format
```javascript
/**
 * Short description
 * 
 * Longer description if needed.
 * Can span multiple lines.
 *
 * @param {type} name - Parameter description
 * @param {type} [optional] - Optional parameter
 * @returns {type} Return description
 * @throws {Error} Error description
 * 
 * @example
 * const result = myFunction(param);
 * console.log(result);
 */
function myFunction(name, optional = null) {
  // Implementation
}
```

---

## Reporting Bugs

### Use Issue Templates
1. Click "New Issue"
2. Choose "Bug Report" template
3. Fill out all sections
4. Submit

### Include
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (browser, OS, version)
- Screenshots/logs if applicable
- Error messages (full text)

### Avoid
- Vague descriptions ("it doesn't work")
- Multiple unrelated bugs in one issue
- Screenshots without explanation
- Duplicate issues (search first)

---

## Requesting Features

### Use Issue Templates
1. Click "New Issue"
2. Choose "Feature Request" template
3. Fill out all sections
4. Submit

### Include
- Clear description of feature
- Problem it solves
- Use cases/examples
- Alternative approaches considered
- Acceptance criteria

### Avoid
- "Just implement X" (needs context)
- Duplicate requests (search first)
- Breaking changes without discussion
- Out-of-scope requests

---

## Review Process

### What Reviewers Look For
- Code quality and standards
- Test coverage
- Documentation updates
- Breaking changes
- Performance implications
- Security concerns

### Common Feedback
| Type | Response |
|------|----------|
| "Please add tests" | Required for approval |
| "Consider..." | Suggestion for improvement |
| "This breaks..." | Must be addressed |
| "Nice to have" | Optional improvement |

### How to Respond
1. Acknowledge the feedback
2. Ask clarifying questions if needed
3. Make changes or explain reasoning
4. Mark conversations as resolved
5. Re-request review

---

## Release Process

### Version Numbering
- MAJOR: Incompatible API changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes
- Example: `1.2.3`

### Release Checklist
- [ ] All tests passing
- [ ] Update CHANGELOG.md
- [ ] Update version in package.json
- [ ] Update documentation
- [ ] Create git tag
- [ ] Deploy to production

---

## Getting Help

### Where to Ask Questions
- **Setup issues**: Check README and docs
- **Bug in code**: Create GitHub issue with "BUG" label
- **Feature idea**: Use feature request template
- **Contribution process**: Comment on issue or PR
- **General questions**: Email maintainers

### Response Times
- Critical bugs: 24 hours
- Feature requests: 1 week
- Questions: Best effort

---

## Resources

### Useful Links
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [JavaScript Standards](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)

### Project Documentation
- [README](./README.md)
- [API Reference](./ADMIN_API_REFERENCE.md)
- [Admin Guide](./ADMIN_CONTENT_MANAGER_GUIDE.md)
- [Troubleshooting FAQ](./TROUBLESHOOTING_FAQ.md)

---

## License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project. See LICENSE file for details.

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Thanked in release notes
- Credited in relevant documentation

---

Thank you for contributing! Your efforts help make the MCQ platform better for everyone. 🎉

**Questions?** Open an issue or reach out to the maintainers.

---

**Last Updated:** March 26, 2026  
**Version:** 1.0.0
