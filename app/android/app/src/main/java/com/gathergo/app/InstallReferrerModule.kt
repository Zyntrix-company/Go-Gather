package com.gathergo.app

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reads the Play Install Referrer once, on the first launch after install.
 *
 * The invite landing page appends `referrer=invite%3D{type}%2F{token}` to the Play Store
 * URL; Play hands it back here after the install. JS parses it and feeds the existing
 * pendingInviteStore (see app/src/utils/installReferrer.ts).
 */
class InstallReferrerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "InstallReferrer"

  /**
   * Resolves the referrer string, or null when there is none to act on.
   * Resolves a given install's referrer at most once: after a definitive answer
   * (a value, or "not supported") later calls resolve null. A transient failure
   * (Play service unavailable) is not recorded, so the next launch retries.
   */
  @ReactMethod
  fun consumeInstallReferrer(promise: Promise) {
    val prefs = reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (prefs.getBoolean(KEY_CONSUMED, false)) {
      promise.resolve(null)
      return
    }

    val client = InstallReferrerClient.newBuilder(reactApplicationContext).build()
    val settled = AtomicBoolean(false)

    fun settle(referrer: String?, definitive: Boolean) {
      if (!settled.compareAndSet(false, true)) return
      if (definitive) prefs.edit().putBoolean(KEY_CONSUMED, true).apply()
      try { client.endConnection() } catch (_: Exception) {}
      promise.resolve(referrer)
    }

    try {
      client.startConnection(object : InstallReferrerStateListener {
        override fun onInstallReferrerSetupFinished(responseCode: Int) {
          when (responseCode) {
            InstallReferrerClient.InstallReferrerResponse.OK ->
              try {
                settle(client.installReferrer.installReferrer, definitive = true)
              } catch (_: Exception) {
                settle(null, definitive = false)
              }
            // Play Store missing or too old for the API — retrying won't help.
            InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED ->
              settle(null, definitive = true)
            else -> settle(null, definitive = false)
          }
        }

        override fun onInstallReferrerServiceDisconnected() {
          settle(null, definitive = false)
        }
      })
    } catch (_: Exception) {
      settle(null, definitive = false)
    }
  }

  private companion object {
    const val PREFS = "gathergo_install_referrer"
    const val KEY_CONSUMED = "consumed"
  }
}
