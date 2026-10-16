#!/bin/sh
set -eu

# Baitly : preparer un build ARM pour simulateur sans le SDK d'appairage Tuya.
cd "$(dirname "$0")/.."
rtk proxy npm run postinstall
rtk proxy env BAITLY_IOS_SIMULATOR=1 npx expo prebuild --platform ios --no-install

# Recuperer les headers et frameworks places dans un sous-dossier du cache.
BAITLY_RN_DEPS=ios/Pods/ReactNativeDependencies
if [ -d "$BAITLY_RN_DEPS" ] && [ ! -f "$BAITLY_RN_DEPS/Headers/folly/dynamic.h" ]; then
  for BAITLY_CACHED_HEADERS in "$BAITLY_RN_DEPS"/*/Headers; do
    if [ -f "$BAITLY_CACHED_HEADERS/folly/dynamic.h" ]; then
      rtk proxy cp -R "$BAITLY_CACHED_HEADERS" "$BAITLY_RN_DEPS/Headers"
      rtk proxy cp -R "$BAITLY_CACHED_HEADERS/../framework" "$BAITLY_RN_DEPS/framework"
      break
    fi
  done
fi
rtk proxy pod install --project-directory=ios --no-repo-update

# Un ancien cache CocoaPods peut avoir perdu la tranche simulateur React Native.
# Restaurer seulement cette tranche depuis l'archive officielle deja telechargee.
BAITLY_RN_VERSION=$(rtk proxy node -p "require('react-native/package.json').version")
BAITLY_RN_SLICE=React.xcframework/ios-arm64_x86_64-simulator
BAITLY_RN_POD=ios/Pods/React-Core-prebuilt
if [ -d "$BAITLY_RN_POD" ] && [ ! -f "$BAITLY_RN_POD/$BAITLY_RN_SLICE/React.framework/React" ]; then
  rtk proxy tar -xzf "ios/Pods/ReactNativeCore-artifacts/reactnative-core-$BAITLY_RN_VERSION-debug.tar.gz" \
    -C "$BAITLY_RN_POD" "$BAITLY_RN_SLICE"
fi
rtk proxy npx expo run:ios "$@"
