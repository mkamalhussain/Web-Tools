package com.example.imagecapture

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.core.content.ContextCompat
import com.example.imagecapture.util.SchedulerUtil

class MainActivity : ComponentActivity() {
    private val requestPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        SchedulerUtil.scheduleConfigChecks(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                val granted = remember { mutableStateOf(false) }
                Column(modifier = androidx.compose.ui.Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
                    Text("Image Capture runs in background via config.")
                    Button(onClick = {
                        val perms = arrayOf(
                            Manifest.permission.CAMERA,
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                        val ok = perms.all {
                            ContextCompat.checkSelfPermission(this@MainActivity, it) == PackageManager.PERMISSION_GRANTED
                        }
                        granted.value = ok
                        if (!ok) {
                            requestPermission.launch(perms)
                        } else {
                            SchedulerUtil.scheduleConfigChecks(this@MainActivity)
                        }
                    }) { Text("Initialize") }
                    if (granted.value) {
                        Text("Permissions granted. Scheduler active.")
                    }
                }
            }
        }
    }
}