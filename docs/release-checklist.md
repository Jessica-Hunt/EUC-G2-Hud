# Release Checklist

## Versioning

1. Update the package version in app.json.
2. Keep package.json version aligned if you use it for release notes.

## Build And Pack

1. Run npm run build.
2. Run npm run pack.
3. Confirm euc-world-g2.ehpk exists at project root.

## Pre-Upload Validation

1. Open dist/index.html in a browser and verify the companion UI loads.
2. Verify app.json contains required fields:
   - package_id
   - edition
   - entrypoint
   - min_app_version
   - min_sdk_version
   - supported_languages
3. Confirm permissions is an array of objects with name and desc.

## Upload

1. Upload euc-world-g2.ehpk to Even Hub.
2. Install on a test device.
3. Verify startup, data polling, and gesture toggles.
