/**
 * 微观背景：深色渐变穹顶 + 两套漂浮颗粒（胞外稀疏 / 胞质拥挤）+ 指数雾。
 *
 * 科学细节：真实细胞质是**高度拥挤**的（蛋白质与代谢物浓度极高），
 * 所以膜下方的颗粒密度明显高于胞外，这不是单纯的美术噪点。
 */

import { useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, type Points, ShaderMaterial, Vector3 } from 'three'
import { COLORS } from '../three/palette'
import { dustMaterial } from '../three/materials'
import { mulberry32 } from '../three/rand'
import { UPDATE_ORDER, useSceneUpdate } from './updateBus'

function useGradientMaterial() {
  return useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTop: { value: new Vector3(0.043, 0.086, 0.152) },
          uBottom: { value: new Vector3(0.008, 0.016, 0.031) },
          uAccent: { value: new Vector3(0.12, 0.42, 0.62) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform vec3 uAccent;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 c = mix(uBottom, uTop, pow(h, 1.35));
            // 一条柔和的冷光带，制造“显微视野边缘”的层次
            float band = exp(-pow((d.y - 0.12) * 2.4, 2.0));
            c += uAccent * band * 0.13;
            // 极轻微的暗角
            c *= 0.86 + 0.14 * h;
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  )
}

function useDustGeometry(count: number, seed: number, box: [number, number, number], center: [number, number, number]) {
  return useMemo(() => {
    const rng = mulberry32(seed)
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = center[0] + (rng() - 0.5) * box[0]
      positions[i * 3 + 1] = center[1] + (rng() - 0.5) * box[1]
      positions[i * 3 + 2] = center[2] + (rng() - 0.5) * box[2]
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed])
}

export function Background({ dustCount }: { dustCount: number }) {
  const gradient = useGradientMaterial()
  const outerRef = useRef<Points>(null)
  const innerRef = useRef<Points>(null)

  const outerGeo = useDustGeometry(Math.round(dustCount * 0.42), 1337, [46, 26, 46], [0, 6, 0])
  const innerGeo = useDustGeometry(Math.round(dustCount * 0.58), 7331, [34, 20, 34], [0, -7, 0])

  const outerMat = useMemo(() => dustMaterial('#9fd4ff', 0.085, 0.42), [])
  const innerMat = useMemo(() => dustMaterial('#63d6c0', 0.07, 0.3), [])

  useSceneUpdate(UPDATE_ORDER.organelles, ({ elapsed }) => {
    if (outerRef.current) {
      outerRef.current.rotation.y = elapsed * 0.006
      outerRef.current.position.y = Math.sin(elapsed * 0.08) * 0.4
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -elapsed * 0.009
      innerRef.current.position.x = Math.sin(elapsed * 0.11) * 0.3
    }
  })

  return (
    <group>
      <fogExp2 attach="fog" args={[COLORS.fog, 0.028]} />
      <mesh material={gradient} frustumCulled={false} renderOrder={-1000}>
        <sphereGeometry args={[160, 24, 16]} />
      </mesh>
      <points ref={outerRef} geometry={outerGeo} material={outerMat} frustumCulled={false} />
      <points ref={innerRef} geometry={innerGeo} material={innerMat} frustumCulled={false} />
      {/* 几团柔和的散射光斑，制造景深层次 */}
      <mesh position={[-9, 5, -12]} renderOrder={-900}>
        <sphereGeometry args={[6, 12, 8]} />
        <meshBasicMaterial color="#12406b" transparent opacity={0.14} blending={AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <mesh position={[11, -8, -9]} renderOrder={-900}>
        <sphereGeometry args={[8, 12, 8]} />
        <meshBasicMaterial color="#0f3a52" transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
    </group>
  )
}
