package com.example.imagecapture.receiver

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.imagecapture.service.CaptureService
import com.example.imagecapture.util.ConfigUtils

class ConfigCheckReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val cfg = ConfigUtils.ensureDefault(context)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Cancel any previous capture alarms to avoid duplicates
        val cancelIntent = Intent(context, CaptureService::class.java).apply { action = "START_CAPTURE" }
        val cancelPi = PendingIntent.getService(
            context,
            4001,
            cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.cancel(cancelPi)

        if (cfg.enabled == 1) {
            val startIntent = Intent(context, CaptureService::class.java).apply { action = "START_CAPTURE" }
            val pi = PendingIntent.getService(
                context,
                4001,
                startIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val intervalMillis = cfg.intervalMinutes * 60 * 1000L
            val triggerAt = System.currentTimeMillis() + 1_000L
            am.setRepeating(AlarmManager.RTC_WAKEUP, triggerAt, intervalMillis, pi)
        } else {
            // Ensure service stops
            val stopIntent = Intent(context, CaptureService::class.java).apply { action = "STOP_CAPTURE" }
            context.startService(stopIntent)
        }
    }
}