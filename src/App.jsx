import React, { useState, useRef, useEffect } from 'react'
import { extend, Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, OrbitControls, Text3D, Text } from '@react-three/drei'
import * as THREE from 'three'
import { MSDFTextGeometry } from 'three-msdf-text-utils'
import { uniforms } from "three-msdf-text-utils"
import VirtualScroll from 'virtual-scroll'
import './index.css'
import Experience from './Experience.jsx'
// import { Text } from 'troika-three-text'

import atlasURL from './font/BagossStandard-Regular.png'
import fnt from './font/BagossStandard-Regular-msdf.json'

// extend({ Text });

function AddText({ planeRef }) {
  const [fontLoaded, setFontLoaded] = useState(false)
  const [textProperties, setTextProperties] = useState(null)

  const textRef = useRef()
  const materialRef = useRef()

  let position = 0
  let speed = 0
  let targetspeed = 0
  const scroller = new VirtualScroll()
  scroller.on(event => {
	// wrapper.style.transform = `translateY(${event.y}px)`
  position = event.y / 2000
  speed = event.deltaY / 1000
  
  })

  useFrame((state, delta) => {
  textRef.current.position.y = -position
  speed *= 0.9
  // console.log(material.uniforms.uSpeed.value)
  targetspeed += ( speed - targetspeed ) * 0.1
  materialRef.current.uniforms.uSpeed.value = targetspeed
  planeRef.current.rotation.y = position
  })

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    defines: {
        IS_SMALL: false,
    },
    extensions: {
        derivatives: true,
        fragDepth: true, // Enable fragDepth extension for shadows
        drawBuffers: true,
        shaderTextureLOD: true,
    },
    uniforms: {

        uSpeed : { value: 0 },
        ambientLightColor: { value: new THREE.Color(0xffffff) },
        // Common
        ...uniforms.common,
        
        // Rendering
        ...uniforms.rendering,
        
        // Strokes
        ...uniforms.strokes,
    },
    vertexShader: `
        // Attribute
        attribute vec2 layoutUv;

        attribute float lineIndex;

        attribute float lineLettersTotal;
        attribute float lineLetterIndex;

        attribute float lineWordsTotal;
        attribute float lineWordIndex;

        attribute float wordIndex;

        attribute float letterIndex;

        // Varyings
        varying vec2 vUv;
        varying vec2 vLayoutUv;
        varying vec3 vViewPosition;
        varying vec3 vNormal;

        varying float vLineIndex;

        varying float vLineLettersTotal;
        varying float vLineLetterIndex;

        varying float vLineWordsTotal;
        varying float vLineWordIndex;

        varying float vWordIndex;

        varying float vLetterIndex;

        mat4 rotationMatrix(vec3 axis, float angle) {
          axis = normalize(axis);
          float s = sin(angle);
          float c = cos(angle);
          float oc = 1.0 - c;
          
          return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                      0.0,                                0.0,                                0.0,                                1.0);
      }
      
      vec3 rotate(vec3 v, vec3 axis, float angle) {
        mat4 m = rotationMatrix(axis, angle);
        return (m * vec4(v, 1.0)).xyz;
      }

      uniform float uSpeed;

        void main() {
          
            // Varyings
            vUv = uv;
            vLayoutUv = layoutUv;
           
            vNormal = normal;

            vLineIndex = lineIndex;

            vLineLettersTotal = lineLettersTotal;
            vLineLetterIndex = lineLetterIndex;

            vLineWordsTotal = lineWordsTotal;
            vLineWordIndex = lineWordIndex;

            vWordIndex = wordIndex;

            vLetterIndex = letterIndex;

            // Output
            vec3 newpos = position;
            float xx = position.x * 0.007;
            newpos = rotate(newpos, vec3(0.0, 1.0, 1.0), uSpeed * xx * xx * xx);

            vec4 mvPosition = vec4(newpos, 1.0);
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;
            vViewPosition = -mvPosition.xyz;

        }
    `,
    fragmentShader: `
        // Varyings
        varying vec2 vUv;

        // Uniforms: Common
        uniform float uOpacity;
        uniform float uThreshold;
        uniform float uAlphaTest;
        uniform vec3 uColor;
        uniform sampler2D uMap;

        // Uniforms: Strokes
        uniform vec3 uStrokeColor;
        uniform float uStrokeOutsetWidth;
        uniform float uStrokeInsetWidth;

        // Utils: Median
        float median(float r, float g, float b) {
            return max(min(r, g), min(max(r, g), b));
        }

        void main() {
            // Common
            // Texture sample
            vec3 s = texture2D(uMap, vUv).rgb;

            // Signed distance
            float sigDist = median(s.r, s.g, s.b) - 0.5;

            float afwidth = 1.4142135623730951 / 2.0;

            #ifdef IS_SMALL
                float alpha = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDist);
            #else
                float alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);
            #endif

            // Strokes
            // Outset
            float sigDistOutset = sigDist + uStrokeOutsetWidth * 0.5;

            // Inset
            float sigDistInset = sigDist - uStrokeInsetWidth * 0.5;

            #ifdef IS_SMALL
                float outset = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDistOutset);
                float inset = 1.0 - smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDistInset);
            #else
                float outset = clamp(sigDistOutset / fwidth(sigDistOutset) + 0.5, 0.0, 1.0);
                float inset = 1.0 - clamp(sigDistInset / fwidth(sigDistInset) + 0.5, 0.0, 1.0);
            #endif

            // Border
            float border = outset * inset;

            // Alpha Test
            if (alpha < uAlphaTest) discard;

            // Output: Common
            vec4 filledFragColor = vec4(uColor, uOpacity * alpha);

            // Output: Strokes
            vec4 strokedFragColor = vec4(uStrokeColor, uOpacity * border);

            // gl_FragColor = filledFragColor;
            gl_FragColor = vec4(0.0,0.0,1.0,1.0);

        }
    `,
})



