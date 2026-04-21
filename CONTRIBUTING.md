# Contributing

Thank you for helping improve CyberTabletop.

By submitting a pull request, issue patch, or other contribution, you
agree that your contribution is provided under the same license as the
project: the Business Source License 1.1, including the Additional Use
Grant and Change License described in `LICENSE`.

Please do not submit:

- secrets, API keys, credentials, private certificates, or real customer data,
- code copied from another project unless its license allows inclusion here,
- vulnerability details in a public issue.

For security reports, follow `SECURITY.md`.

Before opening a pull request:

1. Run the backend build: `cd backend && npm run build`.
2. Run the frontend build: `cd frontend && npm run build`.
3. Run dependency audits: `npm audit` in both `backend` and `frontend`.
4. Keep changes focused and explain any security impact.
