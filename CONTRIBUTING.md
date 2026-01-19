# Contributing to Intake Form Review Summary LWC

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch from `main`

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Review-Summary-LWC.git
cd Review-Summary-LWC

# Install dependencies
npm install

# Authenticate to a Salesforce org
sf org login web -a DevOrg
```

## Making Changes

### Code Style

* Follow Salesforce LWC best practices
* Use meaningful variable and function names
* Add JSDoc comments for public methods
* Ensure WCAG 2.1 AA accessibility compliance

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for nested array blocks
fix: resolve currency formatting issue
docs: update README with new properties
```

### Testing

* Test your changes in a scratch org or sandbox
* Verify accessibility with keyboard navigation
* Test with screen readers when possible

## Submitting Changes

1. Push your changes to your fork
2. Create a Pull Request against `main`
3. Fill out the PR template completely
4. Wait for review

## Pull Request Guidelines

* Keep PRs focused on a single feature or fix
* Include screenshots for UI changes
* Update documentation if needed
* Ensure no linting errors

## Reporting Issues

* Use the issue templates provided
* Include steps to reproduce bugs
* Attach screenshots or recordings when helpful

## Questions?

Open an issue with the `question` label for any questions about contributing.
