package com.barerp.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Atualização do APK direto pelo app (sem Play Store): baixa o APK da release do GitHub
 * e abre o instalador do Android. O APK precisa ser assinado com a mesma release.keystore.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            String pkg = getContext().getPackageName();
            PackageInfo info = getContext().getPackageManager().getPackageInfo(pkg, 0);
            JSObject ret = new JSObject();
            ret.put("packageName", pkg);
            ret.put("versionName", info.versionName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Não foi possível ler a versão do app: " + e.getMessage());
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL do APK não informada");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Sem espaço para salvar a atualização");
                File apk = new File(dir, "update.apk");
                File partial = new File(dir, "update.apk.part");

                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) throw new Exception("Servidor de atualização respondeu HTTP " + status);

                long total = conn.getContentLengthLong();
                long received = 0;
                int lastPercent = -1;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        received += read;
                        int percent = total > 0 ? (int) (received * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("receivedBytes", received);
                            progress.put("totalBytes", total);
                            notifyListeners("downloadProgress", progress);
                        }
                    }
                }

                if (total > 0 && received != total) throw new Exception("Download incompleto, tente novamente");
                if (apk.exists() && !apk.delete()) throw new Exception("Não foi possível substituir o APK anterior");
                if (!partial.renameTo(apk)) throw new Exception("Não foi possível salvar o APK");

                JSObject ret = new JSObject();
                ret.put("path", apk.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Falha ao baixar a atualização: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        File apk = path != null ? new File(path) : null;
        if (apk == null || !apk.exists()) {
            call.reject("APK da atualização não encontrado, baixe novamente", "APK_MISSING");
            return;
        }

        // Android 8+: o usuário precisa liberar "Instalar apps desconhecidos" para este app uma vez
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            call.reject("Permita \"Instalar apps desconhecidos\" para o BarERP e toque em Instalar de novo.", "INSTALL_PERMISSION");
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir o instalador: " + e.getMessage());
        }
    }
}
