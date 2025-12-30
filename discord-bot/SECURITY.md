# 🔒 Security Guidelines

## Critical Security Measures

### Environment Variables
- **NEVER commit `.env` file** to version control
- **NEVER hardcode** sensitive IDs, tokens, or secrets in code
- Always use `process.env` or config module for sensitive data
- Review `.gitignore` to ensure `.env` is excluded

### Access Control
- All admin commands require `DISCORD_ADMIN_ROLE_ID` role check
- Never expose sensitive employee data in public channels
- Use ephemeral messages (hidden) for sensitive information
- Restrict bot permissions to only what's necessary

### Data Protection
- Employee data (names, IDs, absences) should only be accessed by authorized personnel
- Log all administrative actions for audit purposes
- Regularly review Google Sheets permissions
- Use HTTPS for all API communications

### Bot Token Security
- **Bot tokens are like passwords** - never share them
- If a token is leaked, regenerate it immediately in Discord Developer Portal
- Store tokens only in `.env` file, never in code
- Limit bot token access to essential team members only

### API Security
- Backend API should validate all requests
- Use rate limiting to prevent abuse
- Validate Discord user IDs before database operations
- Sanitize all user inputs

### Incident Response
If you suspect a security breach:
1. **Immediately** regenerate bot token
2. **Review** recent command logs
3. **Audit** Google Sheets access logs
4. **Check** for unauthorized data access
5. **Update** all affected credentials

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to the development team. Do NOT create public GitHub issues for security problems.

## Recent Security Updates

- **Dec 2025**: Moved all sensitive IDs to environment variables
- **Dec 2025**: Added config validation on bot startup
- **Dec 2025**: Implemented delete-commands script for cleanup
