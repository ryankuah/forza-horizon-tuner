# Agent Instructions

## macOS Signing And Releases

The release workflow builds macOS, Windows, and Linux artifacts. macOS artifacts must be signed with a **Developer ID Application** certificate and notarized, otherwise downloaded apps may show macOS Gatekeeper's "damaged and can't be opened" dialog.

Prefer the GitHub Actions release workflow for signed releases. Do not rely on local signing unless the local Keychain has a valid `Developer ID Application` identity installed.

### Required GitHub Secrets

Before creating a release, verify these repository secrets exist:

```bash
gh secret list --repo ryankuah/forza-horizon-tuner
```

Required secrets:

- `MAC_CERTIFICATE`: base64-encoded `.p12` Developer ID Application certificate
- `MAC_CERTIFICATE_PASSWORD`: password for the `.p12`
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: Apple app-specific password for notarization
- `APPLE_TEAM_ID`: Apple Developer Team ID for the Developer ID certificate

The release workflow intentionally fails before creating a release if any of these are missing.

### Trigger A Signed Release

Use the existing workflow instead of building macOS locally:

```bash
gh workflow run Release --repo ryankuah/forza-horizon-tuner --ref main
gh run list --repo ryankuah/forza-horizon-tuner --workflow Release --limit 5
```

Watch the latest run:

```bash
gh run watch <run-id> --repo ryankuah/forza-horizon-tuner --interval 30 --exit-status
```

Confirm the macOS job log contains both:

- `signing ... identityName=Developer ID Application`
- `notarization successful`

Then verify the release has macOS assets:

```bash
gh release list --repo ryankuah/forza-horizon-tuner --limit 5
gh release view <tag> --repo ryankuah/forza-horizon-tuner --json assets --jq '.assets[].name'
```

Expected macOS assets include:

- `Forza.Horizon.Tuner-<version>-arm64.dmg`
- `Forza.Horizon.Tuner-<version>-arm64-mac.zip`
- `latest-mac.yml`

### If Codex Says The Cert Is Missing

First distinguish local signing from remote signing:

```bash
security find-identity -v -p codesigning
gh secret list --repo ryankuah/forza-horizon-tuner
```

If `security find-identity` does not show `Developer ID Application`, local macOS packaging cannot sign even if GitHub Actions can. In that case, use the GitHub workflow.

If GitHub secrets are missing, recreate the `.p12` from a Developer ID Application certificate and private key, base64 encode it, and set the secrets with `gh secret set`. Keep private keys, `.p12` files, and password files outside the repository. Never commit signing material.

For macOS-compatible `.p12` files, use legacy PKCS#12 encryption so Apple's `security import` can read it:

```bash
openssl pkcs12 -legacy -export \
  -inkey path/to/private.key \
  -in path/to/developer_id_application.pem \
  -out path/to/developer_id_application.p12 \
  -name "Developer ID Application: Name (TEAMID)"
```

Validate import locally before setting GitHub secrets:

```bash
security create-keychain -p testpass /tmp/test-signing.keychain-db
security import path/to/developer_id_application.p12 \
  -k /tmp/test-signing.keychain-db \
  -P "<p12-password>" \
  -T /usr/bin/codesign \
  -T /usr/bin/productbuild
security delete-keychain /tmp/test-signing.keychain-db
```

