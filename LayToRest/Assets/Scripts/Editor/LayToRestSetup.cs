using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using LayToRest.Core;
using LayToRest.Player;
using LayToRest.World;
using LayToRest.UI;
using LayToRest.Audio;
using LayToRest.Rendering;

namespace LayToRest.EditorTools
{
    /// One-click bootstrap: Tools ▸ LayToRest ▸ One-Click Setup.
    ///   1. Maps animation clip roles on all character FBXs (by duration,
    ///      same rule as the web build).
    ///   2. Builds/refreshes the SpawnPrefabLibrary with automatic
    ///      kind → FBX mappings.
    ///   3. Builds an AnimatorController (idle/walk/run/extra) for sligo.
    ///   4. Creates Assets/Scenes/Main.unity with player, iso camera,
    ///      world loader, day-cycle sun and ground plane.
    /// Idempotent — safe to re-run.
    public static class LayToRestSetup
    {
        const string ModelsDir = "Assets/Art/Models";
        const string CharsDir = "Assets/Art/Characters";
        const string GlbDir = "Assets/Art/CharactersGLB";
        // Player model, imported via glTFast — glTF is Y-up like Unity,
        // so no axis-conversion problems.
        const string PlayerModelPath = GlbDir + "/sligo.glb";
        const string ClipsDir = "Assets/Art/Characters/Clips";
        const string LibraryPath = "Assets/SpawnPrefabLibrary.asset";
        const string ControllerPath = "Assets/Art/Characters/sligo_controller.controller";
        const string ScenePath = "Assets/Scenes/Main.unity";

        // spawn kind (or kind:variant) → FBX asset. Stand-ins noted.
        static readonly Dictionary<string, string> KindToFbx = new()
        {
            { "purple_stone_cairn",     ModelsDir + "/purple_stone_cairn.fbx" },
            { "tangled_root_sculpture", ModelsDir + "/tangled_root_sculpture.fbx" },
            { "neon_vascular_tree",     ModelsDir + "/neon_vascular_tree.fbx" },
            { "purple_coral",           ModelsDir + "/purple_coral.fbx" },
            { "purple_coral_alt",       ModelsDir + "/purple_coral_alt.fbx" },
            { "glowing_purple_coral",   ModelsDir + "/glowing_purple_coral.fbx" },
            { "mythical_horse",         ModelsDir + "/mythical_horse.fbx" },
            { "stone_hut",              ModelsDir + "/stone_hut.fbx" },
            { "trilo",                  ModelsDir + "/trilo.fbx" },
            { "skate",                  ModelsDir + "/skate.fbx" },
            { "portal",                 ModelsDir + "/portal_2.fbx" },
            { "giantess",               ModelsDir + "/giantess_squat.fbx" },
            { "rock_stack",             ModelsDir + "/purple_stone_cairn.fbx" }, // stand-in (web was procedural)
            { "flis_prop:pillar",       ModelsDir + "/flis_pillar.fbx" },
            { "flis_prop:floor_tile",   ModelsDir + "/flis_floor_tile.fbx" },
            { "car:car_01",             ModelsDir + "/car_01.fbx" },
            { "car:car_02",             ModelsDir + "/car_02.fbx" },
            { "boble_npc",              GlbDir + "/boblehovud.glb" },
            { "star_npc",               GlbDir + "/stjernekarakter.glb" },
            // No FBX yet (web GLB only): purple_coral, purple_coral_alt,
            // glowing_purple_coral, flis_prop:figure_seated, flis_prop:vesica
            // → placeholder cubes at runtime.
        };

        [MenuItem("Tools/LayToRest/One-Click Setup")]
        public static void Run()
        {
            MapCharacterClips();
            var library = BuildPrefabLibrary();
            var controller = BuildPlayerAnimator();
            BuildMainScene(library, controller);
            Debug.Log("[LayToRest] One-click setup complete. Open Assets/Scenes/Main.unity and press Play.");
        }

