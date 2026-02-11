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
    fun getAvailableTonemapModes(promise: Promise) {
        try {
            val context = reactApplicationContext
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraIds = cameraManager.cameraIdList
            
            val result = Arguments.createMap()
            
            for (cameraId in cameraIds) {
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val tonemapModes = characteristics.get(CameraCharacteristics.TONEMAP_AVAILABLE_TONE_MAP_MODES)
                
                val modesArray = Arguments.createArray()
                modesArray.pushString("default")
                
                tonemapModes?.forEach { mode ->
                    when (mode) {
                        CameraMetadata.TONEMAP_MODE_CONTRAST_CURVE -> modesArray.pushString("contrast_curve")
                        CameraMetadata.TONEMAP_MODE_FAST -> modesArray.pushString("fast")
                        CameraMetadata.TONEMAP_MODE_HIGH_QUALITY -> modesArray.pushString("high_quality")
                        CameraMetadata.TONEMAP_MODE_GAMMA_VALUE -> modesArray.pushString("gamma_value")
                        CameraMetadata.TONEMAP_MODE_PRESET_CURVE -> modesArray.pushString("preset_curve")
                    }
                }
                
                result.putArray(cameraId, modesArray)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting tonemap modes", e)
            promise.reject("TONEMAP_MODE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getAvailableHdrModes(promise: Promise) {
        try {
            val context = reactApplicationContext
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraIds = cameraManager.cameraIdList
            
            val result = Arguments.createMap()
            
            for (cameraId in cameraIds) {
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val sceneModes = characteristics.get(CameraCharacteristics.CONTROL_AVAILABLE_SCENE_MODES)
                val hasHdr = sceneModes?.contains(CameraMetadata.CONTROL_SCENE_MODE_HDR) ?: false
                
                result.putBoolean(cameraId, hasHdr)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting HDR availability", e)
            promise.reject("HDR_AVAILABILITY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getAvailableColorCorrectionModes(promise: Promise) {
        try {
            val context = reactApplicationContext
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraIds = cameraManager.cameraIdList
            
            val result = Arguments.createMap()
            
            for (cameraId in cameraIds) {
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val modes = characteristics.get(CameraCharacteristics.COLOR_CORRECTION_AVAILABLE_MODES)
                
                val modesArray = Arguments.createArray()
                modesArray.pushString("default")
                
                modes?.forEach { mode ->
                    when (mode) {
                        CameraMetadata.COLOR_CORRECTION_MODE_FAST -> modesArray.pushString("fast")
                        CameraMetadata.COLOR_CORRECTION_MODE_HIGH_QUALITY -> modesArray.pushString("high_quality")
                        CameraMetadata.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX -> modesArray.pushString("transform_matrix")
                    }
                }
                
                result.putArray(cameraId, modesArray)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting blocking modes", e)
            promise.reject("COLOR_CORRECTION_ERROR", e.message)
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
    fun setTonemapMode(mode: String, promise: Promise) {
        try {
            val tonemapModeValue = when (mode) {
                "contrast_curve" -> CameraMetadata.TONEMAP_MODE_CONTRAST_CURVE
                "fast" -> CameraMetadata.TONEMAP_MODE_FAST
                "high_quality" -> CameraMetadata.TONEMAP_MODE_HIGH_QUALITY
                "gamma_value" -> CameraMetadata.TONEMAP_MODE_GAMMA_VALUE
                "preset_curve" -> CameraMetadata.TONEMAP_MODE_PRESET_CURVE
                else -> CameraMetadata.TONEMAP_MODE_HIGH_QUALITY // default: force High Quality tone mapping
            }
            Camera2SettingsHolder.tonemapMode = tonemapModeValue
            Log.d(TAG, "Tonemap mode (DRO) set to: $mode ($tonemapModeValue)")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting tonemap mode", e)
            promise.reject("SET_TONEMAP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setHdrMode(enable: Boolean, promise: Promise) {
        try {
            val hdrModeValue = if (enable) CameraMetadata.CONTROL_SCENE_MODE_HDR else -1
            Camera2SettingsHolder.hdrMode = hdrModeValue
            Log.d(TAG, "HDR mode set to: $enable ($hdrModeValue)")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting HDR mode", e)
            promise.reject("SET_HDR_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setColorCorrectionMode(mode: String, promise: Promise) {
        try {
            val ccModeValue = when (mode) {
                "fast" -> CameraMetadata.COLOR_CORRECTION_MODE_FAST
                "high_quality" -> CameraMetadata.COLOR_CORRECTION_MODE_HIGH_QUALITY
                "transform_matrix" -> CameraMetadata.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX
                else -> -1 // default
            }
            Camera2SettingsHolder.colorCorrectionMode = ccModeValue
            Log.d(TAG, "Color correction mode set to: $mode ($ccModeValue)")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting color correction mode", e)
            promise.reject("SET_COLOR_CORRECTION_ERROR", e.message)
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
        
        val tonemapMode = Camera2SettingsHolder.tonemapMode
        result.putString("tonemapMode", when (tonemapMode) {
            CameraMetadata.TONEMAP_MODE_CONTRAST_CURVE -> "contrast_curve"
            CameraMetadata.TONEMAP_MODE_FAST -> "fast"
            CameraMetadata.TONEMAP_MODE_HIGH_QUALITY -> "high_quality"
            CameraMetadata.TONEMAP_MODE_GAMMA_VALUE -> "gamma_value"
            CameraMetadata.TONEMAP_MODE_PRESET_CURVE -> "preset_curve"
            else -> "default"
        })

        val hdrMode = Camera2SettingsHolder.hdrMode
        result.putBoolean("hdrMode", hdrMode == CameraMetadata.CONTROL_SCENE_MODE_HDR)

        val colorCorrectionMode = Camera2SettingsHolder.colorCorrectionMode
        result.putString("colorCorrectionMode", when (colorCorrectionMode) {
            CameraMetadata.COLOR_CORRECTION_MODE_FAST -> "fast"
            CameraMetadata.COLOR_CORRECTION_MODE_HIGH_QUALITY -> "high_quality"
            CameraMetadata.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX -> "transform_matrix"
            else -> "default"
        })
        
        promise.resolve(result)
    }
}
