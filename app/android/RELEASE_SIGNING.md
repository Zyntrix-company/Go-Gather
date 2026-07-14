# Release signing

The release build type is signed with the **upload keystore**, never the debug one.
If the keystore properties are absent the release build comes out **unsigned** — that
is deliberate. A debug-signed bundle is rejected by Play, and a silent fallback to it
would only be discovered at upload time.

## One-time: create the upload keystore

```bash
keytool -genkeypair -v \
  -keystore gathergo-upload.jks \
  -alias gathergo-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep `gathergo-upload.jks` **out of the repo** (`*.jks` and `*.keystore` are
git-ignored). Losing it means you can never ship an update to the same listing —
back it up somewhere durable, and enable Play App Signing so Google holds the
app signing key while this one stays as the upload key.

## Local builds

Put the credentials in your **user-level** Gradle properties — `~/.gradle/gradle.properties`
(on Windows: `C:\Users\<you>\.gradle\gradle.properties`), not the one in this repo:

```properties
GATHERGO_UPLOAD_STORE_FILE=C:/keys/gathergo-upload.jks
GATHERGO_UPLOAD_STORE_PASSWORD=…
GATHERGO_UPLOAD_KEY_ALIAS=gathergo-upload
GATHERGO_UPLOAD_KEY_PASSWORD=…
```

Then:

```bash
cd android && ./gradlew bundleRelease   # → app/build/outputs/bundle/release/app-release.aab
```

## CI

Pass them as flags instead, from secrets:

```bash
./gradlew bundleRelease \
  -PGATHERGO_UPLOAD_STORE_FILE=$KEYSTORE_PATH \
  -PGATHERGO_UPLOAD_STORE_PASSWORD=$KEYSTORE_PASSWORD \
  -PGATHERGO_UPLOAD_KEY_ALIAS=$KEY_ALIAS \
  -PGATHERGO_UPLOAD_KEY_PASSWORD=$KEY_PASSWORD
```

## Verify what you built

```bash
jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab
```

The certificate must **not** say `CN=Android Debug`.
