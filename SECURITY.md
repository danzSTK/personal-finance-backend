# Security Policy

Thank you for helping improve the security of Danfy.

## Supported Versions

Danfy is currently under active development. Security fixes are applied only to the latest published release and the current production version.

| Version                  | Supported |
| ------------------------ | --------- |
| Latest published release | Yes       |
| Older releases           | No        |
| Development branches     | No        |

Users should update to the latest available release before reporting a vulnerability that may already have been fixed.

## Reporting a Vulnerability

Do not report security vulnerabilities through public GitHub issues, discussions, pull requests, social media, or other public channels.

Use **GitHub Private Vulnerability Reporting**, the only vulnerability-reporting channel for Danfy:

1. Open the repository's **Security** section.
2. Select **Report a vulnerability**.
3. Submit the report privately.

You can also open the private report form directly:

<https://github.com/danzSTK/personal-finance-backend/security/advisories/new>

Do not include active credentials, authentication tokens, personal financial information, or personal data belonging to other users in the report.

## What to Include

Provide as much of the following information as possible:

- A clear description of the vulnerability;
- the affected release, commit, endpoint, module, or component;
- the conditions required to reproduce the issue;
- step-by-step reproduction instructions;
- the expected and observed behavior;
- the potential security impact;
- sanitized logs, requests, responses, screenshots, or proof-of-concept material;
- any suggested mitigation or correction, when available.

Proof-of-concept material must not contain real credentials or personal data belonging to other people.

## Examples of Security Issues

Examples of issues that should be reported privately include:

- Authentication or authorization bypasses;
- access to another user's accounts, transactions, sessions, assets, or personal data;
- exposure of credentials, tokens, cookies, secrets, or sensitive configuration;
- injection vulnerabilities;
- server-side request forgery;
- insecure file upload or object-storage access;
- cross-site request forgery with concrete security impact;
- session fixation, session hijacking, or refresh-token compromise;
- privilege escalation;
- remote code execution;
- vulnerabilities that could compromise the application, infrastructure, or user data.

General bugs without a security impact should be reported through the normal public bug-report template.

## Research Guidelines

When investigating a possible vulnerability:

- Use only accounts, devices, data, and infrastructure that you own or are explicitly authorized to test;
- do not access, modify, copy, or delete data belonging to other users;
- do not perform denial-of-service, load, stress, or resource-exhaustion testing;
- do not use social engineering, phishing, or physical attacks;
- do not attempt to access production secrets or internal systems beyond what is necessary to demonstrate the issue;
- stop testing immediately if you encounter personal data, credentials, or data belonging to another person;
- provide the minimum proof necessary to demonstrate the vulnerability.

## Coordinated Disclosure

Please allow reasonable time for the vulnerability to be investigated and corrected before publishing details.

Do not publicly disclose the vulnerability, its reproduction steps, or proof-of-concept material before a correction or mitigation is available and disclosure has been coordinated with the maintainer.

When appropriate, valid reporters may be credited in the published security advisory or release notes.

## Response Expectations

Danfy is currently maintained by an individual developer. Reports are handled on a best-effort basis.

The maintainer aims to:

- acknowledge a report within seven calendar days;
- evaluate whether the report represents a security vulnerability;
- request additional information when necessary;
- communicate meaningful changes in the report's status;
- coordinate disclosure after a correction or mitigation is available.

Resolution time depends on the severity, complexity, affected components, and availability of a safe correction.

## Security Fix Contributions

Reporting a vulnerability does not automatically grant permission to modify or redistribute the Danfy source code.

The repository is licensed under the PolyForm Strict License 1.0.0. External code contributions, including proposed security fixes, require prior written authorization and may require separate contribution terms.

A reporter may provide descriptions, reproduction steps, analysis, and suggested remediation without submitting a code change.

## Bug Bounty

Danfy does not currently operate a paid bug bounty program.

Submitting a vulnerability report does not create an entitlement to payment, compensation, employment, partnership, or any other reward.

## Good-Faith Reports

Reports made responsibly and in accordance with this policy are appreciated.

The goal of this process is to identify vulnerabilities, protect users, and coordinate corrections before public disclosure.
