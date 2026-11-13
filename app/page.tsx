import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AnatomyScene from "./scene";
import {
  edition,
  term,
  type Atlas,
  type Part,
  type SceneState,
  type Sex,
  type SystemId,
  type View,
} from "./anatomy";
import TERMS_AR from "./terms-ar.json";
import { say, type Language } from "./i18n";

export interface PartInfo {
  id: string;
  name: string;
  nameAr?: string;
  system: string;
  isMuscle: boolean;
  conceptId?: string;
  bounds: [number[], number[]];
  center: { x: number; y: number; z: number };
  sex: Sex;
  timestamp: number;
}

export type MuscleInfo = PartInfo;

export interface AtlasBridgeEvent {
  type: string;
  event: string;
  isMuscle?: boolean;
  muscle?: MuscleInfo;
  part?: PartInfo;
  payload?: any;
  data?: any;
  [key: string]: any;
}

// Complete anatomical body layers (muscles, skull, bones, joints, eyes, feet, hands)
export const getCompletedBodySystems = (sex: Sex, mode = "complete"): SystemId[] => {
  if (mode === "muscles-only") {
    return sex === "female" ? ["muscular", "donor-muscle"] : ["muscular"];
  }

  // Full completed anatomical human body:
  // - Head: complete skull, cranium, facial bones, eyes, brain, facial muscles
  // - Legs: hips, femur, patella kneecaps, tibia/fibula, calves, ankles, complete feet & toes
  // - Arms: shoulders, humerus, radius/ulna, wrists, complete hands & fingers
  // - Torso: ribcage, spine, pelvis, chest, abs, back muscles, thoracic & abdominal organs
  if (sex === "female") {
    return [
      "muscular",
      "donor-muscle", // Female lower limb muscles
      "skeletal",     // Pelvis, spine, sternum, knees
      "borrowed",     // Skull, ribs, arm bones, feet bones
      "connective",   // Tendons, ligaments, patellar tendon, cartilage
      "sensory",      // Eyes
      "brain",        // Brain regions
      "nervous",      // Nerves, spinal cord
      "cardiac",      // Heart
      "respiratory",  // Larynx, lungs
      "digestive",    // Stomach, liver, intestines
    ];
  }

  return [
    "muscular",     // All muscles
    "skeletal",     // Skull, spine, ribs, pelvis, arms, hands, legs, feet
    "connective",   // Tendons, ligaments, patellar tendon, cartilage
    "sensory",      // Eyes
    "nervous",      // Brain, spinal cord, nerves
    "cardiac",      // Heart
    "respiratory",  // Larynx, trachea, lungs
    "digestive",    // Stomach, liver, intestines
  ];
};

