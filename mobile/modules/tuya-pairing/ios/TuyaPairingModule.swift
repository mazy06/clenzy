import ExpoModulesCore
import ThingSmartHomeKit

// ─────────────────────────────────────────────────────────────────────────────
// Module natif d'appairage Tuya (modele C) — encapsule le device activator du SDK
// Tuya (Smart Life App SDK 7.5.x). Enregistre sous le nom « TuyaPairing », consomme
// par la facade TS src/native/tuyaPairing.ts.
//
// Flux : init(appKey, appSecret) au demarrage -> loginAppAccount (compte app de l'hote
// fourni par le PMS) -> getPairingToken (lie a un home) -> startPairing (activator local
// EZ/AP) -> resout avec le(s) device(s) appaire(s).
//
// NB API : les selecteurs Tuya marques « VALIDATION » sont a confirmer au 1er build EAS
// (le SDK 7.5.x "Thing" peut differer legerement). La structure (delegate, promises) est stable.
// ─────────────────────────────────────────────────────────────────────────────

struct StartPairingParams: Record {
  @Field var mode: String = "EZ"
  @Field var ssid: String = ""
  @Field var password: String = ""
  @Field var token: String = ""
  @Field var timeoutSec: Double = 100
}

public class TuyaPairingModule: Module {

  private var activator: ThingSmartActivator?
  private var activatorDelegate: ActivatorDelegate?
  private var pairingPromise: Promise?
  private var pairedDevices: [[String: Any]] = []

  public func definition() -> ModuleDefinition {
    Name("TuyaPairing")

    // Initialise le SDK Tuya avec l'AppKey/AppSecret iOS (servis par le backend).
    AsyncFunction("init") { (appKey: String, appSecret: String, promise: Promise) in
      ThingSmartSDK.sharedInstance().start(withAppKey: appKey, secretKey: appSecret)
      promise.resolve(nil)
    }

    // Connecte le SDK au compte app Tuya de l'hote (provisionne par le PMS).
    // VALIDATION : selecteur de login par username (le compte est cree via apps/{schema}/user,
    // username_type a confirmer cote backend createAppUser). A aligner avec le vrai SDK.
    AsyncFunction("loginAppAccount") { (countryCode: String, username: String, password: String, promise: Promise) in
      ThingSmartUser.sharedInstance().login(byUserName: username,
                                            countryCode: countryCode,
                                            password: password) {
        let uid = ThingSmartUser.sharedInstance().uid ?? ""
        promise.resolve(["uid": uid])
      } failure: { error in
        promise.reject("login_failed", error?.localizedDescription ?? "Echec de connexion au compte Tuya")
      }
    }

    // Recupere un token d'appairage. Tuya lie le token a un home -> on resout/cree le home par defaut.
    AsyncFunction("getPairingToken") { (promise: Promise) in
      self.resolveHomeId { homeId, error in
        guard let homeId = homeId else {
          promise.reject("home_error", error ?? "Aucun home Tuya disponible")
          return
        }
        ThingSmartActivator.getTokenWithHomeId(homeId) { token in
          promise.resolve(token ?? "")
        } failure: { error in
          promise.reject("token_failed", error?.localizedDescription ?? "Echec d'obtention du token d'appairage")
        }
      }
    }

    // Lance l'activator (provisioning Wi-Fi local) et resout avec le(s) device(s) appaire(s).
    AsyncFunction("startPairing") { (params: StartPairingParams, promise: Promise) in
      self.startPairing(params: params, promise: promise)
    }

    // Annule un appairage en cours.
    AsyncFunction("stopPairing") { (promise: Promise) in
      self.cleanup()
      promise.resolve(nil)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// Resout l'id du home courant ; en cree un par defaut s'il n'existe pas.
  private func resolveHomeId(_ completion: @escaping (Int64?, String?) -> Void) {
    let manager = ThingSmartHomeManager()
    manager.getHomeList { homes in
      if let home = homes?.first {
        completion(home.homeId, nil)
      } else {
        // Pas de home -> on en cree un (requis par l'activator).
        manager.addHome(withName: "Baitly",
                        geoName: "",
                        rooms: [],
                        latitude: 0,
                        longitude: 0) { homeId in
          completion(homeId, nil)
        } failure: { error in
          completion(nil, error?.localizedDescription ?? "Echec de creation du home")
        }
      }
    } failure: { error in
      completion(nil, error?.localizedDescription ?? "Echec de lecture des homes")
    }
  }

  private func startPairing(params: StartPairingParams, promise: Promise) {
    // BLE non gere dans cette tranche (EZ/AP couvrent l'appairage Wi-Fi). BLE = enhancement.
    if params.mode == "BLE" {
      promise.reject("ble_unsupported", "Mode BLE pas encore supporte (a venir). Utilisez EZ ou AP.")
      return
    }

    self.pairedDevices = []
    self.pairingPromise = promise

    let mode: ThingActivatorMode = (params.mode == "AP") ? .AP : .EZ
    let delegate = ActivatorDelegate { [weak self] device, error in
      guard let self = self else { return }
      if let error = error {
        self.pairingPromise?.reject("pairing_failed", error.localizedDescription)
        self.cleanup()
        return
      }
      guard let device = device else { return }
      self.pairedDevices.append([
        "devId": device.devId ?? "",
        "name": device.name ?? "",
        "productId": device.productId ?? "",
        "category": device.category ?? ""
      ])
      // Un device recu = succes ; l'UI peut relancer pour appairer d'autres appareils.
      self.pairingPromise?.resolve(self.pairedDevices)
      self.cleanup()
    }

    let activator = ThingSmartActivator()
    activator.delegate = delegate
    self.activator = activator
    self.activatorDelegate = delegate

    activator.startConfigWiFi(mode,
                              ssid: params.ssid,
                              password: params.password,
                              token: params.token,
                              timeout: TimeInterval(params.timeoutSec))
  }

  private func cleanup() {
    self.activator?.stopConfigWiFi()
    self.activator?.delegate = nil
    self.activator = nil
    self.activatorDelegate = nil
    self.pairingPromise = nil
  }
}

// Delegate de l'activator Tuya : relaie chaque device recu (ou erreur) au closure.
final class ActivatorDelegate: NSObject, ThingSmartActivatorDelegate {
  private let onDevice: (ThingSmartDeviceModel?, Error?) -> Void

  init(onDevice: @escaping (ThingSmartDeviceModel?, Error?) -> Void) {
    self.onDevice = onDevice
  }

  func activator(_ activator: ThingSmartActivator!,
                 didReceiveDevice deviceModel: ThingSmartDeviceModel!,
                 error: Error!) {
    onDevice(deviceModel, error)
  }
}
