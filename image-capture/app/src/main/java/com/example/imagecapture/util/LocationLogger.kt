package com.example.imagecapture.util

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.util.Log
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object LocationLogger {
    private fun logDir(context: Context): File {
        val dir = File(context.filesDir, "logs")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private fun logFile(context: Context): File {
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        return File(logDir(context), "gps-${date}.log")
    }

    @SuppressLint("MissingPermission")
    fun logCurrentLocation(context: Context) {
        try {
            val fused: FusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(context)
            fused.lastLocation.addOnSuccessListener { loc: Location? ->
                if (loc != null) {
                    val ts = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
                    val line = "$ts, ${loc.latitude}, ${loc.longitude}, acc=${loc.accuracy}\n"
                    logFile(context).appendText(line)
                    Log.d("LocationLogger", line)
                } else {
                    Log.w("LocationLogger", "No lastLocation available")
                }
            }
        } catch (e: Exception) {
            Log.e("LocationLogger", "Failed to log location", e)
        }
    }
}