        /// Surgical fix for the player only — leaves the rest of the open
        /// scene untouched (unlike One-Click Setup, which rebuilds Main.unity
        /// from scratch). Swaps whatever model is parented under the
        /// PlayerController for the intended sligo.glb (glTFast, Y-up: scale
        /// 2, yaw -90° as in config.ts), rebuilds the idle/walk/run/extra
        /// animator, and re-applies unlit materials. Idempotent.
        [MenuItem("Tools/LayToRest/Fix Player Model (active scene)")]
        public static void FixPlayerModel()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid() || !scene.isLoaded)
            {
                Debug.LogError("[LayToRest] No active scene is open.");
                return;
            }

            PlayerController pc = null;
            foreach (var root in scene.GetRootGameObjects())
            {
                pc = root.GetComponentInChildren<PlayerController>(true);
                if (pc != null) break;
            }
            if (pc == null)
            {
                Debug.LogError("[LayToRest] No PlayerController found in the active scene — open Main.unity first.");
                return;
            }
            var player = pc.gameObject;

            var playerAsset = AssetDatabase.LoadAssetAtPath<GameObject>(PlayerModelPath);
            if (playerAsset == null)
            {
                Debug.LogError($"[LayToRest] Could not load {PlayerModelPath}. Is glTFast resolved and the .glb imported?");
                return;
            }

            // Drop the old model rig(s) (e.g. the stray sligo_01.fbx instance).
            var stale = new List<GameObject>();
            foreach (Transform child in player.transform)
                if (child.name == "Model"
                    || child.GetComponent<PlayerAnimation>() != null
                    || child.GetComponentInChildren<SkinnedMeshRenderer>(true) != null)
                    stale.Add(child.gameObject);
            foreach (var go in stale) Object.DestroyImmediate(go);

            var controller = BuildPlayerAnimator();

            var model = (GameObject)PrefabUtility.InstantiatePrefab(playerAsset);
            model.name = "Model";
            model.transform.SetParent(player.transform, false);
            model.transform.localScale = Vector3.one * 2f;
            model.transform.localRotation = Quaternion.Euler(0, -90f, 0);

            if (!model.TryGetComponent<Animator>(out var animator))
                animator = model.AddComponent<Animator>();
            animator.runtimeAnimatorController = controller;
            var pa = model.AddComponent<PlayerAnimation>();
            pa.controller = pc;

            // Web characters are unlit (MeshBasicMaterial) — keep textures
            // independent of scene lighting.
            foreach (var r in model.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                    if (mats[i] != null)
                        mats[i] = WorldLoader.GetUnlit(WorldLoader.FindBaseTexture(mats[i]));
                r.sharedMaterials = mats;
            }

