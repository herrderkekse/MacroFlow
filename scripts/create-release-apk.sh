#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") -k KEYSTORE -p STORE_PASS -a KEY_ALIAS -w KEY_PASS [options]

Options:
  -k, --keystore PATH        Path to the .jks keystore file
  -p, --store-pass PASS      Keystore password
  -a, --alias ALIAS          Key alias
  -w, --key-pass PASS        Key password
  -i, --input APK            Input APK (default: android/app/build/outputs/apk/release/app-release.apk)
  -o, --output APK           Output signed APK (default: same directory, suffixed -signed.apk)
  -b, --build                Build the release APK with Gradle before signing
      --force-resign         Remove existing signatures and resign
  -h, --help                 Show this help

Example:
  $(basename "$0") -k my-upload.jks -p password -a upload -w keypass --force-resign
EOF
}

APKSIGNER=""
find_apksigner() {
  if command -v apksigner >/dev/null 2>&1; then
    APKSIGNER=$(command -v apksigner)
    return 0
  fi
  echo "apksigner not found in PATH, searching Android SDK locations..." >&2

  SDK_CANDIDATES=()
  [[ -n "${ANDROID_SDK_ROOT:-}" ]] && SDK_CANDIDATES+=("${ANDROID_SDK_ROOT}")
  [[ -n "${ANDROID_HOME:-}" ]] && SDK_CANDIDATES+=("${ANDROID_HOME}")
  SDK_CANDIDATES+=("$HOME/Android/Sdk")

  for sdk in "${SDK_CANDIDATES[@]}"; do
    if [[ -d "$sdk/build-tools" ]]; then
      # prefer highest version directory
      best=$(find "$sdk/build-tools" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -V | tail -n1 || true)
      if [[ -n "$best" && -x "$best/apksigner" ]]; then
        APKSIGNER="$best/apksigner"
        echo "Found apksigner at: $APKSIGNER" >&2
        return 0
      fi
      # fallback: any apksigner under build-tools
      candidate=$(find "$sdk/build-tools" -type f -name apksigner 2>/dev/null | head -n1 || true)
      if [[ -n "$candidate" ]]; then
        APKSIGNER="$candidate"
        echo "Found apksigner at: $APKSIGNER" >&2
        return 0
      fi
    fi
  done

  return 1
}

if ! find_apksigner; then
  echo "Error: apksigner not found in PATH or Android SDK locations. Install Android build-tools and ensure apksigner is available." >&2
  exit 1
fi

# Defaults
INPUT_APK="android/app/build/outputs/apk/release/app-release.apk"
OUTPUT_APK=""
KEYSTORE=""
STORE_PASS=""
KEY_ALIAS=""
KEY_PASS=""
FORCE_RESIGN=0
BUILD=0

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLEW="$PROJECT_ROOT/android/gradlew"

build_release() {
  echo "Building release APK with Gradle..."
  # If gradlew is missing, try to generate the Android native project (Expo prebuild)
  if [[ ! -f "$GRADLEW" ]]; then
    echo "gradlew not found at $GRADLEW; attempting to generate android/ via 'npx expo prebuild -p android'..." >&2
    if command -v npx >/dev/null 2>&1; then
      (cd "$PROJECT_ROOT" && npx expo prebuild -p android)
    else
      echo "npx not found; cannot run expo prebuild to generate android/ folder." >&2
      return 1
    fi
  fi

  if [[ -x "$GRADLEW" ]]; then
    (cd "$PROJECT_ROOT/android" && "$GRADLEW" assembleRelease --no-daemon)
  elif [[ -f "$GRADLEW" ]]; then
    (cd "$PROJECT_ROOT/android" && chmod +x "$GRADLEW" && bash gradlew assembleRelease --no-daemon)
  else
    echo "Error: gradlew wrapper not found at $GRADLEW" >&2
    return 1
  fi
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -k|--keystore) KEYSTORE="$2"; shift 2;;
    -p|--store-pass) STORE_PASS="$2"; shift 2;;
    -a|--alias) KEY_ALIAS="$2"; shift 2;;
    -w|--key-pass) KEY_PASS="$2"; shift 2;;
    -i|--input) INPUT_APK="$2"; shift 2;;
    -o|--output) OUTPUT_APK="$2"; shift 2;;
    --force-resign) FORCE_RESIGN=1; shift;;
    -b|--build) BUILD=1; shift;;
    -h|--help) usage; exit 0;;
    --) shift; break;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1;;
    *) break;;
  esac
done

if [[ -z "$KEYSTORE" || -z "$STORE_PASS" || -z "$KEY_ALIAS" || -z "$KEY_PASS" ]]; then
  echo "Error: missing required keystore parameters." >&2
  usage
  exit 1
fi

if [[ $BUILD -eq 1 || ! -f "$INPUT_APK" ]]; then
  if ! build_release; then
    echo "Error: Gradle build failed, cannot locate release APK." >&2
    exit 1
  fi

  # if default INPUT_APK was not created, try to find any release APK produced
  if [[ ! -f "$INPUT_APK" ]]; then
    candidate=$(find "$PROJECT_ROOT/android/app/build/outputs/apk" -type f -iname "*release*.apk" 2>/dev/null | sort -V | tail -n1 || true)
    if [[ -n "$candidate" ]]; then
      INPUT_APK="$candidate"
      echo "Found built APK: $INPUT_APK"
    fi
  fi

  if [[ ! -f "$INPUT_APK" ]]; then
    echo "Error: input APK not found after build: $INPUT_APK" >&2
    exit 1
  fi
fi

if [[ -z "$OUTPUT_APK" ]]; then
  dir=$(dirname "$INPUT_APK")
  base=$(basename "$INPUT_APK" .apk)
  OUTPUT_APK="$dir/${base}-signed.apk"
fi

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

WORK_APK="$TMPDIR/working.apk"
cp "$INPUT_APK" "$WORK_APK"

if [[ $FORCE_RESIGN -eq 0 ]]; then
  if "$APKSIGNER" verify --print-certs "$WORK_APK" >/dev/null 2>&1; then
    echo "APK already signed. Use --force-resign to remove signatures and resign." >&2
    exit 0
  fi
fi

if [[ $FORCE_RESIGN -ne 0 ]]; then
  # Remove META-INF signature files so we can resign
  if command -v zip >/dev/null 2>&1; then
    zip -q -d "$WORK_APK" 'META-INF/*' || true
  else
    echo "Warning: zip command not found; proceeding without removing META-INF entries." >&2
  fi
fi

echo "Signing APK..."
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:"$STORE_PASS" \
  --ks-key-alias "$KEY_ALIAS" \
  --key-pass pass:"$KEY_PASS" \
  "$WORK_APK"

echo "Verifying signed APK..."
if ! "$APKSIGNER" verify --print-certs "$WORK_APK"; then
  echo "Error: verification failed." >&2
  exit 1
fi

mv -f "$WORK_APK" "$OUTPUT_APK"
echo "Signed APK written to: $OUTPUT_APK"

exit 0
