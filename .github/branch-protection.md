# Branch Protection Configuration

To ensure code quality and prevent broken code from being merged, configure the following branch protection rules for the `main` branch:

## Required Status Checks

Enable "Require status checks to pass before merging" with the following required checks:

### From `ci.yml` workflow:
- `lint`
- `test (22.18.0)`
- `test (22.x)`
- `build`

### From `pr-checks.yml` workflow:
- `pr-validation`
- `pr-ready`

## Additional Settings

1. **Require branches to be up to date before merging**: ✅ Enabled
2. **Require pull request reviews before merging**: ✅ Enabled
   - Required number of reviewers: 1
   - Dismiss stale reviews when new commits are pushed: ✅ Enabled
3. **Require review from code owners**: ✅ Enabled (if CODEOWNERS file exists)
4. **Restrict pushes that create files**: ❌ Disabled
5. **Require signed commits**: ✅ Enabled (recommended)
6. **Require linear history**: ✅ Enabled (recommended)
7. **Include administrators**: ✅ Enabled

## Auto-merge Configuration

Consider enabling auto-merge for PRs that:
- Pass all required status checks
- Have required reviews
- Are from trusted contributors

## Deployment Protection

For production deployments, consider adding:
- Required reviewers for deployment
- Wait timer before deployment
- Deployment branch restrictions

## Configuration via GitHub CLI

```bash
# Enable branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","test (22.18.0)","test (22.x)","build","pr-validation","pr-ready"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```