const TEXT = ['Christian', 'Hohenbild', 'Endrick', 'Portfolio']

// =======================

  const initializeFont = async () => {
    const [atlas] = await Promise.all([loadFontAtlas(atlasURL)])
    material.uniforms.uMap.value = atlas

    const meshes = TEXT.map((text) => {
      const geometry = new MSDFTextGeometry({
        text: text,
        font: fnt,
      })
      const mesh = new THREE.Mesh(geometry, material)
      return mesh
    })

    return { meshes, material };
  }

  const loadFontAtlas = (path) => {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader()
      loader.load(path, resolve)
    })
  }

  useEffect(() => {
    const initialize = async () => {
      const properties = await initializeFont()
      setTextProperties(properties)
      setFontLoaded(true)
      materialRef.current = properties.material; // Save material reference
    };

    initialize();
  }, []);

  return (
    <group
    ref={textRef}
    >
      {fontLoaded && textProperties && (
        <group>
          {textProperties.meshes.map((mesh, index) => (
            <mesh
              key={index}
              castShadow
              receiveShadow
              material={textProperties.material}
              geometry={mesh.geometry}
              position={[0, - 0.3, index * 0.5]} // Adjust the spacing between texts
              scale={0.01}
              rotation={[1.5 * Math.PI, Math.PI, 0]}
            />
          ))}
        </group>
      )}
    </group>
             
  )
}


function Floor() {
  return (
      <mesh 
      position = {[0, -1,0]}
      rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[10]} />
          <meshStandardMaterial 
          color={'white'}
          />
      </mesh>
  )
}


function App() {

  const planeRef = useRef()
  const TEXT2 = ['Christian ', 'Hohenbild ', 'Endrick ', 'Portfolio ']

  return (
    <Canvas 
    shadows
    camera={{ position: [0, 0, -5], fov: 40 }}>
      
      <OrbitControls />
      
      {/* <Environment files="./Environments/envmap.hdr" /> */}
      
      <color attach="background" args={['#c1efef']} />
      
      <directionalLight 
      castShadow
      />

      <Floor />

      <Experience />
      
      <AddText 
      planeRef ={planeRef}
      />


      <mesh
        castShadow
        ref = {planeRef}
        position = {[ 2,.2,-1 ]}
        rotation={[0.5 * Math.PI, 0.5 * Math.PI, 0 ]}
        >
          <planeGeometry 
            args={[ 1, .6 ]}
            />
          <meshNormalMaterial 
            castShadow
            side = {THREE.DoubleSide}
          />
        </mesh>

      <Text 
      castShadow
      rotation={[0.5*Math.PI, Math.PI , 0 ]}
      position = {[ 0,0,-2.5 ]}    
      >
        hello world!
        <meshStandardMaterial
        castShadow
        color={"red"}
        />
      </Text>    

      {/* <text
          castShadow
          position={[ 1, -.8,-2 ]}
          rotation={[0.5*Math.PI,Math.PI,0]}
          text={TEXT2}
          maxWidth= {10}
          // fontSize={12}
          scale={2.0}
        >
         
          <meshPhongMaterial 
          attach="material" 
          color={"black"} 
          side={THREE.DoubleSide}
          />
         
        </text> */}
        
        <Text3D
          castShadow
          position={[ 1, -0.2,-1 ]}
          rotation={[0.5*Math.PI,Math.PI,0]}
          curveSegments={5}
          bevelEnabled
          bevelSize={0.004}
          bevelThickness={0.0001}
          height={0.001}
          lineHeight={0.5}
          letterSpacing={-0.06}
          size={0.5}
          font="/Inter_Bold.json">
          {`hello\nworld`}
          <meshNormalMaterial />
        </Text3D>

    </Canvas>
  );
}

export default App;

