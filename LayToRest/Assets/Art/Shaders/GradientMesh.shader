// Port of the web StaticGLB material treatment: unlit, with the texture's
// luminance remapped through the region plant palette (LYSNINGEN_PLANT).
// Used on world props so they read as glowing silhouettes like the web.
Shader "Spelauget/GradientMesh"
{
    Properties
    {
        _BaseMap ("Texture", 2D) = "white" {}
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" "RenderPipeline"="UniversalPipeline" }

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
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                OUT.positionHCS = TransformObjectToHClip(IN.positionOS.xyz);
                OUT.uv = TRANSFORM_TEX(IN.uv, _BaseMap);
                return OUT;
            }

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
                half4 c = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, IN.uv);
                // Web computed luminance + ramp in sRGB space; mirror that,
                // then convert the (sRGB-authored) ramp colour to linear.
                half lum = dot(LinearToSRGB(c.rgb), half3(0.299, 0.587, 0.114));
                return half4(SRGBToLinear(PlantRamp(lum)), 1);
            }
            ENDHLSL
        }
    }
}
