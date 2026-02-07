package com.workcameraapp

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.view.KeyEvent
import com.github.kevinejohn.keyevent.KeyEventModule

class MainActivity : ReactActivity() {

  companion object {
    var shouldInterceptVolumeKeys = false
  }

  override fun onCreate(savedInstanceState: android.os.Bundle?) {
    super.onCreate(savedInstanceState)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
      val attributes = window.attributes
      attributes.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      window.attributes = attributes
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "WorkCameraApp_v2"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // Intercept volume button key events before they are handled by the system
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val keyCode = event.keyCode
    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
      if (shouldInterceptVolumeKeys) {
        if (event.action == KeyEvent.ACTION_DOWN) {
          if (event.repeatCount == 0) {
            android.util.Log.d("WorkCameraApp", "Native: Forwarding volume key $keyCode to RN")
            KeyEventModule.getInstance().onKeyDownEvent(keyCode, event)
          }
        } else if (event.action == KeyEvent.ACTION_UP) {
          KeyEventModule.getInstance().onKeyUpEvent(keyCode, event)
        }
        // Return true to consume the event and prevent system volume change
        return true
      }
    }
    return super.dispatchKeyEvent(event)
  }
}
