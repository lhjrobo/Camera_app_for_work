package com.workcameraapp

import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.mrousavy.camera.core.Camera2SettingsHolder

class Camera2SettingsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        private const val TAG = "Camera2Settings"
    }

    override fun getName(): String = "Camera2SettingsModule"

    @ReactMethod
    fun getAvailableEdgeModes(promise: Promise) {
        try {
            val context = reactApplicationContext
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraIds = cameraManager.cameraIdList
            
            val result = Arguments.createMap()
            
            for (cameraId in cameraIds) {
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val edgeModes = characteristics.get(CameraCharacteristics.EDGE_AVAILABLE_EDGE_MODES)
                
                val modesArray = Arguments.createArray()
                modesArray.pushString("default")
                
                edgeModes?.forEach { mode ->
                    when (mode) {
                        CameraMetadata.EDGE_MODE_OFF -> modesArray.pushString("off")
                        CameraMetadata.EDGE_MODE_FAST -> modesArray.pushString("fast")
                        CameraMetadata.EDGE_MODE_HIGH_QUALITY -> modesArray.pushString("high_quality")
                    }
                }
                
                result.putArray(cameraId, modesArray)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting edge modes", e)
            promise.reject("EDGE_MODE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getAvailableNoiseReductionModes(promise: Promise) {
        try {
            val context = reactApplicationContext
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraIds = cameraManager.cameraIdList
            
            val result = Arguments.createMap()
            
            for (cameraId in cameraIds) {
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val nrModes = characteristics.get(CameraCharacteristics.NOISE_REDUCTION_AVAILABLE_NOISE_REDUCTION_MODES)
                
                val modesArray = Arguments.createArray()
                modesArray.pushString("default")
                
                nrModes?.forEach { mode ->
                    when (mode) {
                        CameraMetadata.NOISE_REDUCTION_MODE_OFF -> modesArray.pushString("off")
                        CameraMetadata.NOISE_REDUCTION_MODE_FAST -> modesArray.pushString("fast")
                        CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY -> modesArray.pushString("high_quality")
                        CameraMetadata.NOISE_REDUCTION_MODE_MINIMAL -> modesArray.pushString("minimal")
                    }
                }
                
                result.putArray(cameraId, modesArray)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting noise reduction modes", e)
            promise.reject("NOISE_REDUCTION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setEdgeMode(mode: String, promise: Promise) {
        try {
            val edgeModeValue = when (mode) {
                "off" -> CameraMetadata.EDGE_MODE_OFF
                "fast" -> CameraMetadata.EDGE_MODE_FAST
                "high_quality" -> CameraMetadata.EDGE_MODE_HIGH_QUALITY
                else -> -1 // default - let camera decide
            }
            Camera2SettingsHolder.edgeMode = edgeModeValue
            Log.d(TAG, "Edge mode set to: $mode ($edgeModeValue)")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting edge mode", e)
            promise.reject("SET_EDGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setNoiseReductionMode(mode: String, promise: Promise) {
        try {
            val nrModeValue = when (mode) {
                "off" -> CameraMetadata.NOISE_REDUCTION_MODE_OFF
                "fast" -> CameraMetadata.NOISE_REDUCTION_MODE_FAST
                "high_quality" -> CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY
                "minimal" -> CameraMetadata.NOISE_REDUCTION_MODE_MINIMAL
                else -> -1 // default - let camera decide
            }
            Camera2SettingsHolder.noiseReductionMode = nrModeValue
            Log.d(TAG, "Noise reduction mode set to: $mode ($nrModeValue)")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting noise reduction mode", e)
            promise.reject("SET_NOISE_REDUCTION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getCurrentSettings(promise: Promise) {
        val result = Arguments.createMap()
        
        val edgeMode = Camera2SettingsHolder.edgeMode
        result.putString("edgeMode", when (edgeMode) {
            CameraMetadata.EDGE_MODE_OFF -> "off"
            CameraMetadata.EDGE_MODE_FAST -> "fast"
            CameraMetadata.EDGE_MODE_HIGH_QUALITY -> "high_quality"
            else -> "default"
        })
        
        val noiseReductionMode = Camera2SettingsHolder.noiseReductionMode
        result.putString("noiseReductionMode", when (noiseReductionMode) {
            CameraMetadata.NOISE_REDUCTION_MODE_OFF -> "off"
            CameraMetadata.NOISE_REDUCTION_MODE_FAST -> "fast"
            CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY -> "high_quality"
            CameraMetadata.NOISE_REDUCTION_MODE_MINIMAL -> "minimal"
            else -> "default"
        })
        
        promise.resolve(result)
    }
}
