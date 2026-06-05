Pod::Spec.new do |s|
  s.name           = 'TuyaPairing'
  s.version        = '1.0.0'
  s.summary        = 'Appairage Tuya (modele C) pour Clenzy/Baitly'
  s.description    = 'Module natif Expo encapsulant le device activator du SDK Tuya (EZ/AP, BLE a venir).'
  s.license        = 'MIT'
  s.author         = 'Clenzy'
  s.homepage       = 'https://clenzy.fr'
  s.platforms      = { :ios => '13.0' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # SDK Tuya App (Home) 7.5.x — fournit le device activator (EZ/AP/BLE).
  # Les `source` des specs Tuya + l'override local `ThingSmartCryption` (ios_core_sdk)
  # sont injectes dans le Podfile par le config plugin (plugins/withTuyaPairing.js).
  s.dependency 'ThingSmartHomeKit', '~> 7.5.0'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES'
  }

  # Uniquement le code du module (ios_core_sdk = xcframework vendore, reference via :path dans le Podfile).
  s.source_files = '*.{h,m,swift}'
end
