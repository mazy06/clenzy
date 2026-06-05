package expo.modules.tuyapairing

import android.app.Application
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

import com.thingclips.smart.home.sdk.ThingHomeSdk
import com.thingclips.smart.android.user.api.ILoginCallback
import com.thingclips.smart.android.user.bean.User
import com.thingclips.smart.home.sdk.bean.HomeBean
import com.thingclips.smart.home.sdk.callback.IThingGetHomeListCallback
import com.thingclips.smart.home.sdk.callback.IThingHomeResultCallback
import com.thingclips.smart.sdk.api.IThingActivatorGetToken
import com.thingclips.smart.sdk.bean.DeviceBean
// Nouvelle API activator 7.x (artefact thingsmart-activator-core-kit) — cf. sample officiel Tuya
// + module Expo-Tuya de reference.
import com.thingclips.smart.activator.core.kit.ThingActivatorCoreKit
import com.thingclips.smart.activator.core.kit.ThingActivatorDeviceCoreKit
import com.thingclips.smart.activator.core.kit.active.inter.IThingActiveManager
import com.thingclips.smart.activator.core.kit.bean.ThingDeviceActiveErrorBean
import com.thingclips.smart.activator.core.kit.bean.ThingDeviceActiveLimitBean
import com.thingclips.smart.activator.core.kit.builder.ThingDeviceActiveBuilder
import com.thingclips.smart.activator.core.kit.constant.ThingDeviceActiveModeEnum
import com.thingclips.smart.activator.core.kit.listener.IThingDeviceActiveListener

// ─────────────────────────────────────────────────────────────────────────────
// Module natif d'appairage Tuya (modele C) — Android. Encapsule l'activator du SDK Tuya
// (Smart Life App SDK 7.5.x). Enregistre sous « TuyaPairing », consomme par src/native/tuyaPairing.ts.
//
// Flux : init(appKey, appSecret) -> loginAppAccount (compte app de l'hote) -> getPairingToken (lie a
// un home) -> startPairing (activator EZ/AP via ThingActivatorCoreKit) -> resout avec le device appaire.
// ─────────────────────────────────────────────────────────────────────────────

class StartPairingParams : Record {
  @Field var mode: String = "EZ"
  @Field var ssid: String = ""
  @Field var password: String = ""
  @Field var token: String = ""
  @Field var timeoutSec: Double = 100.0
}

class TuyaPairingModule : Module() {

  private var activeManager: IThingActiveManager? = null

  override fun definition() = ModuleDefinition {
    Name("TuyaPairing")

    // Initialise le SDK Tuya avec l'AppKey/AppSecret Android (servis par le backend).
    AsyncFunction("init") { appKey: String, appSecret: String, promise: Promise ->
      val app = appContext.reactContext?.applicationContext as? Application
      if (app == null) {
        promise.reject("no_context", "Application context indisponible", null)
        return@AsyncFunction
      }
      ThingHomeSdk.init(app, appKey, appSecret)
      promise.resolve(null)
    }

    // Connecte le SDK au compte app Tuya de l'hote (provisionne par le PMS).
    AsyncFunction("loginAppAccount") { countryCode: String, username: String, password: String, promise: Promise ->
      ThingHomeSdk.getUserInstance().loginWithUid(countryCode, username, password, object : ILoginCallback {
        override fun onSuccess(user: User) {
          promise.resolve(mapOf("uid" to user.uid))
        }
        override fun onError(code: String, error: String) {
          promise.reject("login_failed", error, null)
        }
      })
    }

    // Recupere un token d'appairage (lie a un home -> on resout/cree le home par defaut).
    AsyncFunction("getPairingToken") { promise: Promise ->
      resolveHomeId(
        onResolved = { homeId ->
          ThingActivatorDeviceCoreKit.getActivatorInstance().getActivatorToken(homeId, object : IThingActivatorGetToken {
            override fun onSuccess(token: String) {
              promise.resolve(token)
            }
            override fun onFailure(errorCode: String, errorMsg: String) {
              promise.reject("token_failed", errorMsg, null)
            }
          })
        },
        onError = { err -> promise.reject("home_error", err, null) }
      )
    }

    // Lance l'activator (provisioning Wi-Fi local) et resout avec le device appaire.
    AsyncFunction("startPairing") { params: StartPairingParams, promise: Promise ->
      startPairing(params, promise)
    }

    // Annule un appairage en cours.
    AsyncFunction("stopPairing") { promise: Promise ->
      cleanup()
      promise.resolve(null)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Resout l'id du home courant ; en cree un par defaut s'il n'existe pas. */
  private fun resolveHomeId(onResolved: (Long) -> Unit, onError: (String) -> Unit) {
    ThingHomeSdk.getHomeManagerInstance().queryHomeList(object : IThingGetHomeListCallback {
      override fun onSuccess(homeBeans: MutableList<HomeBean>?) {
        val first = homeBeans?.firstOrNull()
        if (first != null) {
          onResolved(first.homeId)
        } else {
          ThingHomeSdk.getHomeManagerInstance().createHome(
            "Baitly", 0.0, 0.0, "", emptyList(),
            object : IThingHomeResultCallback {
              override fun onSuccess(bean: HomeBean) = onResolved(bean.homeId)
              override fun onError(errorCode: String, errorMsg: String) = onError(errorMsg)
            }
          )
        }
      }
      override fun onError(errorCode: String, error: String) = onError(error)
    })
  }

  private fun startPairing(params: StartPairingParams, promise: Promise) {
    // BLE non gere dans cette tranche (EZ/AP couvrent l'appairage Wi-Fi). BLE = enhancement.
    if (params.mode == "BLE") {
      promise.reject("ble_unsupported", "Mode BLE pas encore supporte (a venir). Utilisez EZ ou AP.", null)
      return
    }

    val mode = if (params.mode == "AP") ThingDeviceActiveModeEnum.AP else ThingDeviceActiveModeEnum.EZ
    val manager = ThingActivatorCoreKit.getActiveManager().newThingActiveManager()
    activeManager = manager

    val builder = ThingDeviceActiveBuilder()
      .setActiveModel(mode)
      .setSsid(params.ssid)
      .setPassword(params.password)
      .setToken(params.token)
      .setTimeOut(params.timeoutSec.toLong())
      .setListener(object : IThingDeviceActiveListener {
        override fun onFind(devId: String) {}
        override fun onBind(devId: String) {}
        override fun onActiveSuccess(deviceBean: DeviceBean) {
          val device = mapOf(
            "devId" to (deviceBean.devId ?: ""),
            "name" to (deviceBean.name ?: ""),
            "productId" to (deviceBean.productId ?: "")
          )
          promise.resolve(listOf(device))
          cleanup()
        }
        override fun onActiveError(errorBean: ThingDeviceActiveErrorBean) {
          promise.reject("pairing_failed", "Echec de l'appairage: $errorBean", null)
          cleanup()
        }
        override fun onActiveLimited(limitBean: ThingDeviceActiveLimitBean) {
          promise.reject("pairing_limited", "Appairage limite: $limitBean", null)
          cleanup()
        }
      })

    manager.startActive(builder)
  }

  private fun cleanup() {
    activeManager?.stopActive()
    activeManager = null
  }
}
