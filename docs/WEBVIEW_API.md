# Physio3D — 3D Anatomy & AI Treatment WebView API Integration Guide

This guide explains how to embed the **Physio3D** engine inside your mobile or desktop application via WebView, and receive event callbacks whenever a user taps a muscle or structure to feed into an AI treatment workflow.

---

## 1. Quick URL Configuration (Query Parameters)

When opening the page in your WebView, you can customize its appearance and behavior directly through URL query parameters:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `sex` | `male` \| `female` | `male` | Switches the body model |
| `lang` | `en` \| `ar` | `en` | Sets language for names (English or Arabic) |
| `bg` | string | `#f3f4f4` | Background color (`transparent`, hex like `121212`, or `#ffffff`) |
| `rotate` | `true` \| `false` | `false` | Enables gentle auto-orbit rotation |
| `view` | `front` \| `back` \| `side` \| `three-quarter` | `three-quarter` | Initial camera angle |
| `skeleton` | `true` \| `false` | `false` | When true, renders bones alongside muscles |

**Example URL:**
```
http://localhost:3016/?sex=male&bg=transparent&view=front
```

---

## 2. Event Payload Structure

Every time the user taps a muscle on the 3D model, the WebView dispatches the following JSON data structure to your application:

```json
{
  "type": "MUSCLE_CLICK",
  "event": "muscleClick",
  "id": "FJ1294",
  "name": "Biceps brachii",
  "nameAr": "العضلة ذات الرأسين العضدية",
  "system": "muscular",
  "conceptId": "FMA11888",
  "bounds": [
    [-0.18, 0.98, 0.02],
    [-0.12, 1.25, 0.08]
  ],
  "center": {
    "x": -0.15,
    "y": 1.115,
    "z": 0.05
  },
  "sex": "male",
  "timestamp": 1731508200000
}
```

When empty background space is tapped (deselection):
```json
{
  "type": "MUSCLE_DESELECTED",
  "event": "muscleDeselect",
  "data": null
}
```

---

## 3. Native App Integration Examples

### A. Flutter (`webview_flutter`)

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class MuscleAtlasWebView extends StatefulWidget {
  @override
  _MuscleAtlasWebViewState createState() => _MuscleAtlasWebViewState();
}

class _MuscleAtlasWebViewState extends State<MuscleAtlasWebView> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'MuscleChannel',
        onMessageReceived: (JavaScriptMessage message) {
          final data = jsonDecode(message.message);
          if (data['type'] == 'MUSCLE_CLICK') {
            final muscleName = data['name'];
            final arabicName = data['nameAr'];
            print('Muscle clicked: $muscleName ($arabicName)');
            // Update your Flutter app state here!
          }
        },
      )
      ..loadRequest(Uri.parse('https://your-hosted-atlas-url.com/?bg=transparent'));
  }

  // Programmatically highlight a muscle from Flutter
  void highlightMuscle(String name) {
    _controller.runJavaScript("window.AtlasAPI.selectMuscle('$name');");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('3D Muscle Atlas')),
      body: WebViewWidget(controller: _controller),
    );
  }
}
```

---

### B. Flutter (`flutter_inappwebview`)

```dart
InAppWebView(
  initialUrlRequest: URLRequest(url: WebUri('https://your-hosted-atlas-url.com/')),
  onWebViewCreated: (controller) {
    controller.addJavaScriptHandler(
      handlerName: 'onMuscleClick',
      callback: (args) {
        final muscle = args[0];
        print('Clicked muscle: ${muscle['name']}');
      },
    );
  },
)
```

---

### C. React Native (`react-native-webview`)

```tsx
import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';

export default function MuscleScreen() {
  const webViewRef = useRef<WebView>(null);

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MUSCLE_CLICK') {
        console.log('Selected muscle:', data.name, data.nameAr);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Programmatically select a muscle from React Native:
  const selectDeltoid = () => {
    webViewRef.current?.injectJavaScript("window.AtlasAPI.selectMuscle('deltoid'); true;");
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://your-hosted-atlas-url.com/?bg=transparent' }}
        onMessage={onMessage}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
```

---

### D. Android Native (Kotlin)

```kotlin
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true

        // Register the JS interface
        webView.addJavascriptInterface(WebAppInterface(), "Android")

        webView.loadUrl("https://your-hosted-atlas-url.com/?bg=transparent")
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun onMuscleClick(jsonString: String) {
            val json = JSONObject(jsonString)
            val name = json.optString("name")
            val arabic = json.optString("nameAr")
            runOnUiThread {
                println("Muscle tapped: $name ($arabic)")
            }
        }
    }

    // Programmatic trigger
    fun selectMuscleInWebView(name: String) {
        webView.evaluateJavascript("window.AtlasAPI.selectMuscle('$name')", null)
    }
}
```

---

### E. iOS Native (Swift + WKWebView)

```swift
import UIKit
import WebKit

class MuscleAtlasViewController: UIViewController, WKScriptMessageHandler {
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        let contentController = WKUserContentController()
        contentController.add(self, name: "muscleClick")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        webView = WKWebView(frame: view.bounds, configuration: config)
        view.addSubview(webView)

        if let url = URL(string: "https://your-hosted-atlas-url.com/?bg=transparent") {
            webView.load(URLRequest(url: url))
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "muscleClick", let body = message.body as? [String: Any] {
            let name = body["name"] as? String ?? ""
            let arabic = body["nameAr"] as? String ?? ""
            print("Muscle clicked: \(name) (\(arabic))")
        }
    }

    // Programmatic trigger
    func selectMuscle(name: String) {
        webView.evaluateJavaScript("window.AtlasAPI.selectMuscle('\(name)')", completionHandler: nil)
    }
}
```

---

## 4. In-Page JavaScript API (`window.AtlasAPI`)

If you want to control the 3D model from JavaScript, `window.AtlasAPI` provides full programmatic access:

| Method | Parameters | Description |
| :--- | :--- | :--- |
| `AtlasAPI.selectMuscle(query)` | `idOrName: string` | Highlights muscle by ID or name (English or Arabic) |
| `AtlasAPI.clearSelection()` | - | Clears the current muscle selection |
| `AtlasAPI.setSex(sex)` | `'male' \| 'female'` | Switches between male and female models |
| `AtlasAPI.setView(view)` | `'front' \| 'back' \| 'side' \| 'three-quarter'` | Rotates camera to preset angle |
| `AtlasAPI.setRotate(bool)` | `boolean` | Starts or stops auto-rotation |
| `AtlasAPI.resetCamera()` | - | Resets camera to default framing |
| `AtlasAPI.showSkeleton(bool)` | `boolean` | Toggles bones visibility |
| `AtlasAPI.getMuscles()` | - | Returns array of all muscles in model |
| `AtlasAPI.getSelected()` | - | Returns currently selected muscle object |
| `AtlasAPI.onMuscleClick(fn)` | `callback` | Registers a listener for clicks |
| `AtlasAPI.onReady(fn)` | `callback` | Notified when 3D model finishes loading |
