package com.gyanodayniketan.erp;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.content.ContentValues;
import android.util.Base64;
import android.widget.Toast;
import android.media.MediaScannerConnection;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private ActivityResultLauncher<String[]> locationPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register permission launcher for explicit native location requests
        locationPermissionLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            result -> {
                boolean fineGranted = Boolean.TRUE.equals(result.get(Manifest.permission.ACCESS_FINE_LOCATION));
                boolean coarseGranted = Boolean.TRUE.equals(result.get(Manifest.permission.ACCESS_COARSE_LOCATION));
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        getBridge().getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('nativeLocationPermissionResult', { detail: { granted: " + (fineGranted || coarseGranted) + ", fine: " + fineGranted + " } }));",
                            null
                        );
                    });
                }
            }
        );

        // Expose Native Android Location & Settings Bridge to WebView
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new GyanodayNativeBridge(), "GyanodayNative");
            getBridge().getWebView().setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setData(Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        // Register modern AndroidX back button dispatcher to handle in-app history and modals
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    public class GyanodayNativeBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public boolean hasLocationPermission() {
            boolean fine = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean coarse = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            return fine || coarse;
        }

        @JavascriptInterface
        public boolean isGpsEnabled() {
            try {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                return lm != null && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                locationPermissionLauncher.launch(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                });
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", getPackageName(), null);
                intent.setData(uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(fallback);
            }
        }

        @JavascriptInterface
        public void openLocationSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                openAppSettings();
            }
        }

        @JavascriptInterface
        public boolean saveAndDownloadFile(String base64Data, String mimeType, String fileName) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                            }
                        }
                    }
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File file = new File(dir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(MainActivity.this, new String[]{file.getAbsolutePath()}, null, null);
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Downloaded: " + fileName, Toast.LENGTH_LONG).show());
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }

        @JavascriptInterface
        public boolean shareFile(String base64Data, String mimeType, String fileName) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                File cacheDir = getCacheDir();
                File file = new File(cacheDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(bytes);
                    fos.flush();
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(mimeType);
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(shareIntent, "Share Marksheet"));
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
}

