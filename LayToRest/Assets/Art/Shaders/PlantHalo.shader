// Additive halo pass — the web renders a 1.2x-scaled copy of each plant
// sprite with additive blending behind the base card, faking a bloom rim
// without postprocessing. Same wind/push displacement so it tracks the
// base sprite exactly.
Shader "Spelauget/PlantHalo"
{
    Properties
    {
        _BaseMap ("Texture", 2D) = "white" {}
        _WindAmp ("Wind Amplitude", Range(0,1)) = 0.5
        _PushAmp ("Push Amplitude", Range(0,1)) = 0
        _Intensity ("Glow Intensity", Range(0,2)) = 0.55
        _Tint ("Tint", Color) = (0.45,0.55,1,1)
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" }
        Cull Off
        ZWrite Off
        Blend One One

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
                float _WindAmp;
                float _PushAmp;
                float _Intensity;
                half4 _Tint;
            CBUFFER_END
            float3 _SpelPlayerPos;

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; };

            float3 displace(float3 wp, float2 uv)
            {
                float windPhase = _Time.y * 1.4 + wp.x * 0.45 + wp.z * 0.35;
                float sway = uv.y * _WindAmp;
                wp.x += sin(windPhase) * 0.18 * sway;
                wp.z += cos(windPhase * 0.85) * 0.06 * sway;
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

            // LYSNINGEN_HALO gradient (regions.ts): luminance → palette.
            half3 HaloRamp(half t)
            {
                half3 c0 = half3(0.102, 0.055, 0.227); // #1a0e3a
                half3 c1 = half3(0.173, 0.114, 0.408); // #2c1d68
                half3 c2 = half3(0.243, 0.306, 0.659); // #3e4ea8
                half3 c3 = half3(0.384, 0.659, 1.0);   // #62a8ff
                half3 c4 = half3(0.737, 0.863, 1.0);   // #bcdcff
                half3 c5 = half3(0.973, 0.988, 1.0);   // #f8fcff
                half3 col = lerp(c0, c1, saturate(t / 0.4));
                col = lerp(col, c2, saturate((t - 0.4) / 0.15));
                col = lerp(col, c3, saturate((t - 0.55) / 0.2));
                col = lerp(col, c4, saturate((t - 0.75) / 0.15));
                col = lerp(col, c5, saturate((t - 0.9) / 0.1));
                return col;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                half4 c = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, IN.uv);
                half lum = dot(LinearToSRGB(c.rgb), half3(0.299, 0.587, 0.114));
                return half4(SRGBToLinear(HaloRamp(lum)) * _Tint.rgb * (c.a * _Intensity), 1);
            }
            ENDHLSL
        }
    }
}
