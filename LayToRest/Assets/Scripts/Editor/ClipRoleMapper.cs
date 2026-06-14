using System.Linq;
using UnityEditor;
using UnityEngine;

namespace LayToRest.EditorTools
{
    /// The Blender NLA tracks export as generic "NlaTrack.NNN" take names,
    /// so — exactly like the web Character.tsx — animation ROLES are
    /// resolved by clip duration:
    ///   shortest          → run
    ///   second-shortest   → walk
    ///   longest           → idle
    ///   everything else   → extra, extra_2, extra_3, …
    ///
    /// Select one or more character FBX assets (Art/Characters) and run
    /// Tools ▸ LayToRest ▸ Map Clip Roles. The importer clips are renamed
    /// in-place and the asset reimports, so Animator states can use the
    /// stable names run/walk/idle/extra.
    public static class ClipRoleMapper
    {
        [MenuItem("Tools/LayToRest/Map Clip Roles (by duration)")]
        static void MapSelected()
        {
            foreach (var obj in Selection.objects)
                MapClipsAt(AssetDatabase.GetAssetPath(obj));
        }

        /// Applies the duration→role mapping to one FBX asset path.
        public static void MapClipsAt(string path)
        {
            {
                if (string.IsNullOrEmpty(path) || !path.ToLowerInvariant().EndsWith(".fbx")) return;
                var importer = AssetImporter.GetAtPath(path) as ModelImporter;
                if (importer == null) return;

                var clips = importer.defaultClipAnimations;
                if (clips == null || clips.Length == 0)
                {
                    Debug.LogWarning($"[ClipRoleMapper] {path}: no animation clips.");
                    return;
                }

                var sorted = clips.OrderBy(c => c.lastFrame - c.firstFrame).ToArray();
                int n = sorted.Length;
                int extraIdx = 0;
                foreach (var (clip, i) in sorted.Select((c, i) => (c, i)))
                {
                    if (i == 0 && n > 2) clip.name = "run";
                    else if (i == 1 && n > 3) clip.name = "walk";
                    else if (i == n - 1) clip.name = "idle";
                    else clip.name = extraIdx++ == 0 ? "extra" : $"extra_{extraIdx}";

                    bool looping = clip.name is "run" or "walk" or "idle";
                    clip.loopTime = looping;
                }

                importer.clipAnimations = sorted;
                importer.SaveAndReimport();
                Debug.Log($"[ClipRoleMapper] {path}: mapped {n} clips → " +
                          string.Join(", ", sorted.Select(c => $"{c.name} ({c.lastFrame - c.firstFrame:F0}f)")));
            }
        }
    }
}
