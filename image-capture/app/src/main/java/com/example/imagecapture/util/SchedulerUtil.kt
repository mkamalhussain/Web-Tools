package com.example.imagecapture.util

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.example.imagecapture.receiver.ConfigCheckReceiver

object SchedulerUtil {
    fun scheduleConfigChecks(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ConfigCheckReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            context,
            3001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val intervalMillis = 10 * 60 * 1000L
        val triggerAt = System.currentTimeMillis() + 5_000L
        am.setRepeating(AlarmManager.RTC_WAKEUP, triggerAt, intervalMillis, pi)
    }
}