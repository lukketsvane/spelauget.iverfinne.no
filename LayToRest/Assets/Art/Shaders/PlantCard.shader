// Port of the web Plants.tsx sprite material: unlit, alpha-clipped,
// double-sided card with wind sway + player-push vertex displacement.
// _SpelPlayerPos is a global set by PlantField each frame.
Shader "Spelauget/PlantCard"
{
    Properties
    {
        _BaseMap ("Texture", 2D) = "white" {}
        _Cutoff ("Alpha Cutoff", Range(0,1)) = 0.5
        _WindAmp ("Wind Amplitude", Range(0,1)) = 0.5
        _PushAmp ("Push Amplitude", Range(0,1)) = 0
        _Tint ("Tint", Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "RenderType"="TransparentCutout" "Queue"="AlphaTest" "RenderPipeline"="UniversalPipeline" }
        Cull Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/ShaderLibrary/Color.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                float _Cutoff;
                float _WindAmp;
                float _PushAmp;
                half4 _Tint;
            CBUFFER_END
            float3 _SpelPlayerPos;

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; };

            float3 displace(float3 wp, float2 uv)
            {
                // Wind sway — same constants as the web vertex shader.
                float windPhase = _Time.y * 1.4 + wp.x * 0.45 + wp.z * 0.35;
                float sway = uv.y * _WindAmp;
                wp.x += sin(windPhase) * 0.18 * sway;
                wp.z += cos(windPhase * 0.85) * 0.06 * sway;

                // Player push — bend top away within ~1.6 m, quadratic falloff.
                if (_PushAmp > 0.0)
                {
                    float2 toP = wp.xz - _SpelPlayerPos.xz;
                    float dSq = dot(toP, toP);
                    float push = max(0.0, 1.0 - dSq / (1.6 * 1.6));
                    push *= push;
                    float2 dir = normalize(toP + 0.0001);
                    float s = _PushAmp * push * uv.y * 0.85;
                    wp.x += dir.x * s;
                    wp.z += dir.y * s;
                }
                return wp;
            }

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                float3 wp = TransformObjectToWorld(IN.positionOS.xyz);
                wp = displace(wp, IN.uv);
                OUT.positionHCS = TransformWorldToHClip(wp);
                OUT.uv = TRANSFORM_TEX(IN.uv, _BaseMap);
                return OUT;
            }

            // LYSNINGEN_PLANT gradient (regions.ts): luminance → palette.
            half3 PlantRamp(half t)
            {
                half3 c0 = half3(0.165, 0.102, 0.416); // #2a1a6a
                half3 c1 = half3(0.416, 0.290, 0.847); // #6a4ad8
                half3 c2 = half3(0.384, 0.722, 1.0);   // #62b8ff
                half3 c3 = half3(0.737, 0.878, 1.0);   // #bce0ff
                half3 c4 = half3(0.941, 0.973, 1.0);   // #f0f8ff
                half3 col = lerp(c0, c1, saturate(t / 0.3));
                col = lerp(col, c2, saturate((t - 0.3) / 0.25));
                col = lerp(col, c3, saturate((t - 0.55) / 0.25));
                col = lerp(col, c4, saturate((t - 0.8) / 0.2));
                return col;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                half4 c = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, IN.uv) * _Tint;
                clip(c.a - _Cutoff);
                half lum = dot(LinearToSRGB(c.rgb), half3(0.299, 0.587, 0.114));
                return half4(SRGBToLinear(PlantRamp(lum)), 1);
            }
            ENDHLSL
        }
    }
}
