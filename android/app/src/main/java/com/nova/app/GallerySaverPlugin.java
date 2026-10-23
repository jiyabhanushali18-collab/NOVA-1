package com.nova.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "GallerySaver")
public class GallerySaverPlugin extends Plugin {

    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String base64Data = call.getString("data");
        String filename = call.getString("filename");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Image data is required");
            return;
        }

        if (filename == null || filename.isEmpty()) {
            filename = "NOVA_Look_" + System.currentTimeMillis() + ".jpg";
        }

        if (base64Data.contains(",")) {
            base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
        }

        try {
            byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

            if (bitmap == null) {
                call.reject("Could not decode image bitmap");
                return;
            }

            ContentResolver resolver = getContext().getContentResolver();
            Uri imageUri = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                contentValues.put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg");
                contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + File.separator + "NOVA");
                contentValues.put(MediaStore.Images.Media.IS_PENDING, 1);

                imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);
                if (imageUri != null) {
                    try (OutputStream outputStream = resolver.openOutputStream(imageUri)) {
                        if (outputStream != null) {
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, outputStream);
                        }
                    }
                    contentValues.clear();
                    contentValues.put(MediaStore.Images.Media.IS_PENDING, 0);
                    resolver.update(imageUri, contentValues, null, null);
                }
            } else {
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File novaDir = new File(picturesDir, "NOVA");
                if (!novaDir.exists()) {
                    novaDir.mkdirs();
                }
                File imageFile = new File(novaDir, filename);
                try (FileOutputStream out = new FileOutputStream(imageFile)) {
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 95, out);
                }
                imageUri = Uri.fromFile(imageFile);

                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DATA, imageFile.getAbsolutePath());
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            }

            if (imageUri != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", imageUri.toString());
                ret.put("filename", filename);
                call.resolve(ret);
            } else {
                call.reject("Failed to create gallery media entry");
            }

        } catch (Exception e) {
            call.reject("Error saving image to gallery: " + e.getMessage(), e);
        }
    }
}
