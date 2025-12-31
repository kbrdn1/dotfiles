float getSdfRectangle(in vec2 p, in vec2 xy, in vec2 b)
{
    vec2 d = abs(p - xy) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Based on Inigo Quilez's 2D distance functions article: https://iquilezles.org/articles/distfunctions2d/
// Potencially optimized by eliminating conditionals and loops to enhance performance and reduce branching

float seg(in vec2 p, in vec2 a, in vec2 b, inout float s, float d) {
    vec2 e = b - a;
    vec2 w = p - a;
    vec2 proj = a + e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    float segd = dot(p - proj, p - proj);
    d = min(d, segd);

    float c0 = step(0.0, p.y - a.y);
    float c1 = 1.0 - step(0.0, p.y - b.y);
    float c2 = 1.0 - step(0.0, e.x * w.y - e.y * w.x);
    float allCond = c0 * c1 * c2;
    float noneCond = (1.0 - c0) * (1.0 - c1) * (1.0 - c2);
    float flip = mix(1.0, -1.0, step(0.5, allCond + noneCond));
    s *= flip;
    return d;
}

float getSdfParallelogram(in vec2 p, in vec2 v0, in vec2 v1, in vec2 v2, in vec2 v3) {
    float s = 1.0;
    float d = dot(p - v0, p - v0);

    d = seg(p, v0, v3, s, d);
    d = seg(p, v1, v0, s, d);
    d = seg(p, v2, v1, s, d);
    d = seg(p, v3, v2, s, d);

    return s * sqrt(d);
}

vec2 norm(vec2 value, float isPosition) {
    return (value * 2.0 - (iResolution.xy * isPosition)) / iResolution.y;
}

float antialising(float distance) {
    return 1. - smoothstep(0., norm(vec2(2., 2.), 0.).x, distance);
}

float determineStartVertexFactor(vec2 a, vec2 b) {
    // Conditions using step
    float condition1 = step(b.x, a.x) * step(a.y, b.y); // a.x < b.x && a.y > b.y
    float condition2 = step(a.x, b.x) * step(b.y, a.y); // a.x > b.x && a.y < b.y

    // If neither condition is met, return 1 (else case)
    return 1.0 - max(condition1, condition2);
}

vec2 getRectangleCenter(vec4 rectangle) {
    return vec2(rectangle.x + (rectangle.z / 2.), rectangle.y - (rectangle.w / 2.));
}
float ease(float x) {
    return pow(1.0 - x, 3.0);
}

// Catppuccin Macchiato - Lavande (#b7bdf8)
const vec4 TRAIL_COLOR = vec4(0.718, 0.741, 0.973, 1.0);
const float DURATION = 0.5; //IN SECONDS
const float BLUR_SAMPLES = 10.0; // Nombre d'échantillons pour le flou de mouvement
const float BLUR_INTENSITY = 0.7; // Intensité du flou (0.0 - 1.0)

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = texture(iChannel0, fragCoord.xy / iResolution.xy);
    // Normalization for fragCoord to a space of -1 to 1;
    vec2 vu = norm(fragCoord, 1.);
    vec2 offsetFactor = vec2(-.5, 0.5);

    // Normalization for cursor position and size;
    // cursor xy has the postion in a space of -1 to 1;
    // zw has the width and height
    vec4 currentCursor = vec4(norm(iCurrentCursor.xy, 1.), norm(iCurrentCursor.zw, 0.));
    vec4 previousCursor = vec4(norm(iPreviousCursor.xy, 1.), norm(iPreviousCursor.zw, 0.));

    // When drawing a parellelogram between cursors for the trail i need to determine where to start at the top-left or top-right vertex of the cursor
    float vertexFactor = determineStartVertexFactor(currentCursor.xy, previousCursor.xy);
    float invertedVertexFactor = 1.0 - vertexFactor;

    // Set every vertex of my parellogram
    vec2 v0 = vec2(currentCursor.x + currentCursor.z * vertexFactor, currentCursor.y - currentCursor.w);
    vec2 v1 = vec2(currentCursor.x + currentCursor.z * invertedVertexFactor, currentCursor.y);
    vec2 v2 = vec2(previousCursor.x + currentCursor.z * invertedVertexFactor, previousCursor.y);
    vec2 v3 = vec2(previousCursor.x + currentCursor.z * vertexFactor, previousCursor.y - previousCursor.w);

    float sdfCurrentCursor = getSdfRectangle(vu, currentCursor.xy - (currentCursor.zw * offsetFactor), currentCursor.zw * 0.5);
    float sdfTrail = getSdfParallelogram(vu, v0, v1, v2, v3);

    float progress = clamp((iTime - iTimeCursorChange) / DURATION, 0.0, 1.0);
    float easedProgress = ease(progress);
    // Distance between cursors determine the total length of the parallelogram;
    vec2 centerCC = getRectangleCenter(currentCursor);
    vec2 centerCP = getRectangleCenter(previousCursor);
    float lineLength = distance(centerCC, centerCP);

    vec4 newColor = vec4(fragColor);

    // Motion blur effect - échantillonner plusieurs positions le long du mouvement
    if(lineLength > 0.001) {
        vec4 blurAccum = vec4(0.0);

        for(float i = 0.0; i < BLUR_SAMPLES; i++) {
            float t = i / (BLUR_SAMPLES - 1.0);
            vec2 blurPos = mix(centerCP, centerCC, t);

            // Créer des curseurs fantômes le long de la trajectoire
            float sdfBlur = getSdfRectangle(vu, blurPos, currentCursor.zw * 0.5);

            // Poids qui diminue avec la distance
            float weight = (1.0 - t) * smoothstep(0.02, 0.0, sdfBlur);
            float alpha = weight * BLUR_INTENSITY * (1.0 - easedProgress);

            blurAccum += TRAIL_COLOR * alpha;
        }

        // Appliquer le flou de mouvement
        newColor = mix(newColor, TRAIL_COLOR, clamp(blurAccum.a, 0.0, 1.0));
        newColor.rgb = mix(newColor.rgb, blurAccum.rgb, clamp(blurAccum.a * 0.5, 0.0, 1.0));
    }

    // Compute fade factor based on distance along the trail
    float fadeFactor = 1.0 - smoothstep(lineLength, sdfCurrentCursor, easedProgress * lineLength);

    // Apply fading effect to trail color
    vec4 fadedTrailColor = TRAIL_COLOR * fadeFactor;

    // Blend trail with fade effect
    newColor = mix(newColor, fadedTrailColor, antialising(sdfTrail));
    // Draw current cursor
    newColor = mix(newColor, TRAIL_COLOR, antialising(sdfCurrentCursor));
    newColor = mix(newColor, fragColor, step(sdfCurrentCursor, 0.));
    fragColor = mix(fragColor, newColor, step(sdfCurrentCursor, easedProgress * lineLength));
}
