# Physio3D — Interactive 3D Anatomy & Physiotherapy Engine

Physio3D is a high-performance interactive 3D human anatomy engine built for web and mobile WebView applications. It renders a complete 3D musculoskeletal human body with real-time selection, responsive orbit controls, and an event bridge designed to connect 3D muscle interactions directly to external applications and physiotherapy AI treatment pipelines.

Developed by **Aymane Rahhaoui** ([@aymanoxrh](https://github.com/aymanoxrh)).

---

## 🚀 Features

- **Full 3D Musculoskeletal Model**: Renders a complete anatomical human body from head to toe, including the skull, facial musculature, arms, torso, knees (patella), shins, and feet.
- **Precision Touch & Mouse Picking**: GPU raycasting allows users to tap or click any individual muscle or bone with instant visual highlight feedback.
- **WebView Integration API**: Seamlessly embed inside mobile apps with bi-directional communication channels for:
  - **Flutter** (`webview_flutter` & `flutter_inappwebview`)
  - **React Native** (`react-native-webview`)
  - **Android** (`WebView` + `@JavascriptInterface`)
  - **iOS** (`WKWebView` + `WKScriptMessageHandler`)
  - **Web / iframes** (standard HTML5 `postMessage`)
- **Multi-Language Support**: Complete anatomical names in both English and Arabic.
- **AI-Ready Payload**: Every click outputs a structured JSON payload containing the anatomical name, Arabic translation, unique concept ID, and 3D coordinate bounding box ready to feed into AI treatment and recovery workflows.
- **Ultra-Fast & Responsive**: Built on React 19, Vite, and Three.js with batched GPU buffer geometries and custom shaders for 60fps rendering on mobile devices.

---

## 🛠️ Tech Stack

- **Frontend Core**: React 19, TypeScript
- **3D Graphics Engine**: Three.js, OrbitControls, WebGL
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

---

## 📦 Getting Started

### Prerequisites

- Node.js 22.13 or newer
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aymanoxrh/physio-3d.git
cd physio-3d
```

2. Install dependencies:
```bash
npm install
```

3. Start the local development server:
```bash
npm run dev
```

4. Open your browser:
- **3D Model**: [http://localhost:3016](http://localhost:3016)
- **WebView & AI Treatment Simulator**: [http://localhost:3016/webview-test.html](http://localhost:3016/webview-test.html)

---

## 📱 Mobile App (WebView) Integration

### URL Query Parameters

| Parameter | Options | Default | Description |
| :--- | :--- | :--- | :--- |
| `sex` | `male` \| `female` | `male` | Switches anatomical reference body |
| `lang` | `en` \| `ar` | `en` | Sets language for anatomical names |
| `bg` | `transparent` \| hex | `#f3f4f4` | Viewport background color |
| `view` | `front` \| `back` \| `side` \| `three-quarter` | `three-quarter` | Initial camera angle |
| `rotate` | `true` \| `false` | `false` | Auto-orbit rotation |

### Flutter Example

```dart
WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..addJavaScriptChannel(
    'MuscleChannel',
    onMessageReceived: (JavaScriptMessage message) {
      final data = jsonDecode(message.message);
      if (data['type'] == 'MUSCLE_CLICK') {
        print("Tapped muscle: ${data['name']} (${data['nameAr']})");
        // Forward to your AI treatment API
      }
    },
  )
  ..loadRequest(Uri.parse('https://your-domain.com/?bg=transparent'));
```

### React Native Example

```tsx
<WebView
  source={{ uri: 'https://your-domain.com/?bg=transparent' }}
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'MUSCLE_CLICK') {
      console.log('Selected muscle:', data.name);
      // Trigger AI rehabilitation advice
    }
  }}
  style={{ flex: 1, backgroundColor: 'transparent' }}
/>
```

---

## ⚡ Programmatic JavaScript API (`window.Physio3D`)

Control the 3D model from your application using the exposed API:

```javascript
// Select and highlight a muscle by name or ID
window.Physio3D.selectMuscle('biceps brachii');

// Change camera angle
window.Physio3D.setView('front');

// Toggle auto-rotation
window.Physio3D.setRotate(true);

// Clear selection
window.Physio3D.clearSelection();

// Get list of all muscles
const muscles = window.Physio3D.getMuscles();
```

---

## 📄 License

MIT License © 2026 Aymane Rahhaoui