            EditorUtility.SetDirty(player);
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Selection.activeGameObject = model;
            Debug.Log("[LayToRest] Player model fixed → sligo.glb (scale 2, yaw -90°); animator rebuilt; scene saved.");
        }

        // Latest Tripo import — a static (un-rigged) mesh, so the player
        // won't animate. modelForwardYaw flips it if it faces the wrong way.
        const string CuteCharPath = "Assets/TripoModels/cute_3d_character_Clone1_1/cute_3d_character_Clone1_1.fbx";
        const float CuteCharYaw = 0f;
        const float PlayerTargetHeight = 2.0f;

        /// Swaps the player's visual to the latest Tripo "cute 3d character"
        /// (static mesh, no clips). Auto-fits it: scales to ~2 m tall and
        /// drops its feet onto the player origin, so its arbitrary import
        /// pivot/scale don't matter. Also removes the stray Tripo drop-in
        /// clones from the scene. Non-destructive to everything else.
        [MenuItem("Tools/LayToRest/Use Cute Tripo Character as Player")]
        public static void UseCuteCharacterAsPlayer()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid() || !scene.isLoaded) { Debug.LogError("[LayToRest] No active scene is open."); return; }

            PlayerController pc = null;
            foreach (var root in scene.GetRootGameObjects())
            {
                pc = root.GetComponentInChildren<PlayerController>(true);
                if (pc != null) break;
            }
            if (pc == null) { Debug.LogError("[LayToRest] No PlayerController found — open Main.unity first."); return; }
            var player = pc.gameObject;

            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(CuteCharPath);
            if (asset == null) { Debug.LogError($"[LayToRest] Could not load {CuteCharPath}."); return; }

            // Drop the old model rig(s) under the player.
            var stale = new List<GameObject>();
            foreach (Transform child in player.transform)
                if (child.name == "Model"
                    || child.GetComponent<PlayerAnimation>() != null
                    || child.GetComponentInChildren<SkinnedMeshRenderer>(true) != null)
                    stale.Add(child.gameObject);
            foreach (var go in stale) Object.DestroyImmediate(go);

            // Remove the stray "added to scene" Tripo clones.
            foreach (var root in scene.GetRootGameObjects())
                if (root != player && root.name.StartsWith("cute_3d_character"))
                    Object.DestroyImmediate(root);

            var model = (GameObject)PrefabUtility.InstantiatePrefab(asset);
            model.name = "Model";
            model.transform.SetParent(player.transform, false);
            model.transform.localPosition = Vector3.zero;
            model.transform.localRotation = Quaternion.Euler(0, CuteCharYaw, 0);
            model.transform.localScale = Vector3.one;

            AutoFitToPlayer(model.transform, player.transform, PlayerTargetHeight);

            // Web look: characters render unlit (keep their base-colour texture).
            foreach (var r in model.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++)
                    if (mats[i] != null)
                        mats[i] = WorldLoader.GetUnlit(WorldLoader.FindBaseTexture(mats[i]));
                r.sharedMaterials = mats;
            }

            EditorUtility.SetDirty(player);
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Selection.activeGameObject = model;
            Debug.Log($"[LayToRest] Player model → cute Tripo character (auto-fit ~{PlayerTargetHeight} m). " +
                      "Static mesh: no walk/idle animation. If it faces the wrong way, set CuteCharYaw and re-run.");
        }

        /// Scales a model so it is targetHeight tall and shifts it so its
        /// feet-centre sit on the player's origin — neutralises arbitrary
        /// import pivots/scales (Tripo exports vary).
        static void AutoFitToPlayer(Transform model, Transform playerRoot, float targetHeight)
        {
            var rends = model.GetComponentsInChildren<Renderer>();
            if (rends.Length == 0) { Debug.LogWarning("[LayToRest] Model has no renderers to fit."); return; }

            Bounds Combined()
            {
                var b = rends[0].bounds;
                for (int i = 1; i < rends.Length; i++) b.Encapsulate(rends[i].bounds);
                return b;
            }

            var bounds = Combined();
            float s = targetHeight / Mathf.Max(1e-4f, bounds.size.y);
            model.localScale *= s;

            bounds = Combined(); // recompute after scaling
            var worldFeet = new Vector3(bounds.center.x, bounds.min.y, bounds.center.z);
            model.position += playerRoot.position - worldFeet;
        }

        const string MenuImagePath = "Assets/Resources/UI/menu_screen.png";
        const string MenuVolumeProfilePath = "Assets/Settings/MenuVolumeProfile.asset";

        /// Builds the gamejam title screen into the open scene: the splash
        /// menu (MainMenu), the soundtrack (BackgroundMusic), and the chunky
        /// "0.45-DPR" look (URP render-scale + Point upscale) plus a global
        /// exposure volume for the Brightness slider. Non-destructive and
        /// idempotent — only adds what's missing.
        [MenuItem("Tools/LayToRest/Build Title Screen (active scene)")]
        public static void BuildTitleScreen()
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid() || !scene.isLoaded)
            {
                Debug.LogError("[LayToRest] No active scene is open.");
                return;
            }

            // 1) Splash texture: chunky pixels (Point + capped size, no mips).
            if (AssetImporter.GetAtPath(MenuImagePath) is TextureImporter ti)
            {
                ti.textureType = TextureImporterType.Default;
                ti.filterMode = FilterMode.Point;
                ti.mipmapEnabled = false;
                ti.maxTextureSize = 1024;
                ti.SaveAndReimport();
            }
            else Debug.LogWarning($"[LayToRest] {MenuImagePath} not found — splash will be blank.");

            // 2) Pixelation: render the 3D at 0.45× and upscale nearest-
            //    neighbour. UI overlays stay native-res (web parity), and
            //    screen-space input is unaffected (unlike a camera RT).
            var urp = (GraphicsSettings.currentRenderPipeline
                       ?? QualitySettings.renderPipeline
                       ?? GraphicsSettings.defaultRenderPipeline) as UniversalRenderPipelineAsset;
            if (urp != null)
            {
                urp.renderScale = 0.45f;
                urp.upscalingFilter = UpscalingFilterSelection.Point;
                EditorUtility.SetDirty(urp);
            }
            else Debug.LogWarning("[LayToRest] No URP asset found — skipped render-scale pixelation.");

            // 3) Global exposure volume (drives the Brightness slider).
            if (!AssetDatabase.IsValidFolder("Assets/Settings"))
                AssetDatabase.CreateFolder("Assets", "Settings");
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(MenuVolumeProfilePath);
            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                AssetDatabase.CreateAsset(profile, MenuVolumeProfilePath);
            }
            if (!profile.TryGet<ColorAdjustments>(out var ca))
                ca = profile.Add<ColorAdjustments>(true);
            ca.postExposure.overrideState = true;
            EditorUtility.SetDirty(profile);

            var volGo = GameObject.Find("GlobalVolume") ?? new GameObject("GlobalVolume");
            var vol = volGo.GetComponent<Volume>() ?? volGo.AddComponent<Volume>();
            vol.isGlobal = true;
            vol.sharedProfile = profile;

            // Post-processing must be on for the exposure volume to apply.
            if (Camera.main != null)
            {
                var data = Camera.main.GetUniversalAdditionalCameraData();
                if (data != null) data.renderPostProcessing = true;
                if (Camera.main.GetComponentInParent<AudioListener>() == null
                    && Object.FindFirstObjectByType<AudioListener>() == null)
                    Camera.main.gameObject.AddComponent<AudioListener>();
            }

            // 4) The menu + music + exposure-sync host object.
            var menuGo = GameObject.Find("Menu") ?? new GameObject("Menu");
            if (!menuGo.TryGetComponent<MainMenu>(out _)) menuGo.AddComponent<MainMenu>();
            if (!menuGo.TryGetComponent<BackgroundMusic>(out _)) menuGo.AddComponent<BackgroundMusic>();
            if (!menuGo.TryGetComponent<ExposureSync>(out _)) menuGo.AddComponent<ExposureSync>();

            EditorUtility.SetDirty(menuGo);
            EditorUtility.SetDirty(volGo);
            AssetDatabase.SaveAssets();
            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene);
            Debug.Log("[LayToRest] Title screen built: splash + music + 0.45× Point pixelation + exposure volume. Press Play.");
        }

        static void MapCharacterClips()
        {
            foreach (var guid in AssetDatabase.FindAssets("t:Model", new[] { CharsDir }))
                ClipRoleMapper.MapClipsAt(AssetDatabase.GUIDToAssetPath(guid));
        }

        static SpawnPrefabLibrary BuildPrefabLibrary()
        {
            var lib = AssetDatabase.LoadAssetAtPath<SpawnPrefabLibrary>(LibraryPath);
            if (lib == null)
            {
                lib = ScriptableObject.CreateInstance<SpawnPrefabLibrary>();
                AssetDatabase.CreateAsset(lib, LibraryPath);
            }

            lib.entries.Clear();
            foreach (var (kind, path) in KindToFbx)
            {
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null) { Debug.LogWarning($"[LayToRest] Missing FBX for '{kind}': {path}"); continue; }
                lib.entries.Add(new SpawnPrefabLibrary.Entry { kind = kind, prefab = prefab });
            }
            EditorUtility.SetDirty(lib);
            AssetDatabase.SaveAssets();
            return lib;
        }

        static AnimatorController BuildPlayerAnimator()
        {
            var existing = AssetDatabase.LoadAssetAtPath<AnimatorController>(ControllerPath);
            if (existing != null) AssetDatabase.DeleteAsset(ControllerPath);

            var controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
            var sm = controller.layers[0].stateMachine;

            // Same role resolution as the web Character.tsx: by clip
            // duration. shortest → run, 2nd → walk, longest → idle, rest →
            // extra emotes. Clips are copied to standalone .anim assets so
            // loop flags can be set (imported sub-assets are read-only).
            var source = AssetDatabase.LoadAllAssetRepresentationsAtPath(PlayerModelPath)
                .OfType<AnimationClip>()
                .Where(c => !c.name.StartsWith("__preview"))
                .OrderBy(c => c.length)
                .ToList();

            if (source.Count == 0)
            {
                Debug.LogWarning($"[LayToRest] No clips found in {PlayerModelPath} — is glTFast installed?");
                return controller;
            }

            if (!AssetDatabase.IsValidFolder(ClipsDir))
                AssetDatabase.CreateFolder(CharsDir, "Clips");

            var roles = new Dictionary<string, AnimationClip>();
            int n = source.Count, extraIdx = 0;
            for (int i = 0; i < n; i++)
            {
                string role;
                if (i == 0 && n > 2) role = "run";
                else if (i == 1 && n > 3) role = "walk";
                else if (i == n - 1) role = "idle";
                else role = extraIdx++ == 0 ? "extra" : $"extra_{extraIdx}";
                if (roles.ContainsKey(role)) continue;

                var copy = Object.Instantiate(source[i]);
                copy.name = role;
                var settings = AnimationUtility.GetAnimationClipSettings(copy);
                settings.loopTime = role is "run" or "walk" or "idle";
                AnimationUtility.SetAnimationClipSettings(copy, settings);
                string path = $"{ClipsDir}/sligo_{role}.anim";
                AssetDatabase.DeleteAsset(path);
                AssetDatabase.CreateAsset(copy, path);
                roles[role] = copy;
            }
            Debug.Log("[LayToRest] sligo roles: " + string.Join(", ",
                roles.Select(kv => $"{kv.Key} ({kv.Value.length:F1}s)")));

            foreach (var role in new[] { "idle", "walk", "run", "extra" })
            {
                if (!roles.TryGetValue(role, out var clip)) continue;
                var state = sm.AddState(role);
                state.motion = clip;
                if (role == "idle") sm.defaultState = state;
            }
            AssetDatabase.SaveAssets();
            return controller;
        }

        static void BuildMainScene(SpawnPrefabLibrary library, AnimatorController controller)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // --- Player -------------------------------------------------
            var player = new GameObject("Player");
            var cc = player.AddComponent<CharacterController>();
            cc.height = 2.4f; cc.center = new Vector3(0, 1.2f, 0); cc.radius = 0.5f;
            var pc = player.AddComponent<PlayerController>();

            var playerAsset = AssetDatabase.LoadAssetAtPath<GameObject>(PlayerModelPath);
            GameObject model = null;
            if (playerAsset != null)
            {
                model = (GameObject)PrefabUtility.InstantiatePrefab(playerAsset);
                model.name = "Model";
                model.transform.SetParent(player.transform, false);
                // config.ts: visual scale 2.0; modelForwardYaw -π/2 (mesh
                // fronts +X — Tripo exports characters along X). glTF is
                // Y-up like Unity, so yaw is the only compensation needed —
                // exactly like the web build.
                model.transform.localScale = Vector3.one * 2f;
                model.transform.localRotation = Quaternion.Euler(0, -90f, 0);

                if (!model.TryGetComponent<Animator>(out var animator))
                    animator = model.AddComponent<Animator>();
                animator.runtimeAnimatorController = controller;
                var pa = model.AddComponent<PlayerAnimation>();
                pa.controller = pc;

                // Web characters are unlit (MeshBasicMaterial) — keep their
                // full-colour textures independent of scene lighting.
                foreach (var r in model.GetComponentsInChildren<Renderer>())
                {
                    var mats = r.sharedMaterials;
                    for (int i = 0; i < mats.Length; i++)
                        if (mats[i] != null)
                            mats[i] = WorldLoader.GetUnlit(WorldLoader.FindBaseTexture(mats[i]));
                    r.sharedMaterials = mats;
                }
            }
            else
            {
                Debug.LogWarning($"[LayToRest] {PlayerModelPath} not imported — is the glTFast package resolved?");
            }
            player.transform.position = new Vector3(0, 0.5f, 0);

            // --- Camera -------------------------------------------------
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();
            cam.backgroundColor = new Color(0.027f, 0.02f, 0.10f); // deep navy, web vibe
            cam.clearFlags = CameraClearFlags.SolidColor;
            var follow = camGo.AddComponent<IsoCameraFollow>();
            follow.target = player.transform;

            // --- Light + day cycle --------------------------------------
            // The web world is essentially unlit (MeshBasicMaterial) with a
            // dark navy palette — keep the sun dim and cool so lit props
            // read as silhouettes against the glowing sprite vegetation.
            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(0.45f, 0.5f, 1f);
            sunGo.transform.rotation = Quaternion.Euler(50, -30, 0);
            var cycle = sunGo.AddComponent<DayCycle>();
            cycle.sun = sun;
            cycle.sunBaseIntensity = 0.45f;

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.13f, 0.12f, 0.32f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogColor = new Color(0.027f, 0.02f, 0.10f);
            RenderSettings.fogDensity = 0.008f;

            // --- Vegetation (Plants.tsx port) ---------------------------
            var plantsGo = new GameObject("PlantField");
            var field = plantsGo.AddComponent<PlantField>();
            field.player = player.transform;
            field.types = new[]
            {
                MakePlant("Assets/Art/Sprites/hageverden/plante_01.png", 2.4f, 0.7f, true),
                MakePlant("Assets/Art/Sprites/hageverden/plante_02.png", 3.0f, 0.6f, true),
                MakePlant("Assets/Art/Sprites/hageverden/plante_03.png", 4.2f, 0.2f, false),
                MakePlant("Assets/Art/Sprites/hageverden/plante_04.png", 4.0f, 0.35f, false),
                MakePlant("Assets/Art/Sprites/hageverden/plante_01.png", 2.2f, 0.8f, true),
            };

            // --- HUD ------------------------------------------------------
            var hudGo = new GameObject("HUD");
            hudGo.AddComponent<LayToRest.UI.GameHud>();

            // --- Systems ------------------------------------------------
            var game = new GameObject("Game");
            game.AddComponent<GameState>();
            var loader = game.AddComponent<WorldLoader>();
            loader.prefabLibrary = library;
            loader.player = pc;
            loader.startRegion = RegionId.lysningen;

            // --- Ground -------------------------------------------------
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.localScale = new Vector3(60, 1, 60); // 600×600 m
            var mat = new Material(GetDefaultLitShader()) { color = new Color(0.05f, 0.04f, 0.16f) };
            if (!AssetDatabase.IsValidFolder("Assets/Materials"))
                AssetDatabase.CreateFolder("Assets", "Materials");
            AssetDatabase.CreateAsset(mat, AssetDatabase.GenerateUniqueAssetPath("Assets/Materials/Ground.mat"));
            ground.GetComponent<MeshRenderer>().sharedMaterial = mat;

            if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
                AssetDatabase.CreateFolder("Assets", "Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);

            var buildScenes = EditorBuildSettings.scenes.ToList();
            if (!buildScenes.Any(s => s.path == ScenePath))
            {
                buildScenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
                EditorBuildSettings.scenes = buildScenes.ToArray();
            }
        }

        static Shader GetDefaultLitShader()
        {
            var s = Shader.Find("Universal Render Pipeline/Lit");
            return s != null ? s : Shader.Find("Standard");
        }

        static PlantField.PlantType MakePlant(string texPath, float height, float wind, bool pushable)
        {
            return new PlantField.PlantType
            {
                texture = AssetDatabase.LoadAssetAtPath<Texture2D>(texPath),
                height = height,
                wind = wind,
                pushable = pushable,
            };
        }
    }
}
