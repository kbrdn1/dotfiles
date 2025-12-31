// Shader sobre pour Ghostty - bordure subtile sans artifice

float getSdfRectangle(in vec2 point, in vec2 center, in vec2 halfSize)
{
    vec2 d = abs(point - center) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

vec2 normalizePosition(vec2 pos) {
    vec2 p = (pos / iResolution.xy) * 2.0 - 1.0;
    p.x *= iResolution.x / iResolution.y;
    return p;
}

vec2 normalizeSize(vec2 size) {
    vec2 s = size / iResolution.xy;
    s.x *= iResolution.x / iResolution.y;
    return s * 2.;
}

float normalizeValue(float value) {
    float normalizedValue = value / iResolution.y;
    return normalizedValue * 2.0;
}

vec2 OFFSET = vec2(0.5, -0.5);

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = texture(iChannel0, fragCoord.xy / iResolution.xy);
    vec2 vu = normalizePosition(fragCoord.xy);

    // Couleur de bordure sobre (gris clair)
    vec4 borderColor = vec4(0.6, 0.6, 0.6, 1.0);

    vec4 normalizedCursor = vec4(normalizePosition(iCurrentCursor.xy), normalizeSize(iCurrentCursor.zw));
    vec2 rectCenterPx = iCurrentCursor.xy + iCurrentCursor.zw * OFFSET;

    float sdfCurrentCursor = getSdfRectangle(vu, normalizePosition(rectCenterPx), normalizedCursor.zw * 0.5);

    // Bordure fine (2 pixels)
    float borderWidth = normalizeValue(2.0);

    // Affichage simple de la bordure
    vec4 newColor = mix(fragColor, borderColor, smoothstep(borderWidth, 0.0, sdfCurrentCursor));
    newColor = mix(newColor, fragColor, step(sdfCurrentCursor, 0.));

    fragColor = newColor;
}
