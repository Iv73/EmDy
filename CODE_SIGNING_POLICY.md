# Code signing policy / Politique de signature du code

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

Signature gratuite fournie par [SignPath.io](https://about.signpath.io/), certificat de la [SignPath Foundation](https://signpath.org/).

## What is signed / Ce qui est signé

Only the Windows files attached to the [GitHub releases](https://github.com/Iv73/EmDy/releases) of this repository:

- `EmDy-<version>-portable.exe`
- `EmDy-<version>-setup.exe`

They are built from this repository's source code by the [Release workflow](.github/workflows/release.yml) on GitHub-hosted runners, then submitted to SignPath. Nothing built elsewhere is signed.

Ils sont compilés à partir du code de ce dépôt par le workflow [Release](.github/workflows/release.yml) sur des machines hébergées par GitHub, puis soumis à SignPath. Rien de ce qui est compilé ailleurs n'est signé.

## Team roles / Rôles

| Role | Members |
|---|---|
| Committers and reviewers | [Iv73](https://github.com/Iv73) |
| Approvers (each signing request) | [Iv73](https://github.com/Iv73) |

## Privacy / Confidentialité

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

- EmDy reads and writes only the files and folders you open, and its own settings file (`%APPDATA%\EmDy\settings.json`).
- Links in documents open in your browser only when you Ctrl+click them.
- If the Microsoft WebView2 runtime is missing, the installer downloads it from Microsoft.

Ce programme ne transmet aucune information à d'autres systèmes en réseau, sauf à la demande expresse de l'utilisateur ou de la personne qui l'installe ou l'utilise. EmDy ne lit et n'écrit que les fichiers et dossiers que vous ouvrez, ainsi que son fichier de réglages. Les liens ne s'ouvrent dans le navigateur que sur Ctrl+clic. Si le runtime WebView2 de Microsoft est absent, l'installateur le télécharge chez Microsoft.

## SignPath setup (maintainers) / Configuration SignPath

Artifact configuration to use in the SignPath project (the GitHub artifact is a ZIP containing both `.exe` files):

```xml
<?xml version="1.0" encoding="utf-8"?>
<artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
  <zip-file>
    <pe-file path="EmDy-*-portable.exe">
      <authenticode-sign />
    </pe-file>
    <pe-file path="EmDy-*-setup.exe">
      <authenticode-sign />
    </pe-file>
  </zip-file>
</artifact-configuration>
```

Repository settings (GitHub → Settings → Secrets and variables → Actions):

| Kind | Name | Value |
|---|---|---|
| Secret | `SIGNPATH_API_TOKEN` | API token of a SignPath user with *submitter* rights |
| Variable | `SIGNPATH_ORGANIZATION_ID` | SignPath organization ID (enables signing) |
| Variable | `SIGNPATH_PROJECT_SLUG` | optional, default `EmDy` |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | optional, default `release-signing` |
