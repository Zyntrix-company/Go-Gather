package com.gathergo.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(FilePickerPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    createNotificationChannels()
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return

    // Standard notifications — shown in notification drawer, no lock-screen override
    NotificationChannel(
      "default",
      "General Notifications",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).also { manager.createNotificationChannel(it) }

    // Time-sensitive alerts (trip cancelled, invites, friend requests)
    NotificationChannel(
      "critical",
      "Important Alerts",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      enableVibration(true)
    }.also { manager.createNotificationChannel(it) }
  }
}