export default function Home() {
  const [sex, setSex] = useState<Sex>("male");
  const [language, setLanguage] = useState<Language>("en");
  const [backgroundColor, setBackgroundColor] = useState<string>("#f3f4f4");
  const [bodyMode, setBodyMode] = useState<string>("complete");
  const [selectedPart, setSelectedPart] = useState<PartInfo | null>(null);

  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);

  const [state, setState] = useState<SceneState>(() => ({
    explode: 0,
    visible: getCompletedBodySystems("male", "complete"),
    selected: [],
    isolate: false,
    view: "three-quarter",
    rotate: false,
    reset: 0,
  }));

  const clickListeners = useRef<Set<(part: PartInfo) => void>>(new Set());
  const readyListeners = useRef<Set<() => void>>(new Set());
  const progressListeners = useRef<Set<(p: number) => void>>(new Set());

  // Parse URL search parameters on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    const paramSex = params.get("sex");
    if (paramSex === "female" || paramSex === "male") {
      setSex(paramSex);
    }

    const paramLang = params.get("lang");
    if (paramLang === "ar" || paramLang === "en") {
      setLanguage(paramLang);
    }

    const paramMode = params.get("mode") || "complete";
    setBodyMode(paramMode);

    const paramBg = params.get("bg");
    if (paramBg) {
      const bgVal = paramBg.startsWith("#") ? paramBg : paramBg === "transparent" ? "transparent" : `#${paramBg}`;
      setBackgroundColor(bgVal);
    }

    const paramRotate = params.get("rotate");
    const paramView = params.get("view") as View | null;

    setState((s) => ({
      ...s,
      rotate: paramRotate === "true" || paramRotate === "1",
      view: (paramView && ["front", "back", "side", "three-quarter"].includes(paramView)) ? paramView : s.view,
      visible: getCompletedBodySystems(paramSex === "female" ? "female" : "male", paramMode),
    }));
  }, []);

  // Update visible systems when sex or bodyMode changes
  useEffect(() => {
    setState((s) => ({
      ...s,
      visible: getCompletedBodySystems(sex, bodyMode),
    }));
  }, [sex, bodyMode]);

  // Load the 3D Atlas Manifest
  useEffect(() => {
    const abort = new AbortController();
    setIsReady(false);
    setProgress(0);

    fetch(edition(sex).manifest, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error(say(language, "catalogueError"));
        return r.json();
      })
      .then((data) => {
        setAtlas(data as Atlas);
      })
      .catch((e) => {
        if (e.name !== "AbortError") console.error("[Atlas] Error loading manifest:", e);
      });

    return () => abort.abort();
  }, [sex, language]);

  // Map all anatomical parts by ID for fast lookup
  const parts = useMemo(
    () => new Map(atlas?.parts.map((p) => [p.id, p])),
    [atlas]
  );

  // List of all muscles in the current atlas
  const musclesList = useMemo(() => {
    if (!atlas) return [];
    return atlas.parts.filter(
      (p) => p.system === "muscular" || p.system === "donor-muscle"
    );
  }, [atlas]);

  // Unified dispatcher to broadcast events to all WebView bridge mechanisms
  const dispatchToApp = useCallback((eventData: AtlasBridgeEvent) => {
    const jsonString = JSON.stringify(eventData);

    // 1. Direct callback if defined on window (common WebView injection)
    try {
      if (typeof (window as any).onMuscleClick === "function" && eventData.part) {
        (window as any).onMuscleClick(eventData.part);
      }
      if (typeof (window as any).onPartClick === "function" && eventData.part) {
        (window as any).onPartClick(eventData.part);
      }
    } catch (e) {
      console.warn("[AtlasAPI] window callback error:", e);
    }

    // 2. Standard DOM CustomEvent on window
    try {
      window.dispatchEvent(new CustomEvent("muscleClick", { detail: eventData }));
      window.dispatchEvent(new CustomEvent("partClick", { detail: eventData }));
    } catch (e) {}

    // 3. React Native WebView (window.ReactNativeWebView.postMessage)
    try {
      if ((window as any).ReactNativeWebView?.postMessage) {
        (window as any).ReactNativeWebView.postMessage(jsonString);
      }
    } catch (e) {}

    // 4. Flutter InAppWebView (flutter_inappwebview callHandler)
    try {
      if ((window as any).flutter_inappwebview?.callHandler) {
        (window as any).flutter_inappwebview.callHandler("onMuscleClick", eventData.part || eventData);
        (window as any).flutter_inappwebview.callHandler("onPartClick", eventData.part || eventData);
      }
    } catch (e) {}

    // 5. Flutter JavaScript Channels (MuscleChannel & HumanAtlas)
    try {
      if ((window as any).MuscleChannel?.postMessage) {
        (window as any).MuscleChannel.postMessage(jsonString);
      }
      if ((window as any).HumanAtlas?.postMessage) {
        (window as any).HumanAtlas.postMessage(jsonString);
      }
    } catch (e) {}

    // 6. Android WebView (addJavascriptInterface)
    try {
      if (typeof (window as any).Android?.onMuscleClick === "function") {
        (window as any).Android.onMuscleClick(jsonString);
      }
      if (typeof (window as any).AndroidBridge?.onMuscleClick === "function") {
        (window as any).AndroidBridge.onMuscleClick(jsonString);
      }
      if (typeof (window as any).MuscleBridge?.onMuscleClick === "function") {
        (window as any).MuscleBridge.onMuscleClick(jsonString);
      }
    } catch (e) {}

    // 7. iOS WKWebView (WKScriptMessageHandler)
    try {
      const handlers = (window as any).webkit?.messageHandlers;
      if (handlers?.onMuscleClick?.postMessage) {
        handlers.onMuscleClick.postMessage(eventData.part || eventData);
      }
      if (handlers?.muscleClick?.postMessage) {
        handlers.muscleClick.postMessage(eventData.part || eventData);
      }
      if (handlers?.partClick?.postMessage) {
        handlers.partClick.postMessage(eventData.part || eventData);
      }
      if (handlers?.bridge?.postMessage) {
        handlers.bridge.postMessage(eventData);
      }
    } catch (e) {}

    // 8. Standard HTML5 window.postMessage (for iframes or cross-window communication)
    try {
      window.postMessage(eventData, "*");
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(eventData, "*");
      }
    } catch (e) {}

    // 9. Call subscribers registered via AtlasAPI.onMuscleClick / onPartClick
    if (eventData.part) {
      clickListeners.current.forEach((fn) => {
        try {
          fn(eventData.part!);
        } catch (err) {
          console.error(err);
        }
      });
    }
  }, []);

  // Helper to build a PartInfo object from an anatomical part
  const createPartInfo = useCallback((p: Part): PartInfo => {
    const rawName = p.name.toLowerCase().trim();
    const nameAr = (TERMS_AR as Record<string, string>)[rawName] || term(p.name, "ar");
    const center = {
      x: (p.bounds[0][0] + p.bounds[1][0]) / 2,
      y: (p.bounds[0][1] + p.bounds[1][1]) / 2,
      z: (p.bounds[0][2] + p.bounds[1][2]) / 2,
    };
    const isMuscle = p.system === "muscular" || p.system === "donor-muscle";

    return {
      id: p.id,
      name: p.name,
      nameAr,
      system: p.system,
      isMuscle,
      conceptId: p.conceptId,
      bounds: p.bounds,
      center,
      sex,
      timestamp: Date.now(),
    };
  }, [sex]);

  // Triggered when any mesh is clicked inside <AnatomyScene />
  const handleSelect = useCallback((id: string) => {
    if (!id) {
      // Background click -> deselect
      setSelectedPart(null);
      setState((s) => ({
        ...s,
        selected: [],
      }));

      dispatchToApp({
        type: "PART_DESELECTED",
        event: "partDeselect",
        muscle: undefined,
        part: undefined,
        data: null,
        payload: null,
      });
      return;
    }

    const p = parts.get(id);
    if (!p) return;

    const partData = createPartInfo(p);
    setSelectedPart(partData);

    // Highlight the clicked part on the 3D model
    setState((s) => ({
      ...s,
      selected: [id],
      isolate: false,
    }));

    // Broadcast the click event to the host application
    dispatchToApp({
      type: partData.isMuscle ? "MUSCLE_CLICK" : "PART_CLICK",
      event: partData.isMuscle ? "muscleClick" : "partClick",
      ...partData,
      isMuscle: partData.isMuscle,
      muscle: partData.isMuscle ? partData : undefined,
      part: partData,
      data: partData,
      payload: partData,
    });
  }, [parts, createPartInfo, dispatchToApp]);

  // Programmatic select part/muscle by ID or name
  const selectPart = useCallback((query: string): boolean => {
    if (!query) {
      handleSelect("");
      return true;
    }

    const q = query.toLowerCase().trim();
    // 1. Match by exact ID
    let found = parts.get(query);

    // 2. Match by exact or partial name among all parts
    if (!found && atlas) {
      found = atlas.parts.find((p) => p.name.toLowerCase() === q);
    }
    if (!found && atlas) {
      found = atlas.parts.find((p) => p.name.toLowerCase().includes(q));
    }
    if (!found && atlas) {
      // Check Arabic translation match
      found = atlas.parts.find((p) => {
        const ar = (TERMS_AR as Record<string, string>)[p.name.toLowerCase().trim()];
        return ar && ar.includes(q);
      });
    }

    if (found) {
      handleSelect(found.id);
      return true;
    }
    return false;
  }, [parts, atlas, handleSelect]);

  // Progress and Ready handlers
  const handleProgress = useCallback((n: number) => {
    setProgress(n);
    progressListeners.current.forEach((fn) => {
      try { fn(n); } catch (e) {}
    });

    if (n >= 100 && !isReady) {
      setIsReady(true);
      readyListeners.current.forEach((fn) => {
        try { fn(); } catch (e) {}
      });
      dispatchToApp({
        type: "MODEL_READY",
        event: "modelReady",
        data: { sex, partsCount: atlas?.parts.length ?? 0, musclesCount: musclesList.length },
      });
    }
  }, [isReady, sex, atlas, musclesList.length, dispatchToApp]);

  // Expose global AtlasAPI on window for the host WebView application
  useEffect(() => {
    const api = {
      // Event listeners
      onMuscleClick: (callback: (part: PartInfo) => void) => {
        clickListeners.current.add(callback);
        return () => clickListeners.current.delete(callback);
      },
      onPartClick: (callback: (part: PartInfo) => void) => {
        clickListeners.current.add(callback);
        return () => clickListeners.current.delete(callback);
      },
      onReady: (callback: () => void) => {
        readyListeners.current.add(callback);
        if (isReady) callback();
        return () => readyListeners.current.delete(callback);
      },
      onProgress: (callback: (p: number) => void) => {
        progressListeners.current.add(callback);
        return () => progressListeners.current.delete(callback);
      },

      // Programmatic actions
      selectPart: (idOrName: string) => selectPart(idOrName),
      selectMuscle: (idOrName: string) => selectPart(idOrName),
      clearSelection: () => handleSelect(""),
      deselect: () => handleSelect(""),

      setSex: (newSex: Sex) => {
        if (newSex === "male" || newSex === "female") setSex(newSex);
      },
      setView: (newView: View) => {
        setState((s) => ({ ...s, view: newView }));
      },
      setRotate: (rotate: boolean) => {
        setState((s) => ({ ...s, rotate: Boolean(rotate) }));
      },
      resetCamera: () => {
        setState((s) => ({ ...s, reset: s.reset + 1 }));
      },
      setBodyMode: (mode: "complete" | "muscles-only") => {
        setBodyMode(mode);
      },
      setSystems: (systems: SystemId[]) => {
        setState((s) => ({ ...s, visible: systems }));
      },
      setBackgroundColor: (color: string) => {
        setBackgroundColor(color);
      },

      // Data getters
      getMuscles: () =>
        musclesList.map((m) => ({
          id: m.id,
          name: m.name,
          nameAr: (TERMS_AR as Record<string, string>)[m.name.toLowerCase().trim()] || term(m.name, "ar"),
          system: m.system,
          conceptId: m.conceptId,
          bounds: m.bounds,
        })),
      getAllParts: () =>
        atlas?.parts.map((p) => ({
          id: p.id,
          name: p.name,
          nameAr: (TERMS_AR as Record<string, string>)[p.name.toLowerCase().trim()] || term(p.name, "ar"),
          system: p.system,
          isMuscle: p.system === "muscular" || p.system === "donor-muscle",
        })) ?? [],
      getSelected: () => selectedPart,
      getSex: () => sex,
      isReady: () => isReady,
    };

    (window as any).Physio3D = api;
    (window as any).Physio3DAPI = api;
    (window as any).AtlasAPI = api;
    (window as any).MuscleAPI = api;
    (window as any).HumanAtlasApi = api;

    // Handle postMessage commands from host app
    const handleMessage = (e: MessageEvent) => {
      let data = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;

      const action = data.action || data.type;
      const payload = data.data ?? data.payload ?? data.value;

      switch (action) {
        case "selectMuscle":
        case "SELECT_MUSCLE":
        case "selectPart":
        case "SELECT_PART":
          if (typeof payload === "string") api.selectPart(payload);
          break;
        case "clearSelection":
        case "CLEAR_SELECTION":
        case "deselect":
          api.clearSelection();
          break;
        case "setSex":
        case "SET_SEX":
          if (payload === "male" || payload === "female") api.setSex(payload);
          break;
        case "setView":
        case "SET_VIEW":
          api.setView(payload);
          break;
        case "setRotate":
        case "SET_ROTATE":
          api.setRotate(Boolean(payload));
          break;
        case "resetCamera":
        case "RESET_CAMERA":
          api.resetCamera();
          break;
        case "setBodyMode":
          api.setBodyMode(payload);
          break;
        case "setSystems":
          if (Array.isArray(payload)) api.setSystems(payload);
          break;
        case "getMuscles":
        case "GET_MUSCLES":
          dispatchToApp({
            type: "MUSCLES_LIST",
            event: "musclesList",
            data: api.getMuscles(),
          });
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [selectPart, handleSelect, musclesList, atlas, selectedPart, sex, isReady, dispatchToApp]);

  return (
    <main
      className="studio"
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: backgroundColor === "transparent" ? "transparent" : backgroundColor,
        position: "relative",
      }}
    >
      {atlas && (
        <AnatomyScene
          atlas={atlas}
          state={{ ...state, inspectorOpen: false }}
          onSelect={handleSelect}
          onProgress={handleProgress}
          onError={(err) => console.error("[Atlas] 3D Viewer error:", err)}
          backgroundColor={backgroundColor}
        />
      )}
    </main>
  );
}
