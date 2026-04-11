package com.gathergo.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.database.Cursor;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class FilePickerModule extends ReactContextBaseJavaModule {

    private static final int FILE_PICKER_REQUEST = 71237;
    private Promise pendingPromise;

    public FilePickerModule(ReactApplicationContext context) {
        super(context);
        context.addActivityEventListener(activityEventListener);
    }

    @Override
    public String getName() {
        return "FilePicker";
    }

    @ReactMethod
    public void pick(Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity");
            return;
        }
        pendingPromise = promise;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/jpeg",
            "image/png",
            "image/jpg",
            "text/plain",
        });
        activity.startActivityForResult(intent, FILE_PICKER_REQUEST);
    }

    private final ActivityEventListener activityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode != FILE_PICKER_REQUEST || pendingPromise == null) return;
            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    try {
                        activity.getContentResolver().takePersistableUriPermission(
                            uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                        );
                    } catch (Exception ignored) {}

                    String fileName = "document";
                    String mimeType = activity.getContentResolver().getType(uri);
                    try (Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            if (nameIndex >= 0) {
                                String name = cursor.getString(nameIndex);
                                if (name != null && !name.isEmpty()) fileName = name;
                            }
                        }
                    } catch (Exception ignored) {}

                    // Copy content:// → file:// so React Native fetch/FormData can read it
                    try {
                        File cacheDir = getReactApplicationContext().getCacheDir();
                        File destFile = new File(cacheDir, "filepicker_" + System.currentTimeMillis() + "_" + fileName);
                        try (InputStream in = activity.getContentResolver().openInputStream(uri);
                             OutputStream out = new FileOutputStream(destFile)) {
                            if (in == null) throw new Exception("Cannot open input stream");
                            byte[] buf = new byte[8192];
                            int len;
                            while ((len = in.read(buf)) > 0) {
                                out.write(buf, 0, len);
                            }
                        }
                        WritableMap result = Arguments.createMap();
                        result.putString("uri", "file://" + destFile.getAbsolutePath());
                        result.putString("name", fileName);
                        result.putString("type", mimeType != null ? mimeType : "application/octet-stream");
                        pendingPromise.resolve(result);
                    } catch (Exception e) {
                        // Fallback: return original content:// URI (may still work on some devices)
                        WritableMap result = Arguments.createMap();
                        result.putString("uri", uri.toString());
                        result.putString("name", fileName);
                        result.putString("type", mimeType != null ? mimeType : "application/octet-stream");
                        pendingPromise.resolve(result);
                    }
                } else {
                    pendingPromise.reject("NO_URI", "No file selected");
                }
            } else {
                pendingPromise.reject("CANCELLED", "User cancelled");
            }
            pendingPromise = null;
        }
    };
}
