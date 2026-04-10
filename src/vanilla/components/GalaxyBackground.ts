import { BaseComponent } from '../BaseComponent';

export class GalaxyBackground extends BaseComponent {
    private animationFrameId: number | null = null;
    private startTime: number = 0;

    protected createRootElement(): HTMLElement {
        const canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.zIndex = '-1';
        return canvas;
    }

    init() {
        const canvas = this.element as HTMLCanvasElement;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const vertexShaderSource = `
            attribute vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision highp float;
            uniform vec2 u_resolution;
            uniform float u_time;

            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            float noise(in vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f*f*(3.0-2.0*f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            float fbm(in vec2 st) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 5; i++) {
                    value += amplitude * noise(st);
                    st *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }

            vec3 getLayer(vec2 uv, float speed, float scale, float brightness, float starDensity) {
                vec2 moved_uv = uv;
                moved_uv.x -= u_time * speed;
                
                vec2 gv = fract(moved_uv * scale) - 0.5;
                vec2 id = floor(moved_uv * scale);
                
                vec3 color = vec3(0.0);
                
                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 offset = vec2(float(x), float(y));
                        vec2 n_id = id + offset;
                        
                        float cell_uv_y = (n_id.y + 0.5) / scale;
                        float bandMask = exp(-abs(cell_uv_y) * 4.0);
                        
                        float pocketNoise = fbm((n_id / scale) * 3.0 + u_time * 0.005);
                        
                        float actualDensity = mix(starDensity * 0.1, starDensity * 4.0, bandMask * pocketNoise * 2.5);
                        
                        float n = random(n_id);
                        if (n < actualDensity) {
                            vec2 pos = vec2(random(n_id + 1.0), random(n_id + 2.0)) - 0.5;
                            vec2 dist = gv - offset - pos;
                            
                            float glow = 1.0 / (length(dist) * 40.0);
                            glow *= (n * 0.5 + 0.5); 
                            glow = pow(max(glow, 0.0), 1.5) * brightness;
                            
                            vec3 baseColor;
                            float randColor = random(n_id + 3.0);
                            if (randColor < 0.25) baseColor = vec3(0.6, 0.8, 1.0);
                            else if (randColor < 0.5) baseColor = vec3(1.0, 1.0, 1.0);
                            else if (randColor < 0.75) baseColor = vec3(1.0, 0.9, 0.6);
                            else baseColor = vec3(1.0, 0.6, 0.4);
                            
                            vec3 starColor = mix(baseColor, vec3(1.0), 0.3); 
                            color += starColor * glow;
                        }
                    }
                }
                return color;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                uv = uv * 2.0 - 1.0;
                uv.x *= u_resolution.x / u_resolution.y;
                
                float angle = -30.0 * 3.14159265359 / 180.0;
                float c = cos(angle);
                float s = sin(angle);
                mat2 rot = mat2(c, -s, s, c);
                uv = rot * uv;
                
                vec3 color = vec3(0.0);
                
                color += getLayer(uv, 0.03, 35.0, 0.6, 0.3);
                color += getLayer(uv, 0.08, 18.0, 1.0, 0.15);
                color += getLayer(uv, 0.2, 8.0, 2.5, 0.05);
                
                vec2 core_uv = uv;
                core_uv.x -= u_time * 0.015;
                core_uv *= 2.0; 
                
                float f = fbm(core_uv + fbm(core_uv * 0.5 - u_time * 0.01));
                float dust = fbm(core_uv * 1.5 + vec2(10.2, 3.4) + u_time * 0.005);
                float coreShape = exp(-abs(uv.y) * 5.0);
                float cloud = smoothstep(0.1, 0.9, f) * coreShape;
                cloud -= smoothstep(0.3, 0.9, dust) * coreShape * 0.8; 
                cloud = max(0.0, cloud);
                
                vec3 coreColor = vec3(1.0, 0.95, 0.9);
                vec3 edgeColor = vec3(0.15, 0.1, 0.05);
                vec3 cloudColor = mix(edgeColor, coreColor, cloud + 0.1);
                color += cloudColor * cloud * 2.5;
                color += vec3(0.02, 0.01, 0.05);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const createShader = (type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        if (vertexShader && fragmentShader) {
            const program = gl.createProgram();
            if (program) {
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);
                gl.useProgram(program);

                const positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(
                    gl.ARRAY_BUFFER,
                    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                    gl.STATIC_DRAW
                );

                const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
                gl.enableVertexAttribArray(positionAttributeLocation);
                gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

                const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
                const timeUniformLocation = gl.getUniformLocation(program, 'u_time');

                this.startTime = performance.now();

                const render = () => {
                    const displayWidth = canvas.clientWidth;
                    const displayHeight = canvas.clientHeight;
                    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                        canvas.width = displayWidth;
                        canvas.height = displayHeight;
                        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                    }

                    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
                    gl.uniform1f(timeUniformLocation, (performance.now() - this.startTime) / 1000.0);

                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    this.animationFrameId = requestAnimationFrame(render);
                };

                render();
            }
        }
    }

    render() {
        // No-op for now, canvas renders internally
    }

    destroy() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}
