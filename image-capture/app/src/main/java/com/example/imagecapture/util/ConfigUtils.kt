package com.example.imagecapture.util

import android.content.Context
import org.json.JSONObject
import java.io.File

object ConfigUtils {
    private const val FILE_NAME = "config.json"

    data class Config(
        val enabled: Int = 1,
        val intervalMinutes: Int = 30,
        val recordTimeMinutes: Int = 5
    )

    fun getConfigFile(context: Context): File = File(context.filesDir, FILE_NAME)

    fun ensureDefault(context: Context): Config {
        val file = getConfigFile(context)
        if (!file.exists()) {
            val def = Config()
            val json = JSONObject().apply {
                put("Enabled", def.enabled)
                put("Interval", def.intervalMinutes)
                put("RecordTime", def.recordTimeMinutes)
            }
            file.writeText(json.toString())
            return def
        }
        return read(context)
    }

    fun read(context: Context): Config {
        val file = getConfigFile(context)
        return try {
            val text = file.readText()
            val json = JSONObject(text)
            Config(
                enabled = json.optInt("Enabled", 1),
                intervalMinutes = json.optInt("Interval", 30),
                recordTimeMinutes = json.optInt("RecordTime", 5)
            )
        } catch (e: Exception) {
            Config()
        }
    }
}