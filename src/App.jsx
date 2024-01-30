import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { SoftShadows } from '@react-three/drei'
import { Vector3 } from 'three'

import './index.css'

import ShaderText from './ShaderText.jsx'
import AddFloor from './AddFloorSimple.jsx'


function App() {

  function Rig() {
    const { camera } = useThree()
    const vec = new Vector3()
  
    return useEffect(() => {
      camera.lookAt(0, -1, 0)
    }), []
  }

  return (
  <>
    <Canvas 
    shadows
    camera={{ 
    position: [4.5, 2.5,5.5],
    fov: 40 }}    
    >

    <Rig />

    <SoftShadows  
      size= {0.5}
      focus= {0}
      samples= {20}
    /> 
    

    <color attach="background" args={[0x000000]} />
      
    <directionalLight 
      castShadow
      shadow-mapSize={1024}
      position={[-1,2,0.5]}
      intensity={[6]}
      />

    <AddFloor />

    <ShaderText />

  </Canvas>
  </>
  )
}

export default App;

