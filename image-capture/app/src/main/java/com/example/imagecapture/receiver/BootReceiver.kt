package com.example.imagecapture.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.example.imagecapture.util.SchedulerUtil

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        SchedulerUtil.scheduleConfigChecks(context)
    }
}