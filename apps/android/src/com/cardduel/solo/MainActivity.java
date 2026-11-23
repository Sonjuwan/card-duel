package com.cardduel.solo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** Offline-only shell. The sole web document is packaged inside this APK. */
public final class MainActivity extends Activity {
    private static final String APP_URL = "https://appassets.androidplatform.net/card-duel/index.html";
    private static final int DOCUMENT_REQUEST = 401;
    private final AtomicReference<Pending> pending = new AtomicReference<>();
    private WebView web;
    private boolean destroyed;

    private static final class Pending {
        final String id, operation, filename, json;
        Pending(String id, String operation, String filename, String json) { this.id=id; this.operation=operation; this.filename=filename; this.json=json; }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(33,27,25));
        getWindow().setNavigationBarColor(Color.rgb(33,27,25));
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String scheme=request.getUrl().getScheme();
                if ("data".equals(scheme)||"blob".equals(scheme)) return null;
                if (APP_URL.equals(request.getUrl().toString())&&"GET".equals(request.getMethod())) {
                    try { return new WebResourceResponse("text/html","UTF-8",getAssets().open("index.html")); }
                    catch(IOException ignored) { /* Fail closed rather than attempting a network load. */ }
                }
                return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                view.removeJavascriptInterface("CardDuelAndroid");
                Button retry=new Button(MainActivity.this);retry.setText("게임 화면 다시 열기 · 자동 저장 확인");retry.setOnClickListener(v->recreate());
                setContentView(retry);view.destroy();web=null;return true;
            }
        });
        web.addJavascriptInterface(new BackupBridge(),"CardDuelAndroid");
        setContentView(web);
        // An HTTPS base URL supplies a stable storage origin without requesting
        // any network permission. The HTML and worker are entirely embedded.
        try(InputStream in=getAssets().open("index.html")) {
            String html=BackupPayload.readUtf8(in,32*1024*1024);
            web.loadDataWithBaseURL(APP_URL,html,"text/html","UTF-8",APP_URL);
        } catch(Exception e) { new AlertDialog.Builder(this).setMessage("게임 파일을 읽지 못했습니다. 올바른 APK인지 확인하세요.").setPositiveButton("종료",(d,w)->finish()).show(); }
    }

    public final class BackupBridge {
        @JavascriptInterface public boolean requestBackup(String id,String operation,String filename,String json) {
            if(!BackupPayload.validRequest(id,operation,filename,json))return false;
            if("save".equals(operation))try{requireBackup(json);}catch(Exception e){return false;}
            Pending task=new Pending(id,operation,filename,json);
            if(!pending.compareAndSet(null,task))return false;
            runOnUiThread(()->launchDocument(task));return true;
        }
    }

    private void launchDocument(Pending task) {
        if(destroyed||web==null){complete(task,false,"게임 화면이 닫혔습니다.");return;}
        Intent intent=new Intent("save".equals(task.operation)?Intent.ACTION_CREATE_DOCUMENT:Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        if("save".equals(task.operation)){
            intent.putExtra(Intent.EXTRA_TITLE,task.filename);intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        }else{
            intent.setType("*/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        try{startActivityForResult(intent,DOCUMENT_REQUEST);}catch(Exception e){complete(task,false,"Android 파일 선택기를 열 수 없습니다.");}
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=DOCUMENT_REQUEST)return;
        Pending task=pending.get();if(task==null)return;
        final Uri uri=data==null?null:data.getData();
        if(resultCode!=RESULT_OK||uri==null){complete(task,false,"파일 선택을 취소했습니다.");return;}
        if(!"content".equals(uri.getScheme())){complete(task,false,"지원하지 않는 파일 위치입니다.");return;}
        new Thread(()->{
            try{
                if("save".equals(task.operation)){
                    try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){
                        if(out==null)throw new IOException();out.write(task.json.getBytes(StandardCharsets.UTF_8));out.flush();
                    }
                    complete(task,true,"");
                }else{
                    String text;
                    try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new IOException();text=BackupPayload.readUtf8(in,BackupPayload.LIMIT);}
                    requireBackup(text);complete(task,true,text);
                }
            }catch(Exception e){complete(task,false,"백업 파일을 읽거나 쓰지 못했습니다. JSON 파일 형식과 저장 공간을 확인하세요.");}
        },"card-duel-backup").start();
    }

    private void complete(Pending task,boolean ok,String value){
        runOnUiThread(()->{
            if(!pending.compareAndSet(task,null)||destroyed||web==null)return;
            String script="window.__cardDuelAndroidResult&&window.__cardDuelAndroidResult("+JSONObject.quote(task.id)+","+ok+","+JSONObject.quote(value)+")";
            web.evaluateJavascript(script,null);
        });
    }

    private static void requireBackup(String text)throws Exception{
        JSONObject value=new JSONObject(text);String format=value.optString("format");
        if(!"card-duel-offline-growth".equals(format)&&!"card-duel-saved-decks".equals(format))throw new IOException();
        if(value.optInt("schema",-1)!=1)throw new IOException();
    }

    @Override public void onBackPressed(){new AlertDialog.Builder(this).setMessage("자동 저장 상태를 확인했나요? 게임을 종료할까요?").setNegativeButton("계속",null).setPositiveButton("종료",(d,w)->finish()).show();}
    @Override protected void onPause(){if(web!=null)web.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){destroyed=true;pending.set(null);if(web!=null){web.removeJavascriptInterface("CardDuelAndroid");web.destroy();web=null;}super.onDestroy();}
}
