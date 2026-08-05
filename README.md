# Pugilister

> Punch above your weight

## What is this?

Pugilister is an agent orchestration API layer that lives 100% in your browser.

## Why use Pugilister?

Most AI agent platforms force developers to pay heavy cloud costs because they run agent code inside expensive backend Docker containers or micro-VMs.

**Pugilister moves 100% of compute (virtual bash shell, Python Pyodide runtime, files, and UI modals) into the client's browser. That means $0 infrastructure cost per agent run for whoever hosts it!**

Simply open up a site configured with Pugilister with a browser, such as chrome, and you can run any complex agentic orchestration flows anywhere.

## Demonstrations

- **In-Browser Data Analyst**: An agent that turns CSV files into interactive charts in Python without uploading files to a server

- **Offline Document Editor**: Agent that parses and edits resumes/PDFs locally.

- **Browser DevTools Agent**: Press F12 and run agent(...) on any site

## Usage

```bash
# install
pnpm i pugilister
```