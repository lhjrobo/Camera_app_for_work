package com.workcameraapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ShutterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "ShutterModule"

    @ReactMethod
    fun setVolumeInterceptionEnabled(enabled: Boolean) {
        MainActivity.shouldInterceptVolumeKeys = enabled
    }
}
