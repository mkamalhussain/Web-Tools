package com.example.imagecapture.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.concurrent.futures.await
import androidx.core.content.ContextCompat
import com.example.imagecapture.util.ConfigUtils
import com.example.imagecapture.util.LocationLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlinx.coroutines.resumeWithException
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CaptureService : Service() {
    private val scope = CoroutineScope(Dispatchers.Default)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "START_CAPTURE" -> startCaptureSequence()
            "STOP_CAPTURE" -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startCaptureSequence() {
        val cfg = ConfigUtils.ensureDefault(this)
        if (cfg.enabled != 1) {
            stopSelf(); return
        }
        scope.launch {
            try {
                captureImagesAndLogLocation()
            } catch (e: Exception) {
                Log.e(TAG, "Capture failed", e)
            } finally {
                // Service finishes quickly after capture
                stopSelf()
            }
        }
    }

    private suspend fun captureImagesAndLogLocation() {
        val provider = ProcessCameraProvider.getInstance(this).await()
        val imageCapture = ImageCapture.Builder().setTargetRotation(0).build()
        val executor = ContextCompat.getMainExecutor(this)

        fun outputDir(context: Context): File {
            val dir = File(context.filesDir, "captures")
            if (!dir.exists()) dir.mkdirs()
            return dir
        }

        val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

        suspend fun take(selector: CameraSelector, name: String) {
            withContext(Dispatchers.Main) {
                provider.unbindAll()
                provider.bindToLifecycle(FakeLifecycleOwner(), selector, imageCapture)
                val photoFile = File(outputDir(this@CaptureService), "${name}_${ts}.jpg")
                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
                val result = suspendCancellableCoroutine<ImageCapture.OutputFileResults> { cont ->
                    imageCapture.takePicture(outputOptions, executor, object : ImageCapture.OnImageSavedCallback {
                        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                            cont.resume(outputFileResults)
                        }
                        override fun onError(exception: ImageCaptureException) {
                            cont.resumeWithException(exception)
                        }
                    })
                }
                Log.d(TAG, "Saved ${photoFile.absolutePath} (${result.savedUri})")
            }
        }

        // Front then back
        take(CameraSelector.DEFAULT_FRONT_CAMERA, "front")
        take(CameraSelector.DEFAULT_BACK_CAMERA, "back")

        // Log GPS
        LocationLogger.logCurrentLocation(this)
        provider.unbindAll()
    }

    companion object {
        private const val TAG = "CaptureService"
    }
}

// Minimal LifecycleOwner for CameraX binding without UI
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry

private class FakeLifecycleOwner : LifecycleOwner {
    private val registry = LifecycleRegistry(this).apply { currentState = Lifecycle.State.STARTED }
    override fun getLifecycle(): Lifecycle = registry
}