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
import com.thingclips.smart.sdk.api.IThingActivator
import com.thingclips.smart.sdk.api.IThingActivatorGetToken
import com.thingclips.smart.sdk.api.IThingSmartActivatorListener
import com.thingclips.smart.sdk.bean.DeviceBean
import com.thingclips.smart.sdk.builder.ThingActivatorBuilder
import com.thingclips.smart.sdk.enums.ActivatorModelEnum

// ─────────────────────────────────────────────────────────────────────────────
// Module natif d'appairage Tuya (modele C) — Android. Encapsule le device activator
// du SDK Tuya (Smart Life App SDK 7.5.x, namespace com.thingclips.smart). Enregistre
// sous « TuyaPairing », consomme par src/native/tuyaPairing.ts.
//
// NB API : les classes/methodes Tuya marquees « VALIDATION » sont a confirmer au 1er
// build EAS (le SDK 7.5.x "Thing" peut differer). La structure (callbacks, promises) est stable.
// ─────────────────────────────────────────────────────────────────────────────

class StartPairingParams : Record {
  @Field var mode: String = "EZ"
  @Field var ssid: String = ""
  @Field var password: String = ""
  @Field var token: String = ""
  @Field var timeoutSec: Double = 100.0
}

class TuyaPairingModule : Module() {

  private var activator: IThingActivator? = null

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
    // VALIDATION : loginWithUid pour un compte app cree via apps/{schema}/user — a aligner
    // avec username_type cote backend createAppUser.
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
          ThingHomeSdk.getActivatorInstance().getActivatorToken(homeId, object : IThingActivatorGetToken {
            override fun onSuccess(token: String) {
              promise.resolve(token)
            }
            override fun onFailure(code: String, error: String) {
              promise.reject("token_failed", error, null)
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

    val context = appContext.reactContext?.applicationContext
    if (context == null) {
      promise.reject("no_context", "Application context indisponible", null)
      return
    }

    val model = if (params.mode == "AP") ActivatorModelEnum.THING_AP else ActivatorModelEnum.THING_EZ

    val builder = ThingActivatorBuilder()
      .setContext(context)
      .setSsid(params.ssid)
      .setPassword(params.password)
      .setActivatorModel(model)
      .setTimeOut(params.timeoutSec.toLong())
      .setToken(params.token)
      .setListener(object : IThingSmartActivatorListener {
        override fun onError(errorCode: String, errorMsg: String) {
          promise.reject("pairing_failed", errorMsg, null)
          cleanup()
        }

        override fun onActiveSuccess(devResp: DeviceBean) {
          val device = mapOf(
            "devId" to (devResp.devId ?: ""),
            "name" to (devResp.name ?: ""),
            "productId" to (devResp.productId ?: ""),
            "category" to (devResp.getCategory() ?: "")
          )
          promise.resolve(listOf(device))
          cleanup()
        }

        override fun onStep(step: String, data: Any?) {
          // Progression (facultatif) — pourra etre relaye via un event Expo plus tard.
        }
      })

    activator = ThingHomeSdk.getActivatorInstance().newActivator(builder)
    activator?.start()
  }

  private fun cleanup() {
    activator?.stop()
    activator?.onDestroy()
    activator = null
  }
}
